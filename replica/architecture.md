# Architecture: your browser screen-streaming app (a rebuild of Discord Go Live's core features)

Browser only, your own project. 1080p60 screen sharing to viewers on any
continent, with voice, in rooms you join by link.

## The key decision: who carries the video

You rent the global relay network rather than build it. Two real options:

| | LiveKit Cloud (picked) | Cloudflare Realtime SFU |
| --- | --- | --- |
| how viewers connect | each person to the nearest region, regions relay to each other | anycast to the nearest of 330+ cities, which act as one server |
| quality layers (simulcast) | built in: `screenShareSimulcastLayers`, dynacast | you choose layers yourself with low-level track APIs |
| React SDK + UI parts | yes (`@livekit/components-react`) | no for the raw SFU (RealtimeKit has one, priced per minute) |
| server SDK for FastAPI | yes (`livekit-api` for Python: tokens, webhooks, room admin) | REST API, write your own |
| egress price | about $0.10–0.12/GB downstream, upstream free | $0.05/GB, first 1,000 GB/month free |
| lock-in | low: LiveKit is open source, so you can self-host the same server later | medium |

**LiveKit**, because simulcast for screen share, the React parts and the
Python SDK cut weeks off the build. Cloudflare is half the price per GB, so it
becomes the cost lever at scale. Keep all LiveKit calls behind one module
(`media.py` on the server, `useMedia.ts` in the browser) so you can switch later.

**What it costs:** one viewer watching 1080p60 for an hour at about 5 Mbps is
about 2.25 GB, roughly $0.25 on LiveKit or $0.11 on Cloudflare. Cost scales
with viewer-hours, not streams. Price the HD tier with that in mind.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | React + TypeScript (Vite), React Router | you use it daily. No server rendering needed for an app behind login. |
| media | LiveKit Cloud + `livekit-client` + `@livekit/components-react` | rooms, voice, screen share, simulcast, multi-region relay |
| API | FastAPI (Python 3.12), `livekit-api`, SQLAlchemy 2 + Alembic | your day-to-day stack. Issues room tokens, enforces entitlements, takes webhooks. |
| database | Postgres on Supabase | managed, free tier, and comes with auth |
| auth | Supabase Auth (email magic link + Google) | the browser gets a JWT, and FastAPI verifies it with the project's JWKS |
| payments | Stripe Checkout + Customer Portal | no card forms to build. One-click cancel comes free with the portal. |
| email | Supabase Auth emails to start, Resend later | no product emails needed at launch |
| jobs | none at first. Later, a Fly.io scheduled machine for cleanup. | webhooks do the live work |
| hosting | web on Cloudflare Pages, API on Fly.io (Toronto `yyz`) | static web at the edge, API close to you and Supabase |
| TURN | LiveKit's built-in TURN/TLS on 443 | viewers behind corporate firewalls still connect |

One database, one API, one static web app. No microservices.

## Media settings (the 1080p60 part)

Browser capture and publish, in `useMedia.ts`:

```ts
const room = new Room({
  adaptiveStream: true,   // viewers only pull the layer that fits their player size
  dynacast: true,         // streamer stops encoding layers nobody is watching
  publishDefaults: {
    videoCodec: 'vp9',                      // falls back to vp8 via backupCodec
    backupCodec: true,
    screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 60 },
    screenShareSimulcastLayers: [VideoPresets.h720, VideoPresets.h360],
    degradationPreference: 'balanced',      // games: keep fps; text: switch to maintain-resolution
  },
});
await room.localParticipant.setScreenShareEnabled(true, {
  resolution: { width: 1920, height: 1080, frameRate: 60 },
  audio: true,            // tab/system audio where the browser allows it
  contentHint: 'motion',  // 'detail' for code/text
});
```

With an SVC codec (VP9/AV1), LiveKit uses layers inside one stream instead of
simulcast. Either way each viewer gets the best quality their link can take,
and one slow viewer no longer drags down everyone else (Discord's weak spot).

Browser limits to design around:
- Chrome and Edge: tab, window and screen capture at 60fps. **Audio only for a
  tab, or for the whole screen on Windows.** No single-window audio.
- Safari and Firefox: screen and window capture work. **No system audio.**
- 1080p60 needs a decent uplink, about 6 Mbps. Show a warning when the
  estimate is lower, and drop to 720p60 rather than freezing.

## Schema

Tables: 9. Access rules: data-layer checks in FastAPI. RLS is on with no
policies, so the browser can't touch tables directly. Full SQL in `schema.sql`.

- `plans` (free 720p30, hd 1080p60), `profiles`, `subscriptions`, `stripe_events`
- `rooms`, `room_members` (role, can_stream)
- `streams` (log from webhooks, max one live per person per room), `stream_views`, `livekit_events`

Who is connected and which tracks are live is **not** in Postgres. LiveKit
holds that, and the browser reads it from the room. Postgres holds who's
allowed to do what, plus history.

## API

All routes need a Supabase JWT except webhooks and health.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /me | profile + plan + entitlements | signed in | - | `{user, plan:{max_height,max_fps}}` | all |
| PATCH /me | change display name | self | `{display_name}` | profile | - |
| POST /rooms | create a room, caller becomes owner | signed in | `{name}` | room + invite link | F01 |
| GET /rooms | rooms I'm in | signed in | - | list | F01 |
| POST /rooms/join/{invite_code} | join by link | signed in | - | room | F02 |
| GET /rooms/{id} | room details + members | member | - | room | F01, F02 |
| PATCH /rooms/{id}/members/{user_id} | set role / can_stream | owner, admin | `{role?, can_stream?}` | member | permissions |
| DELETE /rooms/{id}/members/{user_id} | remove member (also kicks from LiveKit) | owner, admin, self | - | 204 | - |
| POST /rooms/{id}/token | **mint the LiveKit token** | member | - | `{url, token, entitlements}` | F01, F02 |
| POST /billing/checkout | Stripe Checkout session for HD | signed in | `{plan_id}` | `{url}` | F03 |
| POST /billing/portal | Stripe Customer Portal | subscriber | - | `{url}` | F03 |
| POST /webhooks/livekit | track published/unpublished, participant joined/left | LiveKit (signed) | event | 200 | F01, F02, F05 |
| POST /webhooks/stripe | subscription changes → `profiles.plan_id` | Stripe (signed) | event | 200 | F03 |
| GET /health | liveness | anyone | - | ok | - |

**The token route is where the rules live.** The grant sets `roomJoin`, `room`,
`canSubscribe: true`, and `canPublishSources: ['microphone', 'screen_share',
'screen_share_audio']` only if `can_stream` is true. It puts
`{max_height, max_fps}` in participant attributes so the UI can lock options.
TTL is 10 minutes, and the client refreshes it.

Webhooks in: LiveKit (`track_published`, `track_unpublished`,
`participant_joined`, `participant_left`, `room_finished`), Stripe
(`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`).
Webhooks out: none.
Jobs: none at launch. Later, a nightly job closes `streams` and `stream_views` rows left open by missed webhooks.

## The parts that bite

- **Enforcing the paid cap.** The browser picks the capture resolution, and
  LiveKit can't cap a publisher's resolution. Defence: the UI locks options
  by plan. The `track_published` webhook checks the track's width, height
  and fps against the plan, and if it's over, the server calls
  `MutePublishedTrack`, marks the stream `revoked` and tells the client. That
  stops honest users and the merely curious. That's enough for now.
- **Cross-continent quality.** Covered by LiveKit's regional relay and
  simulcast. Measure it: show a stats overlay (fps, resolution, bitrate, RTT,
  loss) from `getStats()` and log samples. Test early with a friend overseas
  or a VPN exit in Sydney or Mumbai.
- **Physics.** Toronto to Sydney is about 200 ms round trip. Expect 250–400 ms
  glass-to-glass between continents. It's fine for watching, so don't promise
  "zero lag".
- **Idempotency.** LiveKit and Stripe both retry. Store event ids
  (`livekit_events`, `stripe_events`) and skip duplicates.
- **Races.** Double-clicking Go Live, or starting a stream in two tabs, is
  blocked by the partial unique index (one live stream per person per room)
  and by the client's own guard.
- **Plan changes mid-stream.** On downgrade, the next token refresh carries
  the new cap. The webhook doesn't recheck live tracks, so leave the stream
  running until it ends. Upgrades apply on the next Go Live.
- **Secrets.** `LIVEKIT_API_SECRET`, `STRIPE_SECRET_KEY` and the Supabase
  service key live only in Fly secrets. The browser gets only the Supabase
  anon key and the LiveKit URL.
- **Rate limits.** Limit the token route (it's a lot of value per call) and room creation.
- **GDPR deletion.** Deleting a profile cascades everything. Also delete the Stripe customer.
- **Search, offline, file uploads:** not applicable.

## Build order

1. **Vertical slice (week 1):** sign in → create a room → copy invite link →
   second browser joins → Go Live at 1080p60 → the other side watches.
   Screens S01, S02 (browser's own picker), S04, S05. Tables profiles, rooms,
   room_members. Routes /me, /rooms, /rooms/join, /rooms/{id}/token. Test it
   with someone on another continent this week, not at the end.
2. **Must-haves (weeks 2–3):** quality picker with resolution and fps (S03),
   simulcast + dynacast tuned, LIVE tiles and click to watch, voice,
   bandwidth warning and graceful 720p fallback, stream log via LiveKit webhook.
3. **Should-haves (weeks 3–4):** tab audio, fullscreen and pop-out
   (Picture-in-Picture API), viewer list, per-room can_stream (S08), stats
   overlay (S06), Stripe HD tier + upsell (S07), plan enforcement in the webhook.
4. **Could-haves:** AV1 where both ends support it, 4K tier, E2EE with
   LiveKit's built-in end-to-end encryption, mobile viewing (the web app
   already works in mobile browsers).
5. **Fixes from replica-entrepreneur:** once it runs.

Skipped by design: desktop app, game capture, Discord's social layer.

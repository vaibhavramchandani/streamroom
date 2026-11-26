# Recon map: Discord Go Live, the Nitro HD streaming perk (desktop + web)

Scope: Go Live / screen share inside a voice room: one person shares a screen,
window or game at up to 1080p 60fps, and viewers on other continents watch
with low latency. Text chat, servers, friends, Nitro's cosmetic perks and the
rest of Discord are out of scope.
For: assumed to be Vaibhav's own product or project. Confirm before replica-architect.
Date: 2026-11-25

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | pricing page | https://discord.com/nitro | Nitro $9.99/mo, Nitro Basic $2.99/mo. Says only "HD streaming", no resolution or fps listed. |
| 2 | engineering blog: Go Live | https://discord.com/blog/how-it-all-goes-live-an-overview-of-discords-streaming-technology | Capture fallback chain, VP8/H.264 (HEVC/AV1 on some platforms), hardware encode, bandwidth-driven adaptation, no multi-second buffer, relayed via backend only to people watching |
| 3 | engineering blog: edge | https://discord.com/blog/how-we-moved-discord-voice-to-the-edge | June 2026. One SFU hosts the whole call. Mixed-region calls are the weak spot. Moved to Cloudflare's 300+ city edge. |
| 4 | engineering blog: WebRTC scale | https://discord.com/blog/how-discord-handles-two-and-half-million-concurrent-voice-users-using-webrtc | All A/V is WebRTC, multiparty, SFU-based |
| 5 | DAVE protocol | https://daveprotocol.com/ | Open E2EE for calls and Go Live. The SFU forwards packets it can't decrypt. |
| 6 | E2EE rollout | https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted | E2EE standard on all calls since March 2026 |
| 7 | help center: Go Live | https://support.discord.com/hc/en-us/articles/360040816151 | Up to 50 people sharing video or screen per voice channel. Page fetch failed, used the search snippet. |
| 8 | tier comparisons (third party) | eesel.ai, gamesradar.com | Free tier capped at 720p30. Full Nitro gets 1080p60 and up to 4K60. Sources disagree on Nitro Basic, so treat it as unverified. |
| 9 | community forum | support.discord.com community posts | Server boosts also raise quality (level 2 gives 1080p60). Common complaints: quality drops mid-stream, pixelation on text. |
| 10 | the user's own account | - | Not used yet. Clicking through the Go Live picker with your own account would confirm the screen states below. |

## Core loop

You're in a voice room with friends, you press Go Live, pick a window, and
they watch it at 1080p60 with under a second of delay, wherever they are.

## Screens

From Discord's public desktop UI. Confidence is medium until checked in your own account.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Voice room | join a voice channel or DM call | who's here, who's live | participant tiles, LIVE badge, control bar | empty, 1 person, many, someone live |
| S02 | Source picker | "Share screen" in the control bar | pick a screen, window or game | tabs (Applications / Screens), thumbnail grid | loading thumbnails, no permission (macOS screen-recording prompt) |
| S03 | Quality settings | step 2 of the picker | resolution, fps, audio on or off | segmented resolution (720/1080/source), fps (15/30/60), locked options with an upsell badge | free (locked), paid (unlocked) |
| S04 | Streamer preview | after Go Live | see what you're sending | small self-preview, viewer count, stop button, settings | live, paused (minimized window), error |
| S05 | Viewer stage | click a LIVE tile | watch the stream | video, fullscreen, pop out, volume, viewer list | connecting, playing, buffering/frozen, ended |
| S06 | Stream stats overlay | right-click a stream → debug/stats | diagnostics | resolution, fps, bitrate, codec, packet loss | - |
| S07 | Upsell modal | click a locked 1080p/60 option | convert to paid | plan cards, CTA | - |
| S08 | Room permissions | room settings | who can stream | "Video/Go Live" permission toggle per role | allowed, denied |

## Flows

```
F01 Streamer goes live at 1080p60
    S01 -> S02 -> S03 -> S04
    happy path clicks: 4 (share, pick window, pick quality, Go Live)
    edge: no screen-capture permission (macOS), window closed mid-stream,
          game in exclusive fullscreen, GPU has no hardware encoder,
          uplink too slow for 1080p60 (must degrade, not freeze)

F02 Viewer on another continent watches
    S01 -> S05
    happy path clicks: 1 (click LIVE tile)
    edge: viewer on a 10 Mbps link while others are on fibre, viewer's
          decoder can't do the negotiated codec, joins mid-stream (needs a
          keyframe quickly), packet loss on a transoceanic path

F03 Free user tries 1080p60
    S02 -> S03 -> S07 -> (pay) -> S03
    edge: entitlement changes mid-stream

F04 Stream with system/game audio
    S03 (audio toggle) -> S04
    edge: echo when the streamer is also in voice, per-app audio capture on Windows vs macOS

F05 Stop / stream ends
    S04 stop -> viewers' S05 shows "stream ended"
    edge: streamer crashes or loses network (viewer timeout and message)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Participant tile | camera, avatar, live stream | speaking, muted, live, connecting | S01 |
| Control bar | streamer, viewer | default, live | S01, S04, S05 |
| Source thumbnail card | screen, window, game | default, selected, unavailable | S02 |
| Segmented quality picker | resolution, fps | default, selected, locked (paid) | S03 |
| Video player | inline, fullscreen, pop-out | connecting, playing, frozen, ended | S05 |
| Stats overlay | - | - | S06 |
| Upsell modal | - | - | S07 |
| Toast | info, error | - | everywhere ("Your stream quality was reduced") |

## Inferred data model

```
User          id, display_name, plan (free | hd), created_at
              evidence: Nitro page tiers. confidence: high

Plan          id, name, max_height (720 | 1080 | 2160), max_fps (30 | 60), price
              evidence: tier comparisons (source 8). confidence: medium

Room          id, owner_id, name, region_hint, created_at
              evidence: voice channels, edge blog's call placement. confidence: high

RoomMember    room_id, user_id, role, can_stream (bool)
              evidence: Go Live server permission (source 7). confidence: high

Session       id, room_id, sfu_node_id, started_at, ended_at
              evidence: "one SFU instance hosts the call" (source 3). confidence: high

Stream        id, session_id, streamer_id, source_kind (screen | window | game),
              requested_height, requested_fps, codec (vp8 | h264 | hevc | av1),
              audio_enabled, status (live | ended), started_at, ended_at
              evidence: S03 options, codec list (source 2). confidence: high

StreamViewer  stream_id, user_id, joined_at, left_at, edge_node_id
              evidence: relayed only to people watching (source 2). confidence: high

SfuNode       id, region, city, public_endpoint, load
              evidence: edge blog (source 3). confidence: medium (guess at fields)

StreamStats   stream_id, viewer_id, ts, fps, height, bitrate_kbps, rtt_ms, loss_pct, freezes
              evidence: metrics they track: fps, latency, VMAF (source 2). confidence: guess
```

Relationships: User 1-n RoomMember n-1 Room. Room 1-n Session. Session 1-n
Stream. Stream 1-n StreamViewer. Session n-1 SfuNode. User n-1 Plan.

## Feature matrix

See `features.csv`. Must: 14, should: 9, could: 6, skip: 4.

## The part you asked about: 1080p60 across continents

What Discord does (sources 2 and 3):
- WebRTC end to end. The streamer encodes once with a hardware encoder and
  the SFU forwards packets to whoever is watching. There's no transcoding and
  no HLS-style buffer, so delay stays under a second.
- The streamer never sends more than the slowest viewer can take. One slow
  viewer drags everyone down.
- **Each call is pinned to one SFU.** A viewer in Sydney watching a streamer
  in Toronto who are both on a Toronto SFU sends every packet across the
  Pacific on the public internet. Discord's own post says mixed-region
  calls are the weak spot. Their fix so far is more edge sites, with smarter
  placement still planned.

Where a clone can beat it:
- **Cascaded SFUs.** Each participant connects to their nearest edge node,
  and the nodes relay to each other over a private backbone. LiveKit Cloud
  and Cloudflare's Realtime SFU both work this way. That fixes the
  cross-continent case Discord admits it hasn't solved.
- **Simulcast or SVC (layered encoding).** The streamer sends 1080p60, 720p30
  and 360p together (or one AV1/VP9 stream with layers). Each viewer's edge
  node forwards the layer that viewer can handle, so one slow viewer stops
  degrading everyone else. This is a top complaint about Discord (source 9).
- Physics sets the floor. Toronto to Sydney is about 200 ms round trip at
  best. One-way glass-to-glass delay of 250 to 400 ms is realistic between
  continents. That's fine for watching, but you can't remove it.
- Bandwidth: 1080p60 screen content needs roughly 4 to 8 Mbps up from the
  streamer (H.264), or about 30 to 40% less with AV1 if both ends support it.

## Out of scope (cannot or should not be cloned)

- Discord's network and users: the social graph, servers and friends are what make Go Live sticky
- Their edge footprint, which runs on a deal with Cloudflare across 300+ cities. You'd rent this (LiveKit Cloud, Cloudflare Realtime), not build it.
- The game-capture DLL injection technique. It works by hooking into games, which anti-cheat software can flag. Use OS capture APIs only.
- The Discord name, the Nitro brand, the purple and Clyde

## Size

Screens 8, flows 5, entities 9. Hard parts: real-time adaptive video across
continents (rent the SFU mesh, don't build it), desktop capture plus hardware
encoding (needs a desktop app such as Electron or Tauri for window/game capture
and system audio, since the browser's getDisplayMedia is limited, especially
for audio on macOS), and optional E2EE (insertable streams / an MLS-based
scheme like DAVE). Size: **M** (a few weeks) on a managed SFU like LiveKit with
a browser client. **L** (a quarter) for a polished desktop app with game capture,
audio and E2EE.

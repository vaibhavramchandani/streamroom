# Build log

| ID | date | status | what's missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-11-25 | done | - | - |
| sign-in | 2026-11-25 | done (dev mode) | real accounts via Supabase (replica-backend) | - |
| home | 2026-11-25 | done | - | - |
| join | 2026-11-25 | done | - | - |
| S01 room + lobby | 2026-11-25 | partial | in-call view not yet run against a media server | Joining is a button, not automatic: browsers only allow audio to play after a click |
| S02 + S03 share setup | 2026-11-25 | partial | not yet run against a media server | Browser audio rules differ per browser and OS, so the audio option explains itself |
| S04 streamer preview | 2026-11-25 | partial | not yet run against a media server | - |
| S05 viewer stage | 2026-11-25 | partial | per-stream viewer count | - |
| S06 stats overlay | 2026-11-25 | partial | not yet run against a media server | Several quality layers are sent, so stats report the biggest one |
| S07 upsell | 2026-11-25 | partial | billing (replica-backend) | - |
| S08 room permissions | 2026-11-25 | done | removing someone doesn't yet drop them from a live call | The checkbox felt stuck until the server replied. Fixed with an instant update that reverts on error. |

## Not verified yet, and why

Running a LiveKit media server inside the build environment was blocked, so
the live-video path (go live, watch, 1080p60, stats) is written against
LiveKit's real SDKs and type-checked, but has not streamed a frame. The e2e
test already covers it: run it once with `MEDIA=1` against `livekit-server --dev`
(see README). It asserts the viewer receives 1920×1080.

## Tests

- API: 9 pytest tests (auth, rooms, invites, permissions, token grants and plan caps)
- Browser: 2 Playwright tests (full slice with two users, error states). Media part runs with `MEDIA=1`.

## Parity

51.5 / 100, with 3 of 14 must-haves done. Most must-haves are "partial" only
because they haven't run against a media server yet. One passing `MEDIA=1` run
should move about 8 of them to done.

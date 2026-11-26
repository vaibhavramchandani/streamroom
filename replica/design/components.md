# Components

Built in `app/src/ui/` and shown in every state at `/design` (screenshot:
`design-system.png`). Tokens only: no raw hex or pixel values in components.
Icons: Lucide (ISC licence). Font: Inter (OFL). Accessible base: Radix (Tooltip,
ToggleGroup, Dialog).

The design is built from the recon map's screens and parts, not measured from
Discord screenshots. It's a dark streaming UI with a neutral placeholder accent
(light grey). `replica-brand` gives it its own accent colour.

```
Button
  variants  primary, secondary, ghost, danger, live
  sizes     sm 32px, md 40px, lg 48px
  states    default, hover, focus-visible (2px focus ring), disabled, loading (spinner, label kept, aria-busy)
  tokens    accent / on-accent, surface-raised, danger-solid, live / on-live, radius md, font semibold
  a11y      real <button>, disabled while loading
  used on   S03, S07, toasts, everywhere

IconButton
  variants  default, active (toggled on), danger, live
  sizes     md 40px, lg 48px (round)
  states    default, hover, focus-visible, disabled, pressed
  tokens    surface-raised, accent, danger-solid, live, radius pill
  a11y      required label → aria-label + tooltip; aria-pressed for toggles
  used on   control bar (S01, S04), stage controls (S05)

LiveBadge
  tokens    live / on-live (4.54:1 at 12px bold), radius sm, xs uppercase
  used on   S01 tiles, S05 stage

ParticipantTile
  states    connecting (pulsing avatar + "connecting"), idle, speaking (2px speaking ring),
            muted (mic-off icon), live (stream preview + LIVE + hover "Watch stream")
  layout    16:9, min 240px, auto-fill grid
  a11y      live tile is a <button> "Watch {name}'s stream"; long names truncate
  used on   S01

ControlBar
  controls  mic toggle, share toggle (live tone while sharing), settings, leave (danger)
  states    can share, can't share (disabled, tooltip says why), sharing
  a11y      role=toolbar, every button labelled
  used on   S01, S04

SourceCard  (screen / window / tab)
  states    default, hover, selected (accent border + check), disabled with a reason
  a11y      role=radio in a radiogroup, aria-checked
  note      the browser shows its own picker after this. The card sets
            getDisplayMedia hints and explains audio (tab gives audio in Chromium).
  used on   S02

QualityPicker  (resolution, frame rate)
  states    selected, unselected, locked (lock icon; opens the upsell instead of selecting)
  a11y      Radix ToggleGroup (arrow keys move, single select); locked items say "needs HD plan"
  used on   S03

StreamStage
  states    connecting (spinner), playing, frozen (translucent warning over last frame), ended
  chrome    top: LIVE + name + viewer count; bottom on hover/focus: picture in picture, full screen, close
  a11y      <figure> with caption; status messages are role=status; controls appear on focus too
  used on   S05

StatsOverlay
  rows      resolution, fps, bitrate, codec, round trip, loss, server region
  tones     ok text / warn warning / bad danger. Thresholds: fps ≥55 ok; RTT <150 ok, <300 warn; loss <1% ok, <5% warn
  used on   S06

UpsellDialog
  states    open, upgrading (button loading)
  a11y      Radix Dialog: focus trapped, Esc closes, title + description wired up
  copy      written fresh; promises one-click cancel (the billing fix)
  used on   S07

Toast
  tones     info, warning, danger (role=alert), success (role=status)
  used on   everywhere, e.g. "Quality lowered to 720p"
```

## Layout

- Sidebar 264px (room list), header 52px, control bar 64px, max content 1440px
- Tiles: auto-fill grid, min 240px, 16:9
- Breakpoints: 640 / 900 / 1200
- Spacing on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64
- Radius: 6 / 10 / 16 / pill. Motion: 120ms / 200ms, with reduced motion respected.

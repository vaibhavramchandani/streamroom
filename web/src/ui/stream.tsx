import { clsx } from 'clsx';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AppWindow,
  Check,
  Expand,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Monitor,
  MonitorUp,
  PhoneOff,
  PictureInPicture2,
  ScreenShareOff,
  Settings,
  Users,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, IconButton, LiveBadge } from './primitives';

/* --------------------------------------------------------- ParticipantTile */

export type TileState = 'connecting' | 'idle' | 'speaking' | 'live';

export function ParticipantTile({
  name,
  state,
  muted = false,
  preview,
  onWatch,
}: {
  name: string;
  state: TileState;
  muted?: boolean;
  preview?: ReactNode; // stream thumbnail when live
  onWatch?: () => void;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const isLive = state === 'live';
  const Root = isLive ? 'button' : 'div';
  return (
    <Root
      type={isLive ? 'button' : undefined}
      onClick={isLive ? onWatch : undefined}
      aria-label={isLive ? `Watch ${name}'s stream` : undefined}
      className={clsx(
        'group relative flex aspect-video min-w-60 items-center justify-center overflow-hidden rounded-lg bg-surface-raised text-left',
        'ring-2 ring-inset transition-shadow duration-fast',
        state === 'speaking' ? 'ring-speaking' : 'ring-transparent',
        isLive && 'cursor-pointer hover:ring-border-input',
      )}
    >
      {isLive && preview ? (
        <div className="absolute inset-0 bg-stage">{preview}</div>
      ) : (
        <span
          aria-hidden
          className={clsx(
            'flex size-16 items-center justify-center rounded-pill bg-border text-lg font-semibold text-text',
            state === 'connecting' && 'animate-pulse',
          )}
        >
          {initials}
        </span>
      )}

      {isLive && (
        <span className="absolute inset-0 flex items-center justify-center bg-overlay/60 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">Watch stream</span>
        </span>
      )}

      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-sm bg-overlay/80 px-2 py-1 text-xs font-medium text-text">
        {muted && <MicOff aria-label="Muted" className="size-3.5 shrink-0 text-danger" />}
        <span className="truncate">{name}</span>
        {state === 'connecting' && <span className="text-text-muted">· connecting</span>}
      </span>
      {isLive && <LiveBadge className="absolute top-2 left-2" />}
    </Root>
  );
}

/* ------------------------------------------------------------- ControlBar */

export function ControlBar({
  micOn,
  sharing,
  onToggleMic,
  onToggleShare,
  onLeave,
  onSettings,
  canShare = true,
}: {
  micOn: boolean;
  sharing: boolean;
  onToggleMic?: () => void;
  onToggleShare?: () => void;
  onLeave?: () => void;
  onSettings?: () => void;
  canShare?: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Call controls"
      className="flex h-16 items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4"
    >
      <IconButton
        label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        icon={micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        active={micOn}
        onClick={onToggleMic}
      />
      <IconButton
        label={sharing ? 'Stop sharing' : canShare ? 'Share your screen' : 'You can’t share in this room'}
        icon={sharing ? <ScreenShareOff className="size-5" /> : <MonitorUp className="size-5" />}
        tone={sharing ? 'live' : 'default'}
        disabled={!canShare && !sharing}
        onClick={onToggleShare}
      />
      <IconButton label="Stream settings" icon={<Settings className="size-5" />} onClick={onSettings} />
      <IconButton label="Leave room" icon={<PhoneOff className="size-5" />} tone="danger" onClick={onLeave} />
    </div>
  );
}

/* -------------------------------------------------------------- SourceCard */
// Browsers show their own picker (getDisplayMedia), so this card is for the
// "what are you sharing" choice we ask first: screen vs window vs tab.

export function SourceCard({
  kind,
  selected,
  disabled,
  note,
  onSelect,
}: {
  kind: 'screen' | 'window' | 'tab';
  selected?: boolean;
  disabled?: boolean;
  note?: string;
  onSelect?: () => void;
}) {
  const meta = {
    screen: { icon: Monitor, title: 'Entire screen', body: 'Everything on one display' },
    window: { icon: AppWindow, title: 'A window', body: 'One app, even when it’s behind others' },
    tab: { icon: Volume2, title: 'A browser tab', body: 'Best for video, includes tab audio' },
  }[kind];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'relative flex w-full flex-col gap-2 rounded-md border p-4 text-left transition-colors duration-fast',
        selected ? 'border-accent bg-surface-raised' : 'border-border bg-surface hover:border-border-input',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <Icon aria-hidden className="size-6 text-text-muted" />
      <span className="text-sm font-semibold text-text">{meta.title}</span>
      <span className="text-xs text-text-muted">{note ?? meta.body}</span>
      {selected && (
        <Check aria-hidden className="absolute top-3 right-3 size-4 rounded-pill bg-accent p-0.5 text-on-accent" />
      )}
    </button>
  );
}

/* ----------------------------------------------------------- QualityPicker */

export interface QualityOption {
  value: string;
  label: string;
  locked?: boolean; // needs the HD plan
}

export function QualityPicker({
  label,
  options,
  value,
  onChange,
  onLockedClick,
}: {
  label: string;
  options: QualityOption[];
  value: string;
  onChange: (v: string) => void;
  onLockedClick?: (v: string) => void;
}) {
  const id = `qp-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-xs font-semibold tracking-wide text-text-muted uppercase">
        {label}
      </span>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={id}
        value={value}
        onValueChange={(v) => {
          if (!v) return; // keep one selected
          const opt = options.find((o) => o.value === v);
          if (opt?.locked) onLockedClick?.(v);
          else onChange(v);
        }}
        className="inline-flex rounded-md border border-border bg-surface p-1"
      >
        {options.map((o) => (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            aria-label={o.locked ? `${o.label}, needs HD plan` : o.label}
            className={clsx(
              'inline-flex h-8 min-w-16 items-center justify-center gap-1 rounded-sm px-3 text-sm font-medium transition-colors duration-fast',
              'data-[state=on]:bg-accent data-[state=on]:text-on-accent',
              'data-[state=off]:text-text-muted data-[state=off]:hover:text-text',
            )}
          >
            {o.label}
            {o.locked && <Lock aria-hidden className="size-3" />}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}

/* ------------------------------------------------------------- StreamStage */

export type StageState = 'connecting' | 'playing' | 'frozen' | 'ended';

export function StreamStage({
  streamer,
  state,
  children,
  stats,
  viewers,
  onFullscreen,
  onPip,
  onClose,
}: {
  streamer: string;
  state: StageState;
  children?: ReactNode; // the <video>
  stats?: ReactNode;
  viewers?: number;
  onFullscreen?: () => void;
  onPip?: () => void;
  onClose?: () => void;
}) {
  return (
    <figure
      aria-label={`${streamer}'s stream`}
      className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-stage"
    >
      {children}

      {state === 'connecting' && (
        <StageMessage icon={<Loader2 className="size-6 animate-spin" />} text={`Connecting to ${streamer}’s stream…`} />
      )}
      {state === 'frozen' && (
        <StageMessage
          icon={<WifiOff className="size-6 text-warning" />}
          text="Connection is struggling"
          sub="Lowering quality to keep it moving"
          translucent
        />
      )}
      {state === 'ended' && (
        <StageMessage icon={<ScreenShareOff className="size-6" />} text={`${streamer} stopped streaming`} />
      )}

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-overlay/80 to-transparent p-3">
        {state !== 'ended' && <LiveBadge />}
        <figcaption className="truncate text-sm font-semibold text-text">{streamer}</figcaption>
        {viewers !== undefined && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-text-muted">
            <Users aria-hidden className="size-3.5" />
            <span>
              {viewers} <span className="sr-only">watching</span>
            </span>
          </span>
        )}
      </div>

      {stats && <div className="absolute top-12 right-3">{stats}</div>}

      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-overlay/80 to-transparent p-3 opacity-0 transition-opacity duration-base group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton size="md" label="Picture in picture" icon={<PictureInPicture2 className="size-4" />} onClick={onPip} />
        <IconButton size="md" label="Full screen" icon={<Expand className="size-4" />} onClick={onFullscreen} />
        <IconButton size="md" label="Stop watching" icon={<X className="size-4" />} onClick={onClose} />
      </div>
    </figure>
  );
}

function StageMessage({
  icon,
  text,
  sub,
  translucent,
}: {
  icon: ReactNode;
  text: string;
  sub?: string;
  translucent?: boolean;
}) {
  return (
    <div
      role="status"
      className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center gap-2 text-text',
        translucent ? 'bg-overlay/70' : 'bg-stage',
      )}
    >
      {icon}
      <p className="text-sm font-semibold">{text}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ StatsOverlay */

export interface StreamStats {
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
  codec: string;
  rttMs: number;
  lossPct: number;
  region?: string;
}

export function StatsOverlay({ s }: { s: StreamStats }) {
  const rows: [string, string, 'ok' | 'warn' | 'bad'][] = [
    ['Resolution', `${s.width}×${s.height}`, s.height >= 1080 ? 'ok' : 'warn'],
    ['Frame rate', `${s.fps} fps`, s.fps >= 55 ? 'ok' : s.fps >= 25 ? 'warn' : 'bad'],
    ['Bitrate', `${(s.bitrateKbps / 1000).toFixed(1)} Mbps`, 'ok'],
    ['Codec', s.codec.toUpperCase(), 'ok'],
    ['Round trip', `${s.rttMs} ms`, s.rttMs < 150 ? 'ok' : s.rttMs < 300 ? 'warn' : 'bad'],
    ['Packet loss', `${s.lossPct.toFixed(1)}%`, s.lossPct < 1 ? 'ok' : s.lossPct < 5 ? 'warn' : 'bad'],
  ];
  if (s.region) rows.push(['Server', s.region, 'ok']);
  const tone = { ok: 'text-text', warn: 'text-warning', bad: 'text-danger' };
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 rounded-md bg-overlay/85 px-3 py-2 font-mono text-xs">
      {rows.map(([k, v, t]) => (
        <div key={k} className="contents">
          <dt className="text-text-muted">{k}</dt>
          <dd className={clsx('text-right', tone[t])}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------ UpsellDialog */

export function UpsellDialog({
  open,
  onOpenChange,
  onUpgrade,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpgrade: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-overlay/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-pop">
          <Dialog.Title className="text-lg text-text">Stream in full HD</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-text-muted">
            The HD plan unlocks 1080p at 60 frames per second, so text stays sharp and games stay smooth for
            everyone watching.
          </Dialog.Description>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-text">
            {['1080p at 60 fps', 'Each viewer gets the best quality their connection allows', 'Cancel any time in one click'].map(
              (f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {f}
                </li>
              ),
            )}
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Not now</Button>
            </Dialog.Close>
            <Button onClick={onUpgrade} loading={loading}>
              Upgrade to HD
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, Loader2, PhoneCall, Settings as SettingsIcon, Users } from 'lucide-react';
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { api } from '../lib/api';
import type { RoomInfo } from '../lib/api';
import { useMediaRoom, useTrackStats } from '../media/useMediaRoom';
import { Button, LiveBadge, Skeleton, Toast } from '../ui/primitives';
import { ControlBar, ParticipantTile, StatsOverlay, StreamStage, UpsellDialog } from '../ui/stream';
import ShareSetupDialog from './ShareSetupDialog';

function VideoView({ track, className }: { track: RemoteVideoTrack | LocalVideoTrack | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} className={className ?? 'absolute inset-0 size-full object-contain'} muted playsInline autoPlay />;
}

function InviteButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/join/${code}`;
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copy this invite link', url);
        }
      }}
    >
      <span aria-live="polite">{copied ? 'Link copied' : 'Copy invite link'}</span>
    </Button>
  );
}

export default function RoomPage() {
  const { roomId = '' } = useParams();
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [infoError, setInfoError] = useState<{ status: number; msg: string } | null>(null);
  const media = useMediaRoom(roomId);
  const [setupOpen, setSetupOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .room(roomId)
      .then(setInfo)
      .catch((e) => setInfoError({ status: e.status, msg: e.message }));
  }, [roomId]);

  const region = media.region();
  const viewer = useTrackStats(media.watchedTrack, region);
  const sender = useTrackStats(media.localScreen, region);
  const watchedName = media.participants.find((p) => p.identity === media.watching)?.name ?? 'Stream';
  const watchedStillLive = media.participants.some((p) => p.identity === media.watching && p.live);

  // Tell the streamer when the network forces quality down.
  const warned = useRef(false);
  useEffect(() => {
    const s = sender.stats;
    if (!s || !media.sharing) {
      warned.current = false;
      return;
    }
    if (s.limitedBy === 'bandwidth' && !warned.current) {
      warned.current = true;
      media.notify({
        tone: 'warning',
        title: `Quality lowered to ${s.height}p`,
        body: 'Your upload speed can’t keep up. It goes back up when your connection recovers.',
      });
    }
  }, [sender.stats, media]);

  if (infoError)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Toast tone="danger" title={infoError.status === 404 ? 'Room not found' : 'Couldn’t open the room'}>
          {infoError.status === 404 ? 'It may have been deleted, or you haven’t joined it yet. Ask for an invite link.' : infoError.msg}
        </Toast>
        <Link to="/" className="text-sm text-focus underline">
          Back to your rooms
        </Link>
      </main>
    );

  if (!info)
    return (
      <main className="flex flex-col gap-4 p-4 sm:p-6" aria-busy aria-label="Loading room">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-video w-full max-w-3xl" />
      </main>
    );

  const canManage = info.my_role !== 'member';
  const stageState = !media.watchedTrack
    ? watchedStillLive
      ? 'connecting'
      : 'ended'
    : viewer.stalled
      ? 'frozen'
      : 'playing';

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-lg text-text">{info.name}</h1>
        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
          <Users aria-hidden className="size-3.5" />
          {media.connected
            ? `${media.participants.length} in the call`
            : `${info.members.length} ${info.members.length === 1 ? 'member' : 'members'}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <InviteButton code={info.invite_code} />
          {canManage && (
            <Link
              to={`/r/${info.id}/settings`}
              aria-label="Room settings"
              className="inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-raised hover:text-text"
            >
              <SettingsIcon className="size-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Lobby: not in the call yet */}
      {!media.connected && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface p-8 text-center">
          {media.status === 'connecting' ? (
            <p role="status" className="flex items-center gap-2 text-text-muted">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Connecting…
            </p>
          ) : (
            <>
              <div>
                <h2 className="text-lg text-text">{media.status === 'left' ? 'You left the call' : 'Ready to join?'}</h2>
                <p className="mt-1 text-sm text-text-muted">
                  You’ll join with your microphone off. Turn it on when you want to talk.
                </p>
              </div>
              {media.status === 'error' && media.error && (
                <Toast tone="danger" title="Couldn’t join the call">
                  {media.error}
                </Toast>
              )}
              <Button size="lg" icon={<PhoneCall className="size-5" />} onClick={media.join}>
                {media.status === 'error' ? 'Try again' : media.status === 'left' ? 'Rejoin' : 'Join the call'}
              </Button>
            </>
          )}
        </section>
      )}

      {/* In the call */}
      {media.connected && (
        <>
          {media.status === 'reconnecting' && (
            <Toast tone="warning" title="Reconnecting…">
              Your connection dropped. Hang on.
            </Toast>
          )}

          {media.watching && (
            <div ref={stageRef} className="w-full">
              <StreamStage
                streamer={watchedName}
                state={stageState}
                viewers={undefined}
                stats={showStats && viewer.stats ? <StatsOverlay s={viewer.stats} /> : undefined}
                onClose={() => media.watch(null)}
                onFullscreen={() => stageRef.current?.requestFullscreen?.()}
                onPip={() => {
                  const v = stageRef.current?.querySelector('video');
                  v?.requestPictureInPicture?.().catch(() => undefined);
                }}
              >
                <VideoView track={media.watchedTrack} />
              </StreamStage>
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-text-muted">
                <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} />
                Show stream stats
              </label>
            </div>
          )}

          <section
            aria-label="People in the call"
            className="grid grid-cols-[repeat(auto-fill,minmax(var(--layout-tile-min),1fr))] gap-3"
          >
            {media.participants.map((p) =>
              p.isLocal && media.sharing ? (
                // S04: your own stream, with what you're actually sending
                <div key={p.identity} className="relative aspect-video overflow-hidden rounded-lg bg-stage ring-2 ring-live ring-inset">
                  <VideoView track={media.localScreen} />
                  <LiveBadge className="absolute top-2 left-2" />
                  <span className="absolute bottom-2 left-2 rounded-sm bg-overlay/80 px-2 py-1 text-xs font-medium text-text">
                    You · sharing
                    {sender.stats ? ` · ${sender.stats.height}p${sender.stats.fps}` : ''}
                  </span>
                </div>
              ) : (
                <ParticipantTile
                  key={p.identity}
                  name={p.isLocal ? `${p.name} (you)` : p.name}
                  state={p.live && !p.isLocal ? 'live' : p.speaking ? 'speaking' : 'idle'}
                  muted={!p.micOn}
                  preview={
                    <span className="flex size-full items-center justify-center text-sm text-text-muted">
                      {media.watching === p.identity ? 'Watching' : 'Click to watch'}
                    </span>
                  }
                  onWatch={() => media.watch(p.identity)}
                />
              ),
            )}
          </section>

          <div className="sticky bottom-4 mt-auto">
            <ControlBar
              micOn={media.micOn}
              sharing={media.sharing}
              canShare={media.caps.canStream}
              onToggleMic={media.toggleMic}
              onToggleShare={() => (media.sharing ? media.stopShare() : setSetupOpen(true))}
              onSettings={() => setSetupOpen(true)}
              onLeave={media.leave}
            />
          </div>
        </>
      )}

      <ShareSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        maxHeight={media.caps.maxHeight}
        maxFps={media.caps.maxFps}
        onLocked={() => setUpsellOpen(true)}
        onGoLive={async (req) => {
          if (media.sharing) await media.stopShare();
          return media.startShare(req);
        }}
      />
      <UpsellDialog
        open={upsellOpen}
        onOpenChange={setUpsellOpen}
        onUpgrade={() => {
          setUpsellOpen(false);
          media.notify({ tone: 'info', title: 'Billing comes in the backend step', body: 'For now, sign in again and pick the HD plan.' });
        }}
      />

      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 z-50 flex flex-col gap-2">
        {media.notices.map((n) => (
          <Toast key={n.id} tone={n.tone} title={n.title}>
            {n.body}
          </Toast>
        ))}
      </div>
      <div ref={media.audioHostRef} hidden />
    </main>
  );
}

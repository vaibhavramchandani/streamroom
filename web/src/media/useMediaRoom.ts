// Everything LiveKit-specific in the browser lives here, so the provider can change later.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import type { Participant, VideoCodec } from 'livekit-client';
import { api, ApiError } from '../lib/api';
import type { MediaToken } from '../lib/api';

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'left';
export type Surface = 'monitor' | 'window' | 'browser';

export interface ParticipantView {
  identity: string;
  name: string;
  isLocal: boolean;
  speaking: boolean;
  micOn: boolean;
  live: boolean;
}

export interface ShareRequest {
  height: 720 | 1080;
  fps: 15 | 30 | 60;
  audio: boolean;
  surface: Surface;
  content: 'motion' | 'detail';
}

export interface LiveStats {
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
  codec: string;
  rttMs: number;
  lossPct: number;
  region?: string;
  limitedBy?: string; // sender side: 'bandwidth' | 'cpu' | 'none'
}

export interface Notice {
  id: number;
  tone: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  body?: string;
}

// Codec per kind of content. VP8 costs the sender far less processor, so a game keeps its frame
// rate while the machine is busy running it (benchmarked: VP9 and H.264 drop to 12-15 fps under
// load where VP8 held ~20, and VP8 was never slower). VP9 packs text and slides into fewer
// bits, so it is used for "Sharp text". LiveKit falls back to VP8 for browsers that can't decode VP9.
const CODEC: VideoCodec = 'vp9'; // room default; each share picks its own below
const codecFor = (content: 'motion' | 'detail'): VideoCodec => (content === 'detail' ? 'vp9' : 'vp8');

function bitrateFor(height: number, fps: number) {
  if (height >= 1080) return fps >= 60 ? 6_000_000 : 4_000_000;
  return fps >= 60 ? 3_500_000 : 2_500_000;
}

export function useMediaRoom(roomId: string) {
  const roomRef = useRef<Room | null>(null);
  const tokenRef = useRef<MediaToken | null>(null);
  const audioHost = useRef<HTMLDivElement | null>(null);
  const watchingRef = useRef<string | null>(null); // read inside LiveKit event handlers
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [caps, setCaps] = useState({ canStream: false, maxHeight: 720, maxFps: 30 });
  const [sharing, setSharing] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);
  const [watchedTrack, setWatchedTrack] = useState<RemoteVideoTrack | null>(null);
  const [localScreen, setLocalScreen] = useState<LocalVideoTrack | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);

  const notify = useCallback((n: Omit<Notice, 'id'>) => {
    const id = ++noticeId.current;
    setNotices((all) => [...all.slice(-2), { ...n, id }]);
    window.setTimeout(() => setNotices((all) => all.filter((x) => x.id !== id)), 6000);
  }, []);

  const snapshot = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const view = (p: Participant, isLocal: boolean): ParticipantView => ({
      identity: p.identity,
      name: p.name || 'Someone',
      isLocal,
      speaking: p.isSpeaking,
      micOn: p.isMicrophoneEnabled,
      live: !!p.getTrackPublication(Track.Source.ScreenShare),
    });
    setParticipants([
      view(room.localParticipant, true),
      ...Array.from(room.remoteParticipants.values()).map((p) => view(p, false)),
    ]);
    setSharing(!!room.localParticipant.getTrackPublication(Track.Source.ScreenShare));
    setMicOn(room.localParticipant.isMicrophoneEnabled);
    const ls = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
    setLocalScreen(ls instanceof LocalVideoTrack ? ls : null);
  }, []);

  // ---------------------------------------------------------------- join / leave
  const join = useCallback(async () => {
    if (roomRef.current) return;
    setStatus('connecting');
    setError(null);
    let tok: MediaToken;
    try {
      tok = await api.mediaToken(roomId);
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiError ? e.message : 'Couldn’t get permission to join.');
      return;
    }
    tokenRef.current = tok;
    setCaps({ canStream: tok.can_stream, maxHeight: tok.max_height, maxFps: tok.max_fps });

    const room = new Room({
      adaptiveStream: true, // viewers pull only the quality that fits their player
      dynacast: true, // the streamer stops encoding layers nobody watches
      publishDefaults: { videoCodec: CODEC, backupCodec: true },
    });
    roomRef.current = room;

    room
      .on(RoomEvent.ParticipantConnected, snapshot)
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        if (p.identity === watchingRef.current) {
          setWatchedTrack(null);
          notify({ tone: 'info', title: `${p.name || 'They'} left the room` });
        }
        snapshot();
      })
      .on(RoomEvent.ActiveSpeakersChanged, snapshot)
      .on(RoomEvent.TrackMuted, snapshot)
      .on(RoomEvent.TrackUnmuted, snapshot)
      .on(RoomEvent.LocalTrackPublished, snapshot)
      .on(RoomEvent.LocalTrackUnpublished, snapshot)
      .on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
        // Voice is always on. Streams are only pulled when someone chooses to watch.
        if (pub.source === Track.Source.Microphone) pub.setSubscribed(true);
        if (p.identity === watchingRef.current && pub.source !== Track.Source.Microphone) pub.setSubscribed(true);
        snapshot();
      })
      .on(RoomEvent.TrackUnpublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (pub.source === Track.Source.ScreenShare && p.identity === watchingRef.current) {
          setWatchedTrack(null);
        }
        snapshot();
      })
      .on(RoomEvent.TrackSubscribed, (track, pub, p) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.sid = pub.trackSid;
          audioHost.current?.appendChild(el);
        }
        if (pub.source === Track.Source.ScreenShare && p.identity === watchingRef.current) {
          setWatchedTrack(track as RemoteVideoTrack);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      })
      .on(RoomEvent.Reconnecting, () => setStatus('reconnecting'))
      .on(RoomEvent.Reconnected, () => setStatus('connected'))
      .on(RoomEvent.Disconnected, () => {
        setStatus((s) => (s === 'left' ? s : 'error'));
        setError((e) => e ?? 'You were disconnected.');
      });

    try {
      await room.connect(tok.url, tok.token, { autoSubscribe: false });
      await room.startAudio(); // we're inside the "Join" click, so autoplay is allowed
      room.remoteParticipants.forEach((p) =>
        p.trackPublications.forEach((pub) => {
          if (pub.source === Track.Source.Microphone) pub.setSubscribed(true);
        }),
      );
      setStatus('connected');
      snapshot();
    } catch {
      roomRef.current = null;
      setStatus('error');
      setError('Couldn’t connect to the media server. Is it running?');
    }
  }, [roomId, snapshot, notify]);

  const leave = useCallback(async () => {
    setStatus('left');
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setParticipants([]);
    setWatching(null);
    setWatchedTrack(null);
  }, []);

  useEffect(() => () => void roomRef.current?.disconnect(), []);

  // ---------------------------------------------------------------- mic
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    } catch {
      notify({ tone: 'danger', title: 'Microphone blocked', body: 'Allow microphone access in your browser to talk.' });
    }
    snapshot();
  }, [snapshot, notify]);

  // ---------------------------------------------------------------- go live
  const startShare = useCallback(
    async (req: ShareRequest) => {
      const room = roomRef.current;
      if (!room || !caps.canStream) return false;
      // The server's plan is the ceiling, whatever the picker says.
      const height = Math.min(req.height, caps.maxHeight) as 720 | 1080;
      const fps = Math.min(req.fps, caps.maxFps);
      const width = height === 1080 ? 1920 : 1280;
      const maxBitrate = bitrateFor(height, fps);
      const videoCodec = codecFor(req.content);
      try {
        await room.localParticipant.setScreenShareEnabled(
          true,
          {
            audio: req.audio,
            systemAudio: req.audio ? 'include' : 'exclude',
            resolution: { width, height, frameRate: fps },
            contentHint: req.content,
            video: { displaySurface: req.surface },
            selfBrowserSurface: 'exclude',
            surfaceSwitching: 'include',
          },
          {
            videoCodec,
            backupCodec: true,
            screenShareEncoding: { maxBitrate, maxFramerate: fps },
            // One full-quality stream, no resolution simulcast. Measured with VP9: with extra 720p/360p
            // layers the sender's bandwidth estimate stalls near 1 Mbps, the 1080p layer never
            // gets bitrate, and viewers stay on 360p. VP9's temporal layers (L1T3) still let the
            // server shed frame rate for a struggling viewer without a second encode.
            simulcast: false,
            degradationPreference: req.content === 'detail' ? 'maintain-resolution' : 'maintain-framerate',
          },
        );
        snapshot();
        notify({ tone: 'success', title: 'You’re live', body: `Sharing at ${height}p, ${fps} fps.` });
        return true;
      } catch (e) {
        const name = (e as Error)?.name;
        if (name === 'NotAllowedError' || name === 'AbortError') return false; // they cancelled the picker
        notify({
          tone: 'danger',
          title: 'Couldn’t start sharing',
          body: 'Your browser blocked screen capture. Check its permissions and try again.',
        });
        return false;
      }
    },
    [caps, snapshot, notify],
  );

  const stopShare = useCallback(async () => {
    await roomRef.current?.localParticipant.setScreenShareEnabled(false);
    snapshot();
  }, [snapshot]);

  // ---------------------------------------------------------------- watch
  const setSubscribedFor = (identity: string, on: boolean) => {
    const p = roomRef.current?.remoteParticipants.get(identity);
    if (!p) return;
    for (const src of [Track.Source.ScreenShare, Track.Source.ScreenShareAudio]) {
      p.getTrackPublication(src)?.setSubscribed(on);
    }
  };

  const watch = useCallback((identity: string | null) => {
    const prev = watchingRef.current;
    if (prev && prev !== identity) setSubscribedFor(prev, false);
    watchingRef.current = identity;
    setWatching(identity);
    setWatchedTrack(null);
    if (!identity) return;
    setSubscribedFor(identity, true);
    const pub = roomRef.current?.remoteParticipants.get(identity)?.getTrackPublication(Track.Source.ScreenShare);
    if (pub?.track) setWatchedTrack(pub.track as RemoteVideoTrack);
  }, []);

  const audioHostRef = useCallback((el: HTMLDivElement | null) => {
    audioHost.current = el;
  }, []);

  return {
    status,
    error,
    participants,
    caps,
    sharing,
    micOn,
    watching,
    watchedTrack,
    localScreen,
    notices,
    connected: status === 'connected' || status === 'reconnecting',
    region: () => (roomRef.current as unknown as { serverInfo?: { region?: string } } | null)?.serverInfo?.region,
    isConnected: () => roomRef.current?.state === ConnectionState.Connected,
    join,
    leave,
    toggleMic,
    startShare,
    stopShare,
    watch,
    notify,
    audioHostRef,
  };
}

// ------------------------------------------------------------------ stats

/** Samples WebRTC stats once a second for a track (viewer: inbound, streamer: outbound). */
export function useTrackStats(track: RemoteVideoTrack | LocalVideoTrack | null, region?: string) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!track) {
      setStats(null);
      setStalled(false);
      return;
    }
    let prevBytes = 0;
    let prevTs = 0;
    let lowFrames = 0;
    const timer = window.setInterval(async () => {
      const report = await track.getRTCStatsReport();
      if (!report) return;
      const rtps: RTCStats[] = [];
      let rtt = 0;
      const codecs = new Map<string, string>();
      report.forEach((s: RTCStats & Record<string, unknown>) => {
        if (s.type === 'inbound-rtp' || s.type === 'outbound-rtp') rtps.push(s);
        if (s.type === 'codec') codecs.set(s.id, String(s.mimeType ?? '').replace('video/', ''));
        if (s.type === 'candidate-pair' && s.nominated && typeof s.currentRoundTripTime === 'number')
          rtt = s.currentRoundTripTime * 1000;
        if (s.type === 'remote-inbound-rtp' && typeof s.roundTripTime === 'number' && !rtt)
          rtt = s.roundTripTime * 1000;
      });
      // The streamer sends several layers. Report the biggest one.
      const top = rtps
        .map((s) => s as RTCStats & Record<string, number & string>)
        .sort((a, b) => (b.frameHeight ?? 0) - (a.frameHeight ?? 0))[0];
      if (!top) return;
      const bytes = rtps.reduce(
        (n, s) => n + Number((s as unknown as Record<string, number>).bytesReceived ?? (s as unknown as Record<string, number>).bytesSent ?? 0),
        0,
      );
      const kbps = prevTs ? ((bytes - prevBytes) * 8) / (top.timestamp - prevTs) : 0;
      prevBytes = bytes;
      prevTs = top.timestamp;
      const lost = Number(top.packetsLost ?? 0);
      const got = Number(top.packetsReceived ?? top.packetsSent ?? 0);
      const fps = Math.round(Number(top.framesPerSecond ?? 0));
      lowFrames = fps < 1 ? lowFrames + 1 : 0;
      setStalled(lowFrames >= 3);
      setStats({
        width: Number(top.frameWidth ?? 0),
        height: Number(top.frameHeight ?? 0),
        fps,
        bitrateKbps: Math.max(0, Math.round(kbps)),
        codec: codecs.get(String(top.codecId)) || '—',
        rttMs: Math.round(rtt),
        lossPct: got + lost > 0 ? (lost / (got + lost)) * 100 : 0,
        region,
        limitedBy: top.qualityLimitationReason ? String(top.qualityLimitationReason) : undefined,
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [track, region]);
  return { stats, stalled };
}

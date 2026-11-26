import { useState } from 'react';
import { MonitorUp, Plus } from 'lucide-react';
import { Button, IconButton, LiveBadge, Toast } from '../ui/primitives';
import { ControlBar, ParticipantTile, QualityPicker, SourceCard, StatsOverlay, StreamStage, UpsellDialog } from '../ui/stream';
import type { ReactNode } from 'react';

// A stand-in for a real stream frame. No images from the original app.
function FakeFrame({ label = 'shared screen' }: { label?: string }) {
  return (
    <div className="absolute inset-0 grid grid-cols-[22%_1fr] gap-2 bg-surface p-3">
      <div className="rounded-sm bg-surface-raised" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-2/5 rounded-sm bg-border" />
        <div className="flex-1 rounded-sm bg-gradient-to-br from-surface-raised to-border" />
        <span className="self-end font-mono text-xs text-text-subtle">{label}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="text-lg text-text">{title}</h2>
      {children}
    </section>
  );
}

const colors = [
  'bg', 'surface', 'surface-raised', 'stage', 'border', 'border-input', 'text', 'text-muted', 'text-subtle',
  'accent', 'on-accent', 'focus', 'live', 'danger', 'danger-solid', 'success', 'warning', 'speaking',
];

export default function DesignPage() {
  const [res, setRes] = useState('720');
  const [fps, setFps] = useState('30');
  const [src, setSrc] = useState<'screen' | 'window' | 'tab'>('window');
  const [upsell, setUpsell] = useState(false);
  const [mic, setMic] = useState(true);
  const [sharing, setSharing] = useState(false);

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 p-8">
      <header>
        <h1 className="text-xl text-text">Design system</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every part in every state. Colours come from tokens.json, and the accent is a placeholder until the brand step.
        </p>
      </header>

      <Section title="Colour roles">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {colors.map((c) => (
            <div key={c} className="overflow-hidden rounded-md border border-border">
              <div className="h-12" style={{ background: `var(--color-${c})` }} />
              <p className="bg-surface px-2 py-1.5 font-mono text-xs text-text-muted">{c}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <div className="flex flex-col gap-2">
          <p className="text-display">Display 40</p>
          <p className="text-xl">Title 28</p>
          <p className="text-lg">Heading 20</p>
          <p className="text-base">Body 16: the quick brown fox streams at sixty frames.</p>
          <p className="text-sm">Small 14: default UI text.</p>
          <p className="text-xs">Caption 12: badges and labels.</p>
          <p className="font-mono text-xs text-text-muted">Mono 12: 1920×1080 · 60 fps · 5.8 Mbps</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Leave room</Button>
          <Button variant="live" icon={<MonitorUp className="size-4" />}>
            Go live
          </Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />}>
            Small
          </Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="flex items-center gap-3">
          <IconButton label="Microphone on" icon={<MonitorUp className="size-5" />} active />
          <IconButton label="Default" icon={<MonitorUp className="size-5" />} />
          <IconButton label="Sharing" icon={<MonitorUp className="size-5" />} tone="live" />
          <IconButton label="Disabled" icon={<MonitorUp className="size-5" />} disabled />
          <LiveBadge />
        </div>
      </Section>

      <Section title="Participant tiles (S01)">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          <ParticipantTile name="Vaibhav R" state="idle" />
          <ParticipantTile name="Priya Sharma" state="speaking" />
          <ParticipantTile name="Sam" state="idle" muted />
          <ParticipantTile name="Connecting user" state="connecting" />
          <ParticipantTile name="Alex Chen" state="live" preview={<FakeFrame />} onWatch={() => {}} />
          <ParticipantTile
            name="A person with a very long display name that keeps going"
            state="live"
            muted
            preview={<FakeFrame />}
          />
        </div>
      </Section>

      <Section title="Control bar">
        <div className="flex flex-col gap-3">
          <ControlBar
            micOn={mic}
            sharing={sharing}
            onToggleMic={() => setMic(!mic)}
            onToggleShare={() => setSharing(!sharing)}
          />
          <ControlBar micOn={false} sharing={false} canShare={false} />
        </div>
      </Section>

      <Section title="Share setup (S02 + S03)">
        <div role="radiogroup" aria-label="What to share" className="grid max-w-2xl grid-cols-3 gap-3">
          <SourceCard kind="screen" selected={src === 'screen'} onSelect={() => setSrc('screen')} />
          <SourceCard kind="window" selected={src === 'window'} onSelect={() => setSrc('window')} />
          <SourceCard
            kind="tab"
            selected={src === 'tab'}
            onSelect={() => setSrc('tab')}
          />
          <SourceCard kind="tab" disabled note="Not supported in this browser" />
        </div>
        <div className="flex flex-wrap gap-6">
          <QualityPicker
            label="Resolution"
            value={res}
            onChange={setRes}
            onLockedClick={() => setUpsell(true)}
            options={[
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p', locked: true },
            ]}
          />
          <QualityPicker
            label="Frame rate"
            value={fps}
            onChange={setFps}
            onLockedClick={() => setUpsell(true)}
            options={[
              { value: '15', label: '15' },
              { value: '30', label: '30' },
              { value: '60', label: '60', locked: true },
            ]}
          />
          <QualityPicker
            label="Resolution (HD plan)"
            value="1080"
            onChange={() => {}}
            options={[
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p' },
            ]}
          />
        </div>
        <UpsellDialog open={upsell} onOpenChange={setUpsell} onUpgrade={() => setUpsell(false)} />
      </Section>

      <Section title="Stream stage (S05) + stats (S06)">
        <div className="grid gap-4 lg:grid-cols-2">
          <StreamStage
            streamer="Alex Chen"
            state="playing"
            viewers={4}
            stats={
              <StatsOverlay
                s={{ width: 1920, height: 1080, fps: 60, bitrateKbps: 5800, codec: 'vp9', rttMs: 212, lossPct: 0.4, region: 'Sydney' }}
              />
            }
          >
            <FakeFrame label="1080p60" />
          </StreamStage>
          <StreamStage streamer="Alex Chen" state="connecting" />
          <StreamStage streamer="Alex Chen" state="frozen" viewers={4}>
            <FakeFrame />
          </StreamStage>
          <StreamStage streamer="Alex Chen" state="ended" />
        </div>
      </Section>

      <Section title="Toasts">
        <div className="flex flex-wrap gap-3">
          <Toast title="You’re live">4 people can see your screen.</Toast>
          <Toast tone="warning" title="Quality lowered to 720p">Your upload speed dropped. We’ll go back up when it recovers.</Toast>
          <Toast tone="danger" title="Couldn’t start sharing">Your browser blocked screen capture. Check its permissions.</Toast>
          <Toast tone="success" title="HD unlocked">1080p at 60 fps is ready.</Toast>
        </div>
      </Section>
    </main>
  );
}

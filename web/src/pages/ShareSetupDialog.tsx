import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '../ui/primitives';
import { QualityPicker, SourceCard } from '../ui/stream';
import type { ShareRequest, Surface } from '../media/useMediaRoom';

// S02 + S03: what to share and at what quality. The browser's own picker opens after "Go live".

const isChromium = typeof navigator !== 'undefined' && /Chrome\//.test(navigator.userAgent);
const isWindows = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);

function audioNote(surface: Surface): string | null {
  if (!isChromium) return 'This browser can’t share audio. Chrome or Edge can.';
  if (surface === 'browser') return null;
  if (surface === 'monitor' && isWindows) return null;
  return 'Audio only works when you share a tab' + (isWindows ? ' or your whole screen.' : '.');
}

export default function ShareSetupDialog({
  open,
  onOpenChange,
  maxHeight,
  maxFps,
  onLocked,
  onGoLive,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  maxHeight: number;
  maxFps: number;
  onLocked: () => void;
  onGoLive: (req: ShareRequest) => Promise<boolean>;
}) {
  const [surface, setSurface] = useState<Surface>('window');
  const [height, setHeight] = useState<720 | 1080>(maxHeight >= 1080 ? 1080 : 720);
  const [fps, setFps] = useState<15 | 30 | 60>(maxFps >= 60 ? 60 : 30);
  const [audio, setAudio] = useState(true);
  const [content, setContent] = useState<'motion' | 'detail'>('motion');
  const [busy, setBusy] = useState(false);

  // If the plan changes (upgrade), default to the best it allows.
  useEffect(() => {
    setHeight(maxHeight >= 1080 ? 1080 : 720);
    setFps(maxFps >= 60 ? 60 : 30);
  }, [maxHeight, maxFps]);

  const note = audioNote(surface);
  const audioPossible = note === null;

  async function go() {
    setBusy(true);
    const ok = await onGoLive({ surface, height, fps, audio: audio && audioPossible, content });
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-overlay/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg text-text">Share your screen</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-text-muted">
                Pick what to share and how sharp it should be. Your browser asks which one next.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-text-muted hover:bg-surface-raised hover:text-text" aria-label="Close">
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div role="radiogroup" aria-label="What to share" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SourceCard kind="screen" selected={surface === 'monitor'} onSelect={() => setSurface('monitor')} />
            <SourceCard kind="window" selected={surface === 'window'} onSelect={() => setSurface('window')} />
            <SourceCard kind="tab" selected={surface === 'browser'} onSelect={() => setSurface('browser')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-6">
            <QualityPicker
              label="Resolution"
              value={String(height)}
              onChange={(v) => setHeight(Number(v) as 720 | 1080)}
              onLockedClick={onLocked}
              options={[
                { value: '720', label: '720p' },
                { value: '1080', label: '1080p', locked: maxHeight < 1080 },
              ]}
            />
            <QualityPicker
              label="Frame rate"
              value={String(fps)}
              onChange={(v) => setFps(Number(v) as 15 | 30 | 60)}
              onLockedClick={onLocked}
              options={[
                { value: '15', label: '15' },
                { value: '30', label: '30' },
                { value: '60', label: '60', locked: maxFps < 60 },
              ]}
            />
            <QualityPicker
              label="Optimise for"
              value={content}
              onChange={(v) => setContent(v as 'motion' | 'detail')}
              options={[
                { value: 'motion', label: 'Smooth motion' },
                { value: 'detail', label: 'Sharp text' },
              ]}
            />
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
              checked={audio && audioPossible}
              disabled={!audioPossible}
              onChange={(e) => setAudio(e.target.checked)}
            />
            <span>
              <span className="font-medium text-text">Share audio</span>
              {note && <span className="block text-xs text-text-muted">{note}</span>}
            </span>
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button variant="live" onClick={go} loading={busy}>
              Go live · {height}p{fps}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

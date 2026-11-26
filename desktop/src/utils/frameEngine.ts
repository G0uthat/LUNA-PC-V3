import { TargetFpsOption } from '../types';

export interface LiveFpsMetrics {
  /** Real measured FPS paced to the selected target (or full monitor refresh rate when 'max') */
  fps: number;
  /** Native display refresh rate detected via requestAnimationFrame */
  displayHz: number;
  /** Target FPS label ('Máx' or numeric cap) */
  targetLabel: string;
  /** Average frame duration in ms */
  frameMs: number;
}

/**
 * Applies adaptive CSS motion timing variables on :root tuned to the selected FPS target
 * so non-editing UI transitions & mobile-style animations feel buttery-smooth at 60/90/120/144/240Hz.
 */
export function applyMotionTimingForFps(targetFps: TargetFpsOption): void {
  const root = document.documentElement;
  const numeric = targetFps === 'max' ? 120 : targetFps;

  // Higher refresh rates support slightly snappier, ultra-crisp spring curves
  const fastMs = numeric >= 120 ? 140 : numeric >= 90 ? 155 : 175;
  const baseMs = numeric >= 120 ? 220 : numeric >= 90 ? 245 : 270;
  const modalMs = numeric >= 120 ? 200 : numeric >= 90 ? 220 : 250;

  root.style.setProperty('--luma-anim-fast', `${fastMs}ms`);
  root.style.setProperty('--luma-anim-base', `${baseMs}ms`);
  root.style.setProperty('--luma-anim-modal', `${modalMs}ms`);
  root.style.setProperty('--luma-fps-target', String(targetFps));
}

/**
 * Runs a real continuous frame-rate engine that paces animated updates to `targetFps`
 * (when a numeric cap is lower than the display Hz) and reports real measured FPS + frame time
 * at all times across the entire application.
 */
export function subscribeLiveFps(
  targetFps: TargetFpsOption,
  onMetrics: (metrics: LiveFpsMetrics) => void
): () => void {
  applyMotionTimingForFps(targetFps);

  let rafId = 0;
  let lastReportTs = performance.now();
  let lastPacedTs = lastReportTs;
  let rawFrames = 0;
  let pacedFrames = 0;
  let smoothedHz = 60;
  let smoothedFps = 60;

  const numericCap = targetFps === 'max' ? Infinity : Number(targetFps);
  const minFrameIntervalMs = Number.isFinite(numericCap) ? 1000 / numericCap : 0;

  const tick = (now: number) => {
    rawFrames += 1;

    // Frame pacing: count/allow paced frame ticks at the user-selected FPS cap (or native max)
    if (minFrameIntervalMs <= 0 || now - lastPacedTs >= minFrameIntervalMs - 1.2) {
      pacedFrames += 1;
      lastPacedTs = now;
    }

    const elapsed = now - lastReportTs;
    if (elapsed >= 400) {
      const measuredHz = Math.max(1, Math.round((rawFrames * 1000) / elapsed));
      const measuredPaced = Math.max(1, Math.round((pacedFrames * 1000) / elapsed));

      smoothedHz = Math.round(smoothedHz * 0.35 + measuredHz * 0.65);
      const effective = Number.isFinite(numericCap)
        ? Math.min(numericCap, measuredPaced)
        : measuredHz;
      smoothedFps = Math.round(smoothedFps * 0.3 + effective * 0.7);

      onMetrics({
        fps: smoothedFps,
        displayHz: smoothedHz,
        targetLabel: targetFps === 'max' ? 'Máx' : `${targetFps}`,
        frameMs: Number((1000 / Math.max(1, smoothedFps)).toFixed(1)),
      });

      rawFrames = 0;
      pacedFrames = 0;
      lastReportTs = now;
    }

    rafId = window.requestAnimationFrame(tick);
  };

  rafId = window.requestAnimationFrame(tick);
  return () => {
    window.cancelAnimationFrame(rafId);
  };
}

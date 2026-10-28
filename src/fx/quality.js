// Is this device fast enough for the effects it has? Pure (no timers, no DOM), so it is testable.
// Only frames the engine renders at full rate count: when nothing moves it renders 30 fps on purpose
// (engine.js), and those frames say nothing about the device.

export const WINDOW_S = 3;  // judge every 3 s of full-rate frames
export const SLOW_FPS = 42; // under this: step down
export const FAST_FPS = 57; // over this two windows in a row: step up

export const createWatch = () => ({ frames: 0, seconds: 0, fastWindows: 0 });

/**
 * One rendered frame, dt seconds after the one before. full: this frame and the one before were both
 * rendered at full rate. Returns 'slow' or 'fast' when a verdict is due, else null.
 */
export function judgeFrame(w, dt, full) {
  if (!full) return null;
  w.frames++;
  w.seconds += dt;
  if (w.seconds < WINDOW_S) return null;
  const fps = w.frames / w.seconds;
  w.frames = 0;
  w.seconds = 0;
  if (fps < SLOW_FPS) { w.fastWindows = 0; return 'slow'; }
  if (fps > FAST_FPS) { if (++w.fastWindows < 2) return null; w.fastWindows = 0; return 'fast'; }
  w.fastWindows = 0;
  return null;
}

/**
 * Plays a gentle two-note chime using the Web Audio API (no external audio files).
 * Fails silently when audio is unavailable or blocked by autoplay policy.
 */
export function playFocusChime(kind: "focus" | "break" = "focus"): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = kind === "focus" ? [587.33, 880] : [523.25, 659.25]; // D5 -> A5 or C5 -> E5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.14);
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.48);
    });

    window.setTimeout(() => { void ctx.close().catch(() => undefined); }, 900);
  } catch {
    // Audio unavailable or blocked; toast notification still handles feedback.
  }
}

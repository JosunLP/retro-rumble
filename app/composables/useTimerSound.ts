/**
 * useTimerSound Composable
 *
 * Generates a harmonious chime using the Web Audio API
 * when the retro timer finishes. No external audio files needed.
 *
 * The chime plays a pleasant three-note ascending major chord
 * (C5 → E5 → G5) with smooth fade-out for a gentle notification.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a single sine tone with smooth envelope
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Smooth envelope: quick attack, sustain, gentle release
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.04);
  gainNode.gain.setValueAtTime(volume, startTime + duration * 0.6);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/**
 * Plays a harmonious three-note ascending chime (C5 → E5 → G5)
 */
function playChime(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // C major chord notes — ascending arpeggio
    // C5 = 523.25 Hz, E5 = 659.25 Hz, G5 = 783.99 Hz
    const notes = [
      { freq: 523.25, delay: 0, duration: 1.2, volume: 0.06 },
      { freq: 659.25, delay: 0.15, duration: 1.0, volume: 0.05 },
      { freq: 783.99, delay: 0.3, duration: 1.4, volume: 0.04 },
    ];

    for (const note of notes) {
      playTone(ctx, note.freq, now + note.delay, note.duration, note.volume);
    }

    // Soft octave undertone for warmth
    playTone(ctx, 261.63, now, 1.6, 0.025); // C4
  } catch {
    // Audio not available — fail silently
  }
}

/**
 * Composable providing the timer chime
 */
export function useTimerSound() {
  return { playChime };
}

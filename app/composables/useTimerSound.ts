/**
 * useTimerSound Composable
 *
 * Generates live timer sounds with the Web Audio API.
 * Special days can swap in easter-egg melodies while keeping
 * everything synthesized in-browser without external audio files.
 */
import type { ITimerSoundPreset, TimerSoundType } from '~/types';

let audioCtx: AudioContext | null = null;

const DEFAULT_TIMER_SOUND: ITimerSoundPreset = {
  id: 'default-chime',
  notes: [
    { frequency: 523.25, delay: 0, duration: 1.2, volume: 0.06 },
    { frequency: 659.25, delay: 0.15, duration: 1.0, volume: 0.05 },
    { frequency: 783.99, delay: 0.3, duration: 1.4, volume: 0.04 },
    { frequency: 261.63, delay: 0, duration: 1.6, volume: 0.025 },
  ],
};

const APRIL_FOOLS_TIMER_SOUND: ITimerSoundPreset = {
  id: 'april-fools-riff',
  notes: [
    { frequency: 392.0, delay: 0, duration: 0.24, volume: 0.05, type: 'triangle' },
    { frequency: 523.25, delay: 0.14, duration: 0.24, volume: 0.05, type: 'triangle' },
    { frequency: 659.25, delay: 0.28, duration: 0.24, volume: 0.045, type: 'triangle' },
    { frequency: 523.25, delay: 0.42, duration: 0.24, volume: 0.045, type: 'triangle' },
    { frequency: 698.46, delay: 0.56, duration: 0.32, volume: 0.04, type: 'triangle' },
    { frequency: 587.33, delay: 0.76, duration: 0.42, volume: 0.04, type: 'triangle' },
    { frequency: 293.66, delay: 0, duration: 1.15, volume: 0.018, type: 'sine' },
  ],
};

const MAY_THE_FOURTH_TIMER_SOUND: ITimerSoundPreset = {
  id: 'may-the-fourth-march',
  notes: [
    { frequency: 196.0, delay: 0, duration: 0.34, volume: 0.05, type: 'sawtooth' },
    { frequency: 196.0, delay: 0.38, duration: 0.34, volume: 0.05, type: 'sawtooth' },
    { frequency: 196.0, delay: 0.76, duration: 0.34, volume: 0.05, type: 'sawtooth' },
    { frequency: 233.08, delay: 1.16, duration: 0.26, volume: 0.04, type: 'sawtooth' },
    { frequency: 293.66, delay: 1.48, duration: 0.26, volume: 0.04, type: 'sawtooth' },
    { frequency: 196.0, delay: 1.82, duration: 0.44, volume: 0.05, type: 'sawtooth' },
    { frequency: 146.83, delay: 0, duration: 2.3, volume: 0.02, type: 'triangle' },
  ],
};

function getAudioContext(): AudioContext {
  if (typeof window === 'undefined' || !('AudioContext' in window)) {
    throw new Error('Web Audio API is only available in supported browsers');
  }

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
 * Plays a single oscillator tone with smooth envelope
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: TimerSoundType = 'sine'
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
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
 * Selects the synthesized timer sound preset for the current day.
 */
export function getTimerSoundPreset(date = new Date()): ITimerSoundPreset {
  const month = date.getMonth() + 1;

  if (month === 4 && date.getDate() === 1) {
    return APRIL_FOOLS_TIMER_SOUND;
  }

  if (month === 5 && date.getDate() === 4) {
    return MAY_THE_FOURTH_TIMER_SOUND;
  }

  return DEFAULT_TIMER_SOUND;
}

function playPreset(preset: ITimerSoundPreset): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    for (const note of preset.notes) {
      playTone(
        ctx,
        note.frequency,
        now + note.delay,
        note.duration,
        note.volume,
        note.type ?? 'sine'
      );
    }
  } catch {
    // Audio not available — fail silently
  }
}

/**
 * Composable providing the timer chime
 */
export function useTimerSound() {
  function playChime(date = new Date()): void {
    playPreset(getTimerSoundPreset(date));
  }

  return { playChime };
}

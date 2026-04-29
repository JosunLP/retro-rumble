/**
 * Shared types for synthesized timer sound presets.
 */

export type TimerSoundPresetId =
  | 'default-chime'
  | 'april-fools-riff'
  | 'may-the-fourth-march';

export type TimerSoundType = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface ITimerSoundNote {
  frequency: number;
  delay: number;
  duration: number;
  volume: number;
  type?: TimerSoundType;
}

export interface ITimerSoundPreset {
  id: TimerSoundPresetId;
  notes: ITimerSoundNote[];
}

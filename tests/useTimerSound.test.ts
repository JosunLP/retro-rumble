import { describe, expect, test } from 'bun:test';

import { getTimerSoundPreset } from '../app/composables/useTimerSound';

describe('getTimerSoundPreset', () => {
  test('returns april fools riff on April 1st', () => {
    const preset = getTimerSoundPreset(new Date('2026-04-01T12:00:00Z'));

    expect(preset.id).toBe('april-fools-riff');
  });

  test('returns may the fourth march on May 4th', () => {
    const preset = getTimerSoundPreset(new Date('2026-05-04T12:00:00Z'));

    expect(preset.id).toBe('may-the-fourth-march');
  });

  test('returns the default chime on other days', () => {
    const preset = getTimerSoundPreset(new Date('2026-04-28T12:00:00Z'));

    expect(preset.id).toBe('default-chime');
    expect(preset.notes).toHaveLength(4);
  });
});

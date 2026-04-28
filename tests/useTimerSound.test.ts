import { describe, expect, test } from 'bun:test';

import { getTimerSoundPreset } from '../app/composables/useTimerSound';

describe('getTimerSoundPreset', () => {
  test('returns april fools riff on April 1st', () => {
    const preset = getTimerSoundPreset(new Date(2026, 3, 1, 12));

    expect(preset.id).toBe('april-fools-riff');
  });

  test('returns may the fourth march on May 4th', () => {
    const preset = getTimerSoundPreset(new Date(2026, 4, 4, 12));

    expect(preset.id).toBe('may-the-fourth-march');
  });

  test('returns the default chime on other days', () => {
    const preset = getTimerSoundPreset(new Date(2026, 3, 28, 12));

    expect(preset.id).toBe('default-chime');
    expect(preset.notes).toHaveLength(4);
  });
});

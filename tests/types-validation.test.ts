/**
 * Tests for type validation utilities in app/types/retro.ts
 */
import { describe, expect, test } from 'bun:test';
import {
    CHECK_IN_MOODS,
    countVotesForParticipant,
    formatJoinCode,
    isValidCheckInMood,
    isValidColumnType,
    isValidISODate,
    isValidJoinCode,
    isValidPhase,
    JOIN_CODE_CHARS,
    JOIN_CODE_LENGTH,
    MAX_ACTION_ITEM_TEXT_LENGTH,
    MAX_CARD_CONTENT_LENGTH,
    MAX_GROUP_TITLE_LENGTH,
    MAX_PARTICIPANT_NAME_LENGTH,
    MAX_SESSION_NAME_LENGTH,
    RETRO_COLUMNS,
    RETRO_PHASES,
} from '../app/types/retro';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('JOIN_CODE_LENGTH is 6', () => {
    expect(JOIN_CODE_LENGTH).toBe(6);
  });

  test('JOIN_CODE_CHARS does not include confusable characters', () => {
    // Must not include O, 0, I, 1, l
    expect(JOIN_CODE_CHARS).not.toContain('O');
    expect(JOIN_CODE_CHARS).not.toContain('0');
    expect(JOIN_CODE_CHARS).not.toContain('I');
    expect(JOIN_CODE_CHARS).not.toContain('1');
    expect(JOIN_CODE_CHARS).not.toContain('l');
  });

  test('MAX_CARD_CONTENT_LENGTH is a positive integer', () => {
    expect(MAX_CARD_CONTENT_LENGTH).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_CARD_CONTENT_LENGTH)).toBe(true);
  });

  test('MAX_PARTICIPANT_NAME_LENGTH is a positive integer', () => {
    expect(MAX_PARTICIPANT_NAME_LENGTH).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_PARTICIPANT_NAME_LENGTH)).toBe(true);
  });

  test('MAX_SESSION_NAME_LENGTH is a positive integer', () => {
    expect(MAX_SESSION_NAME_LENGTH).toBeGreaterThan(0);
  });

  test('MAX_GROUP_TITLE_LENGTH is a positive integer', () => {
    expect(MAX_GROUP_TITLE_LENGTH).toBeGreaterThan(0);
  });

  test('MAX_ACTION_ITEM_TEXT_LENGTH is a positive integer', () => {
    expect(MAX_ACTION_ITEM_TEXT_LENGTH).toBeGreaterThan(0);
  });

  test('RETRO_COLUMNS contains expected entries', () => {
    expect(RETRO_COLUMNS).toContain('went-well');
    expect(RETRO_COLUMNS).toContain('to-improve');
    expect(RETRO_COLUMNS).toContain('action-items');
  });

  test('RETRO_PHASES contains all expected phases', () => {
    const expected = [
      'set-the-stage',
      'gather-data',
      'generate-insights',
      'voting',
      'decide-action',
      'close-retro',
    ];
    for (const phase of expected) {
      expect(RETRO_PHASES).toContain(phase);
    }
  });

  test('CHECK_IN_MOODS contains at least 3 emoji entries', () => {
    expect(CHECK_IN_MOODS.length).toBeGreaterThanOrEqual(3);
    // Each entry must be a non-empty string
    for (const mood of CHECK_IN_MOODS) {
      expect(typeof mood).toBe('string');
      expect(mood.length).toBeGreaterThan(0);
    }
  });
});

// ─── isValidJoinCode ──────────────────────────────────────────────────────────

describe('isValidJoinCode()', () => {
  test('returns true for a valid 6-char code', () => {
    // Build a valid code from the allowed charset
    const valid = JOIN_CODE_CHARS.slice(0, 6);
    expect(isValidJoinCode(valid)).toBe(true);
  });

  test('returns false when code is too short', () => {
    expect(isValidJoinCode('ABC')).toBe(false);
  });

  test('returns false when code is too long', () => {
    expect(isValidJoinCode('ABCDEFG')).toBe(false);
  });

  test('returns false when code contains confusable characters', () => {
    expect(isValidJoinCode('ABCDE0')).toBe(false); // 0 not allowed
    expect(isValidJoinCode('ABCDEО')).toBe(false); // Cyrillic O lookalike
  });

  test('returns false for lowercase input', () => {
    const lower = JOIN_CODE_CHARS.slice(0, 6).toLowerCase();
    expect(isValidJoinCode(lower)).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isValidJoinCode('')).toBe(false);
  });
});

// ─── formatJoinCode ───────────────────────────────────────────────────────────

describe('formatJoinCode()', () => {
  test('uppercases the input', () => {
    expect(formatJoinCode('abcdef')).toBe('ABCDEF');
  });

  test('strips non-alphanumeric characters', () => {
    expect(formatJoinCode('AB-CD EF')).toBe('ABCDEF');
  });

  test('slices to JOIN_CODE_LENGTH', () => {
    const long = 'ABCDEFGHIJ';
    expect(formatJoinCode(long)).toHaveLength(JOIN_CODE_LENGTH);
  });

  test('returns empty string for empty input', () => {
    expect(formatJoinCode('')).toBe('');
  });
});

// ─── isValidColumnType ────────────────────────────────────────────────────────

describe('isValidColumnType()', () => {
  test('returns true for each defined column', () => {
    for (const column of RETRO_COLUMNS) {
      expect(isValidColumnType(column)).toBe(true);
    }
  });

  test('returns false for an unknown string', () => {
    expect(isValidColumnType('unknown-column')).toBe(false);
  });

  test('returns false for non-string types', () => {
    expect(isValidColumnType(42)).toBe(false);
    expect(isValidColumnType(null)).toBe(false);
    expect(isValidColumnType(undefined)).toBe(false);
    expect(isValidColumnType({})).toBe(false);
  });
});

// ─── isValidCheckInMood ───────────────────────────────────────────────────────

describe('isValidCheckInMood()', () => {
  test('returns true for each defined mood', () => {
    for (const mood of CHECK_IN_MOODS) {
      expect(isValidCheckInMood(mood)).toBe(true);
    }
  });

  test('returns false for a plain-text mood string not in the list', () => {
    expect(isValidCheckInMood('happy')).toBe(false);
    expect(isValidCheckInMood('excited')).toBe(false);
  });

  test('returns false for non-string types', () => {
    expect(isValidCheckInMood(1)).toBe(false);
    expect(isValidCheckInMood(null)).toBe(false);
    expect(isValidCheckInMood(undefined)).toBe(false);
  });
});

// ─── isValidPhase ─────────────────────────────────────────────────────────────

describe('isValidPhase()', () => {
  test('returns true for each defined phase', () => {
    for (const phase of RETRO_PHASES) {
      expect(isValidPhase(phase)).toBe(true);
    }
  });

  test('returns false for an unknown string', () => {
    expect(isValidPhase('brainstorming')).toBe(false);
    expect(isValidPhase('writing')).toBe(false);
    expect(isValidPhase('')).toBe(false);
  });

  test('returns false for non-string types', () => {
    expect(isValidPhase(42)).toBe(false);
    expect(isValidPhase(null)).toBe(false);
    expect(isValidPhase(undefined)).toBe(false);
    expect(isValidPhase({})).toBe(false);
  });
});

// ─── isValidISODate ───────────────────────────────────────────────────────────

describe('isValidISODate()', () => {
  test('returns true for valid YYYY-MM-DD dates', () => {
    expect(isValidISODate('2025-01-15')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // leap year
    expect(isValidISODate('2000-12-31')).toBe(true);
  });

  test('returns false for non-existent calendar dates', () => {
    expect(isValidISODate('2025-02-29')).toBe(false); // not a leap year
    expect(isValidISODate('2025-04-31')).toBe(false); // April has 30 days
    expect(isValidISODate('2025-13-01')).toBe(false); // month 13
    expect(isValidISODate('2025-00-01')).toBe(false); // month 00
  });

  test('returns false for wrong format', () => {
    expect(isValidISODate('15-01-2025')).toBe(false);
    expect(isValidISODate('01/15/2025')).toBe(false);
    expect(isValidISODate('2025-1-5')).toBe(false);
    expect(isValidISODate('2025/01/15')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });

  test('returns false for date with trailing content', () => {
    expect(isValidISODate('2025-01-15T00:00:00Z')).toBe(false);
    expect(isValidISODate('2025-01-15 extra')).toBe(false);
  });
});

// ─── countVotesForParticipant ────────────────────────────────────────────────

describe('countVotesForParticipant()', () => {
  const user = 'user-1';

  test('returns 0 when there are no cards or groups', () => {
    expect(countVotesForParticipant([], [], user)).toBe(0);
  });

  test('counts votes across cards', () => {
    const cards = [
      { voterIds: [user, 'other'] },
      { voterIds: [user] },
      { voterIds: ['other'] },
    ];
    expect(countVotesForParticipant(cards, [], user)).toBe(2);
  });

  test('counts votes across groups', () => {
    const groups = [
      { voterIds: [user] },
      { voterIds: [user, user] }, // user voted twice for same group
    ];
    expect(countVotesForParticipant([], groups, user)).toBe(3);
  });

  test('counts combined card and group votes', () => {
    const cards = [{ voterIds: [user] }];
    const groups = [{ voterIds: [user] }];
    expect(countVotesForParticipant(cards, groups, user)).toBe(2);
  });

  test('returns 0 when participant has no votes', () => {
    const cards = [{ voterIds: ['other-1', 'other-2'] }];
    const groups = [{ voterIds: ['other-3'] }];
    expect(countVotesForParticipant(cards, groups, user)).toBe(0);
  });
});

/**
 * Tests for type validation utilities in app/types/retro.ts
 */
import { describe, expect, test } from 'bun:test';
import {
    CHECK_IN_MOODS,
    countGroupVotesForParticipant,
    countVotesForParticipant,
    DEFAULT_MAX_VOTES_PER_USER,
    formatJoinCode,
    getTodayISODate,
    getTodayISODateUTC,
    getYesterdayISODateUTC,
    isPastISODate,
    isValidCheckInMood,
    isValidColumnType,
    isValidISODate,
    isValidJoinCode,
    isValidPhase,
    JOIN_CODE_CHARS,
    JOIN_CODE_LENGTH,
    MAX_ACTION_ITEM_TEXT_LENGTH,
    MAX_CARD_CONTENT_LENGTH,
    MAX_MAX_VOTES_PER_USER,
    MAX_GROUP_TITLE_LENGTH,
    MAX_PARTICIPANT_NAME_LENGTH,
    MAX_SESSION_NAME_LENGTH,
    MIN_MAX_VOTES_PER_USER,
    normalizePhase,
    RETRO_COLUMNS,
    RETRO_PHASES,
    sanitizeMaxVotesPerUser,
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
      'discuss-topics',
      'cluster-cards',
      'name-groups',
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

  test('returns false for unknown strings and inherited object keys', () => {
    expect(isValidPhase('brainstorming')).toBe(false);
    expect(isValidPhase('writing')).toBe(false);
    expect(isValidPhase('generate-insights')).toBe(false);
    expect(isValidPhase('toString')).toBe(false);
    expect(isValidPhase('constructor')).toBe(false);
    expect(isValidPhase('')).toBe(false);
  });

  test('returns false for non-string types', () => {
    expect(isValidPhase(42)).toBe(false);
    expect(isValidPhase(null)).toBe(false);
    expect(isValidPhase(undefined)).toBe(false);
    expect(isValidPhase({})).toBe(false);
  });
});

// ─── normalizePhase ────────────────────────────────────────────────────────────

describe('normalizePhase()', () => {
  test('returns the canonical phase for each defined phase', () => {
    for (const phase of RETRO_PHASES) {
      expect(normalizePhase(phase)).toBe(phase);
    }
  });

  test('maps legacy generate-insights to cluster-cards', () => {
    expect(normalizePhase('generate-insights')).toBe('cluster-cards');
  });

  test('returns null for unknown strings', () => {
    expect(normalizePhase('brainstorming')).toBeNull();
    expect(normalizePhase('writing')).toBeNull();
    expect(normalizePhase('')).toBeNull();
  });

  test('returns null for non-string types', () => {
    expect(normalizePhase(42)).toBeNull();
    expect(normalizePhase(null)).toBeNull();
    expect(normalizePhase(undefined)).toBeNull();
    expect(normalizePhase({})).toBeNull();
  });

  test('returns null for inherited Object.prototype property names', () => {
    expect(normalizePhase('toString')).toBeNull();
    expect(normalizePhase('constructor')).toBeNull();
    expect(normalizePhase('__proto__')).toBeNull();
    expect(normalizePhase('hasOwnProperty')).toBeNull();
    expect(normalizePhase('valueOf')).toBeNull();
  });
});

describe('date helpers', () => {
  test('getTodayISODate returns local YYYY-MM-DD', () => {
    expect(getTodayISODate(new Date('2026-03-09T12:34:56'))).toBe('2026-03-09');
  });

  test('getTodayISODateUTC returns UTC YYYY-MM-DD', () => {
    expect(getTodayISODateUTC(new Date('2026-03-09T23:30:00-05:00'))).toBe('2026-03-10');
  });

  test('getYesterdayISODateUTC returns the UTC date one day before the given instant', () => {
    // At 2026-03-10 UTC, yesterday UTC is 2026-03-09
    expect(getYesterdayISODateUTC(new Date('2026-03-10T00:00:00Z'))).toBe('2026-03-09');
    // At 2026-03-10T23:59Z, yesterday UTC is still 2026-03-09
    expect(getYesterdayISODateUTC(new Date('2026-03-10T23:59:00Z'))).toBe('2026-03-09');
    // Crosses month boundary correctly
    expect(getYesterdayISODateUTC(new Date('2026-03-01T12:00:00Z'))).toBe('2026-02-28');
  });

  test('isPastISODate detects dates before today', () => {
    expect(isPastISODate('2026-03-08', '2026-03-09')).toBe(true);
    expect(isPastISODate('2026-03-09', '2026-03-09')).toBe(false);
  });
});

describe('sanitizeMaxVotesPerUser()', () => {
  test('returns default when value is missing or non-finite', () => {
    expect(sanitizeMaxVotesPerUser(undefined)).toBe(DEFAULT_MAX_VOTES_PER_USER);
    expect(sanitizeMaxVotesPerUser(Number.NaN)).toBe(DEFAULT_MAX_VOTES_PER_USER);
    expect(sanitizeMaxVotesPerUser(Number.POSITIVE_INFINITY)).toBe(DEFAULT_MAX_VOTES_PER_USER);
  });

  test('rounds valid values to the nearest integer', () => {
    expect(sanitizeMaxVotesPerUser(4.6)).toBe(5);
  });

  test('clamps values below the minimum', () => {
    expect(sanitizeMaxVotesPerUser(0)).toBe(MIN_MAX_VOTES_PER_USER);
  });

  test('clamps values above the maximum', () => {
    expect(sanitizeMaxVotesPerUser(999)).toBe(MAX_MAX_VOTES_PER_USER);
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

describe('countGroupVotesForParticipant()', () => {
  test('counts only group votes for voting budget usage', () => {
    const user = 'user-1';
    const groups = [
      { voterIds: [user] },
      { voterIds: [user, user] },
    ];
    expect(countGroupVotesForParticipant(groups, user)).toBe(3);
  });
});

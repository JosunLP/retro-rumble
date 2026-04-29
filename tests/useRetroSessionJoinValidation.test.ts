import { describe, expect, test } from 'bun:test';
import { getJoinCodeErrorKey, normalizeValidJoinCode } from '../app/utils/joinCode';

describe('joinCode validation helpers', () => {
  test('returns a length error for short join codes', () => {
    expect(getJoinCodeErrorKey('ABC23')).toBe('errors.joinCodeLength');
  });

  test('returns an invalid-code error for disallowed join code characters', () => {
    expect(getJoinCodeErrorKey('abcde0')).toBe('errors.invalidJoinCode');
    expect(getJoinCodeErrorKey('abcde1')).toBe('errors.invalidJoinCode');
  });

  test('returns a normalized join code when it contains only allowed characters', () => {
    expect(normalizeValidJoinCode('ab-cd23')).toBe('ABCD23');
    expect(normalizeValidJoinCode('abc234')).toBe('ABC234');
  });

  test('returns null when the normalized join code contains disallowed characters', () => {
    expect(normalizeValidJoinCode('abcde0')).toBeNull();
    expect(normalizeValidJoinCode('abcde1')).toBeNull();
    expect(normalizeValidJoinCode('abcdei')).toBeNull();
    expect(normalizeValidJoinCode('abcdeo')).toBeNull();
  });

  test('returns null when the normalized join code is too short', () => {
    expect(normalizeValidJoinCode('ABC23')).toBeNull();
  });

  test('truncates longer input before validating the join code', () => {
    expect(normalizeValidJoinCode('ABCDEFG')).toBe('ABCDEF');
  });
});

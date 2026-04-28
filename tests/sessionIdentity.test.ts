import { describe, expect, test } from 'bun:test';
import {
  clearStoredSessionIdentity,
  normalizeJoinCode,
  parseStoredSessionIdentity,
  readStoredSessionIdentity,
  SESSION_IDENTITY_STORAGE_KEY,
  storeSessionIdentity,
} from '../app/utils/sessionIdentity';

function makeStorage() {
  const data = new Map<string, string>();

  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe('sessionIdentity utils', () => {
  test('normalizes route join codes from strings and arrays', () => {
    expect(normalizeJoinCode('ab-c12x')).toBe('ABC12X');
    expect(normalizeJoinCode(['zy 98qp', 'ignored'])).toBe('ZY98QP');
    expect(normalizeJoinCode(undefined)).toBe('');
  });

  test('stores and restores a participant identity', () => {
    const storage = makeStorage();

    storeSessionIdentity(storage, {
      joinCode: 'abc123',
      participant: {
        id: 'participant-1',
        name: 'Alex',
        isHost: false,
        joinedAt: new Date('2026-04-28T10:00:00Z'),
      },
    });

    const restored = readStoredSessionIdentity(storage);

    expect(restored).toEqual({
      joinCode: 'ABC123',
      participant: {
        id: 'participant-1',
        name: 'Alex',
        isHost: false,
        joinedAt: new Date('2026-04-28T10:00:00Z'),
      },
    });
  });

  test('returns null for malformed stored session identity data', () => {
    expect(parseStoredSessionIdentity('{')).toBeNull();
    expect(
      parseStoredSessionIdentity(
        JSON.stringify({
          joinCode: 'ABC123',
          participant: {
            id: 'participant-1',
            name: 'Alex',
            isHost: false,
            joinedAt: 'not-a-date',
          },
        })
      )
    ).toBeNull();
  });

  test('clears the stored session identity', () => {
    const storage = makeStorage();

    storage.setItem(SESSION_IDENTITY_STORAGE_KEY, 'value');
    clearStoredSessionIdentity(storage);

    expect(storage.getItem(SESSION_IDENTITY_STORAGE_KEY)).toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';
import {
  clearStoredSessionIdentity,
  getSessionIdentityStorageKey,
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

  test('stores and restores participant identities scoped by join code', () => {
    const storage = makeStorage();

    storeSessionIdentity(storage, {
      joinCode: 'abc234',
      participant: {
        id: 'participant-1',
        name: 'Alex',
        isHost: false,
        joinedAt: new Date('2026-04-28T10:00:00Z'),
      },
    });
    storeSessionIdentity(storage, {
      joinCode: 'xyz789',
      participant: {
        id: 'participant-2',
        name: 'Taylor',
        isHost: true,
        joinedAt: new Date('2026-04-28T11:00:00Z'),
      },
    });

    const restoredLatest = readStoredSessionIdentity(storage);
    const restoredScoped = readStoredSessionIdentity(storage, 'abc234');

    expect(storage.getItem(SESSION_IDENTITY_STORAGE_KEY)).toBe('XYZ789');
    expect(storage.getItem(getSessionIdentityStorageKey('abc234'))).not.toBeNull();
    expect(storage.getItem(getSessionIdentityStorageKey('xyz789'))).not.toBeNull();

    expect(restoredLatest).toEqual({
      joinCode: 'XYZ789',
      participant: {
        id: 'participant-2',
        name: 'Taylor',
        isHost: true,
        joinedAt: new Date('2026-04-28T11:00:00Z'),
      },
    });

    expect(restoredScoped).toEqual({
      joinCode: 'ABC234',
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
          joinCode: 'ABC12',
          participant: {
            id: 'participant-1',
            name: 'Alex',
            isHost: false,
            joinedAt: '2026-04-28T10:00:00Z',
          },
        })
      )
    ).toBeNull();
    expect(
      parseStoredSessionIdentity(
        JSON.stringify({
          joinCode: 'ABC234',
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

  test('does not fall back to legacy data when scoped storage is malformed', () => {
    const storage = makeStorage();

    storage.setItem(
      SESSION_IDENTITY_STORAGE_KEY,
      JSON.stringify({
        joinCode: 'ABC234',
        participant: {
          id: 'participant-1',
          name: 'Alex',
          isHost: false,
          joinedAt: '2026-04-28T10:00:00Z',
        },
      })
    );
    storage.setItem(getSessionIdentityStorageKey('abc234'), '{');

    expect(readStoredSessionIdentity(storage, 'abc234')).toBeNull();
  });

  test('clears only the targeted stored session identity', () => {
    const storage = makeStorage();

    storeSessionIdentity(storage, {
      joinCode: 'abc234',
      participant: {
        id: 'participant-1',
        name: 'Alex',
        isHost: false,
        joinedAt: new Date('2026-04-28T10:00:00Z'),
      },
    });
    storeSessionIdentity(storage, {
      joinCode: 'xyz789',
      participant: {
        id: 'participant-2',
        name: 'Taylor',
        isHost: false,
        joinedAt: new Date('2026-04-28T11:00:00Z'),
      },
    });

    clearStoredSessionIdentity(storage, 'xyz789');

    expect(storage.getItem(SESSION_IDENTITY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(getSessionIdentityStorageKey('xyz789'))).toBeNull();
    expect(readStoredSessionIdentity(storage, 'abc234')).toEqual({
      joinCode: 'ABC234',
      participant: {
        id: 'participant-1',
        name: 'Alex',
        isHost: false,
        joinedAt: new Date('2026-04-28T10:00:00Z'),
      },
    });
  });

  test('clears the latest pointer when it still contains legacy JSON for the same join code', () => {
    const storage = makeStorage();

    storage.setItem(
      SESSION_IDENTITY_STORAGE_KEY,
      JSON.stringify({
        joinCode: 'ABC234',
        participant: {
          id: 'participant-1',
          name: 'Alex',
          isHost: false,
          joinedAt: '2026-04-28T10:00:00Z',
        },
      })
    );
    storage.setItem(
      getSessionIdentityStorageKey('abc234'),
      JSON.stringify({
        joinCode: 'ABC234',
        participant: {
          id: 'participant-1',
          name: 'Alex',
          isHost: false,
          joinedAt: '2026-04-28T10:00:00Z',
        },
      })
    );

    clearStoredSessionIdentity(storage, 'abc234');

    expect(storage.getItem(SESSION_IDENTITY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(getSessionIdentityStorageKey('abc234'))).toBeNull();
  });

  test('ignores storage access failures when reading, storing, and clearing session identity', () => {
    const throwingStorage = {
      getItem() {
        throw new Error('storage disabled');
      },
      setItem() {
        throw new Error('storage disabled');
      },
      removeItem() {
        throw new Error('storage disabled');
      },
    };

    expect(readStoredSessionIdentity(throwingStorage, 'abc234')).toBeNull();
    expect(() =>
      storeSessionIdentity(throwingStorage, {
        joinCode: 'abc234',
        participant: {
          id: 'participant-1',
          name: 'Alex',
          isHost: false,
          joinedAt: new Date('2026-04-28T10:00:00Z'),
        },
      })
    ).not.toThrow();
    expect(() =>
      clearStoredSessionIdentity(throwingStorage, 'abc234')
    ).not.toThrow();
  });
});

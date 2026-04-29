import { formatJoinCode, isValidJoinCode, type IParticipant } from '../types';

export const SESSION_IDENTITY_STORAGE_KEY = 'retro-rumble.session-identity';

export interface IStoredSessionIdentity {
  joinCode: string;
  participant: IParticipant;
}

/**
 * Raw participant record stored in localStorage before joinedAt is revived.
 */
interface IStoredParticipantRecord {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
}

/**
 * Raw session identity record used only for deserialization/type guards.
 */
interface IStoredSessionIdentityRecord {
  joinCode: string;
  participant: IStoredParticipantRecord;
}

type StorageReader = Pick<Storage, 'getItem'>;
type StorageAccessor = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Normalizes join-code values that may come from route/query storage inputs.
 */
export function normalizeJoinCode(
  value: string | string[] | null | undefined
): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue ? formatJoinCode(rawValue) : '';
}

export function getSessionIdentityStorageKey(joinCode: string): string {
  return `${SESSION_IDENTITY_STORAGE_KEY}.${normalizeJoinCode(joinCode)}`;
}

function isStoredParticipantRecord(
  value: unknown
): value is IStoredParticipantRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    'id' in record
    && 'name' in record
    && 'isHost' in record
    && 'joinedAt' in record
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.isHost === 'boolean'
    && typeof record.joinedAt === 'string'
  );
}

function isStoredSessionIdentityRecord(
  value: unknown
): value is IStoredSessionIdentityRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    'joinCode' in record
    && 'participant' in record
    && typeof record.joinCode === 'string'
    && isStoredParticipantRecord(record.participant)
  );
}

function safeGetItem(storage: StorageReader, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: StorageAccessor, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage: StorageAccessor, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    return;
  }
}

function getLatestStoredJoinCode(storage: StorageReader): string | null {
  const latestValue = safeGetItem(storage, SESSION_IDENTITY_STORAGE_KEY);
  const legacyIdentity = parseStoredSessionIdentity(latestValue);

  if (legacyIdentity) {
    return legacyIdentity.joinCode;
  }

  const latestJoinCode = normalizeJoinCode(latestValue);
  return isValidJoinCode(latestJoinCode) ? latestJoinCode : null;
}

export function parseStoredSessionIdentity(
  value: string | null
): IStoredSessionIdentity | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isStoredSessionIdentityRecord(parsed)) {
      return null;
    }

    const joinCode = formatJoinCode(parsed.joinCode);
    const participant = parsed.participant;

    if (!isValidJoinCode(joinCode)) {
      return null;
    }

    const joinedAt = new Date(participant.joinedAt);
    if (Number.isNaN(joinedAt.getTime())) {
      return null;
    }

    return {
      joinCode,
      participant: {
        id: participant.id,
        name: participant.name,
        isHost: participant.isHost,
        joinedAt,
      },
    };
  } catch {
    return null;
  }
}

export function readStoredSessionIdentity(
  storage: StorageReader,
  joinCode?: string
): IStoredSessionIdentity | null {
  const normalizedJoinCode = normalizeJoinCode(joinCode);

  if (isValidJoinCode(normalizedJoinCode)) {
    const scopedStorageValue = safeGetItem(
      storage,
      getSessionIdentityStorageKey(normalizedJoinCode)
    );
    if (scopedStorageValue !== null) {
      return parseStoredSessionIdentity(scopedStorageValue);
    }

    const legacyIdentity = parseStoredSessionIdentity(
      safeGetItem(storage, SESSION_IDENTITY_STORAGE_KEY)
    );
    return legacyIdentity?.joinCode === normalizedJoinCode
      ? legacyIdentity
      : null;
  }

  const latestJoinCode = getLatestStoredJoinCode(storage);

  if (latestJoinCode) {
    return parseStoredSessionIdentity(
      safeGetItem(storage, getSessionIdentityStorageKey(latestJoinCode))
    );
  }

  return parseStoredSessionIdentity(
    safeGetItem(storage, SESSION_IDENTITY_STORAGE_KEY)
  );
}

export function storeSessionIdentity(
  storage: StorageAccessor,
  identity: IStoredSessionIdentity
): void {
  const joinCode = normalizeJoinCode(identity.joinCode);
  if (!isValidJoinCode(joinCode)) {
    return;
  }

  const scopedStorageKey = getSessionIdentityStorageKey(joinCode);
  const scopedStorageValue = JSON.stringify({
    ...identity,
    joinCode,
  });

  const storedScopedIdentity = safeSetItem(
    storage,
    scopedStorageKey,
    scopedStorageValue
  );
  if (!storedScopedIdentity) {
    return;
  }

  const storedLatestJoinCode = safeSetItem(
    storage,
    SESSION_IDENTITY_STORAGE_KEY,
    joinCode
  );

  if (!storedLatestJoinCode) {
    safeRemoveItem(storage, scopedStorageKey);
  }
}

export function clearStoredSessionIdentity(
  storage: StorageAccessor,
  joinCode?: string
): void {
  const normalizedJoinCode = normalizeJoinCode(joinCode);

  if (isValidJoinCode(normalizedJoinCode)) {
    safeRemoveItem(storage, getSessionIdentityStorageKey(normalizedJoinCode));

    const latestJoinCode = getLatestStoredJoinCode(storage);

    if (latestJoinCode === normalizedJoinCode) {
      safeRemoveItem(storage, SESSION_IDENTITY_STORAGE_KEY);
      return;
    }

    const legacyIdentity = parseStoredSessionIdentity(
      safeGetItem(storage, SESSION_IDENTITY_STORAGE_KEY)
    );
    if (legacyIdentity?.joinCode === normalizedJoinCode) {
      safeRemoveItem(storage, SESSION_IDENTITY_STORAGE_KEY);
    }

    return;
  }

  const latestJoinCode = getLatestStoredJoinCode(storage);
  if (latestJoinCode) {
    safeRemoveItem(storage, getSessionIdentityStorageKey(latestJoinCode));
  }

  safeRemoveItem(storage, SESSION_IDENTITY_STORAGE_KEY);
}

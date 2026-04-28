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
type StorageWriter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
  return (
    typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'name' in value
    && 'isHost' in value
    && 'joinedAt' in value
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.isHost === 'boolean'
    && typeof value.joinedAt === 'string'
  );
}

function isStoredSessionIdentityRecord(
  value: unknown
): value is IStoredSessionIdentityRecord {
  return (
    typeof value === 'object'
    && value !== null
    && 'joinCode' in value
    && 'participant' in value
    && typeof value.joinCode === 'string'
    && isStoredParticipantRecord(value.participant)
  );
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
    const scopedStorageValue = storage.getItem(
      getSessionIdentityStorageKey(normalizedJoinCode)
    );
    if (scopedStorageValue !== null) {
      return parseStoredSessionIdentity(scopedStorageValue);
    }

    const legacyIdentity = parseStoredSessionIdentity(
      storage.getItem(SESSION_IDENTITY_STORAGE_KEY)
    );
    return legacyIdentity?.joinCode === normalizedJoinCode
      ? legacyIdentity
      : null;
  }

  const latestJoinCode = normalizeJoinCode(storage.getItem(SESSION_IDENTITY_STORAGE_KEY));

  if (isValidJoinCode(latestJoinCode)) {
    return parseStoredSessionIdentity(
      storage.getItem(getSessionIdentityStorageKey(latestJoinCode))
    );
  }

  return parseStoredSessionIdentity(
    storage.getItem(SESSION_IDENTITY_STORAGE_KEY)
  );
}

export function storeSessionIdentity(
  storage: StorageWriter,
  identity: IStoredSessionIdentity
): void {
  const joinCode = normalizeJoinCode(identity.joinCode);
  if (!isValidJoinCode(joinCode)) {
    return;
  }

  storage.setItem(
    getSessionIdentityStorageKey(joinCode),
    JSON.stringify({
      ...identity,
      joinCode,
    })
  );
  storage.setItem(SESSION_IDENTITY_STORAGE_KEY, joinCode);
}

export function clearStoredSessionIdentity(
  storage: StorageWriter,
  joinCode?: string
): void {
  const normalizedJoinCode = normalizeJoinCode(joinCode);

  if (isValidJoinCode(normalizedJoinCode)) {
    storage.removeItem(getSessionIdentityStorageKey(normalizedJoinCode));

    const latestJoinCode = normalizeJoinCode(storage.getItem(SESSION_IDENTITY_STORAGE_KEY));

    if (latestJoinCode === normalizedJoinCode) {
      storage.removeItem(SESSION_IDENTITY_STORAGE_KEY);
      return;
    }

    const legacyIdentity = parseStoredSessionIdentity(
      storage.getItem(SESSION_IDENTITY_STORAGE_KEY)
    );
    if (legacyIdentity?.joinCode === normalizedJoinCode) {
      storage.removeItem(SESSION_IDENTITY_STORAGE_KEY);
    }

    return;
  }

  const latestJoinCode = normalizeJoinCode(storage.getItem(SESSION_IDENTITY_STORAGE_KEY));
  if (isValidJoinCode(latestJoinCode)) {
    storage.removeItem(getSessionIdentityStorageKey(latestJoinCode));
  }

  storage.removeItem(SESSION_IDENTITY_STORAGE_KEY);
}

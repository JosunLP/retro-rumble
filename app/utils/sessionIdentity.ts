import { formatJoinCode, type IParticipant } from '../types';

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
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;

/**
 * Normalizes join-code values that may come from route/query storage inputs.
 */
export function normalizeJoinCode(
  value: string | string[] | null | undefined
): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue ? formatJoinCode(rawValue) : '';
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

    if (!joinCode) {
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
  storage: StorageReader
): IStoredSessionIdentity | null {
  return parseStoredSessionIdentity(
    storage.getItem(SESSION_IDENTITY_STORAGE_KEY)
  );
}

export function storeSessionIdentity(
  storage: StorageWriter,
  identity: IStoredSessionIdentity
): void {
  storage.setItem(
    SESSION_IDENTITY_STORAGE_KEY,
    JSON.stringify(identity)
  );
}

export function clearStoredSessionIdentity(storage: StorageWriter): void {
  storage.removeItem(SESSION_IDENTITY_STORAGE_KEY);
}

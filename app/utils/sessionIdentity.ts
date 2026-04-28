import type { IParticipant } from '../types/retro';

export const SESSION_IDENTITY_STORAGE_KEY = 'retro-rumble.session-identity';

export interface IStoredSessionIdentity {
  joinCode: string;
  participant: IParticipant;
}

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;

export function normalizeJoinCode(
  value: string | string[] | null | undefined
): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) ?? '';
}

export function parseStoredSessionIdentity(
  value: string | null
): IStoredSessionIdentity | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<IStoredSessionIdentity>;
    const joinCode = normalizeJoinCode(parsed.joinCode);
    const participant = parsed.participant;

    if (
      !joinCode
      || !participant
      || typeof participant.id !== 'string'
      || typeof participant.name !== 'string'
      || typeof participant.isHost !== 'boolean'
      || typeof participant.joinedAt !== 'string'
    ) {
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

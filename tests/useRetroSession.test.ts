import { describe, expect, test } from 'bun:test';
import {
  getMatchingStoredSessionIdentity,
  shouldRequireParticipantNameForJoin,
  type IStoredSessionIdentity,
} from '../app/utils/sessionIdentity';

const storedIdentity: IStoredSessionIdentity = {
  joinCode: 'ABC234',
  participant: {
    id: 'participant-1',
    name: 'Alex',
    isHost: false,
    joinedAt: new Date('2026-04-28T10:00:00Z'),
  },
};

describe('useRetroSession join helpers', () => {
  test('matches stored identity only for the same normalized join code', () => {
    expect(
      getMatchingStoredSessionIdentity('ABC234', storedIdentity)
    ).toEqual(storedIdentity);
    expect(
      getMatchingStoredSessionIdentity('XYZ789', storedIdentity)
    ).toBeNull();
  });

  test('does not require a participant name when rejoining with stored identity', () => {
    expect(
      shouldRequireParticipantNameForJoin('', storedIdentity)
    ).toBeFalse();
    expect(
      shouldRequireParticipantNameForJoin('   ', storedIdentity)
    ).toBeFalse();
  });

  test('still requires a participant name for manual join without stored identity', () => {
    expect(
      shouldRequireParticipantNameForJoin('', null)
    ).toBeTrue();
    expect(
      shouldRequireParticipantNameForJoin('   ', null)
    ).toBeTrue();
    expect(
      shouldRequireParticipantNameForJoin('Alex', null)
    ).toBeFalse();
  });
});

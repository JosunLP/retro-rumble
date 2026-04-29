import { describe, expect, test } from 'bun:test';
import type { IRetroSession, IRetroSessionSnapshot } from '../app/types/retro';
import { mergeSessionSnapshot } from '../app/utils/sessionState';

function makeSession(): IRetroSession {
  return {
    id: 'session-1',
    name: 'Retro',
    phase: 'name-groups',
    hostId: 'host-1',
    participants: [
      {
        id: 'host-1',
        name: 'Host',
        isHost: true,
        joinedAt: new Date('2026-03-09T10:00:00Z'),
      },
    ],
    cards: [
      {
        id: 'card-1',
        column: 'went-well',
        content: 'Keep daily sync short',
        authorId: 'host-1',
        votes: 0,
        voterIds: [],
        groupId: 'group-1',
        createdAt: new Date('2026-03-09T10:01:00Z'),
      },
      {
        id: 'card-2',
        column: 'went-well',
        content: 'Share blockers earlier',
        authorId: 'host-1',
        votes: 0,
        voterIds: [],
        groupId: 'group-1',
        createdAt: new Date('2026-03-09T10:02:00Z'),
      },
    ],
    groups: [
      {
        id: 'group-1',
        title: 'Communication',
        column: 'went-well',
        cardIds: ['card-1', 'card-2'],
        votes: 1,
        voterIds: ['host-1'],
        createdAt: new Date('2026-03-09T10:03:00Z'),
      },
    ],
    actionItems: [],
    checkInResponses: [],
    feedbackResponses: [],
    maxVotesPerUser: 5,
    timerDuration: 300,
    timerRemaining: null,
    timerRunning: false,
    createdAt: new Date('2026-03-09T10:00:00Z'),
    updatedAt: new Date('2026-03-09T10:03:00Z'),
  };
}

function makeSessionSnapshot(): IRetroSessionSnapshot {
  const session = makeSession();

  return {
    ...session,
    participants: session.participants.map((participant) => ({
      ...participant,
      joinedAt: participant.joinedAt.toISOString(),
    })),
    cards: session.cards.map((card) => ({
      ...card,
      createdAt: card.createdAt.toISOString(),
    })),
    groups: session.groups.map((group) => ({
      ...group,
      createdAt: group.createdAt.toISOString(),
    })),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

describe('mergeSessionSnapshot()', () => {
  test('normalizes snapshot timestamps while applying updated group titles', () => {
    const current = makeSession();
    const currentGroupRef = current.groups[0]!;
    const currentCardRef = current.cards[0]!;

    const incoming = makeSessionSnapshot();
    incoming.groups[0]!.title = 'Daily Collaboration';
    incoming.updatedAt = '2026-03-09T10:04:00.000Z';

    const merged = mergeSessionSnapshot(current, incoming);

    expect(merged).toBe(current);
    expect(merged.groups[0]).toBe(currentGroupRef);
    expect(merged.cards[0]).toBe(currentCardRef);
    expect(merged.groups[0]!.title).toBe('Daily Collaboration');
    expect(merged.updatedAt).toEqual(new Date('2026-03-09T10:04:00Z'));
    expect(merged.participants[0]!.joinedAt).toBeInstanceOf(Date);
  });

  test('normalizes legacy phase values during merge', () => {
    const current = makeSession();
    const incoming = {
      ...makeSession(),
      phase: 'generate-insights' as unknown as IRetroSession['phase'],
    };

    const merged = mergeSessionSnapshot(current, incoming);

    expect(merged.phase).toBe('cluster-cards');
  });

  test('ignores stale session snapshots so newer group titles are not reset', () => {
    const current = makeSession();
    current.groups[0]!.title = 'Renamed Group';
    current.updatedAt = new Date('2026-03-09T10:05:00.000Z');

    const incoming = makeSessionSnapshot();
    incoming.updatedAt = '2026-03-09T10:04:00.000Z';
    incoming.groups[0]!.title = 'Communication';

    const merged = mergeSessionSnapshot(current, incoming);

    expect(merged).toBe(current);
    expect(merged.groups[0]!.title).toBe('Renamed Group');
    expect(current.updatedAt).toEqual(new Date('2026-03-09T10:05:00.000Z'));
  });
});

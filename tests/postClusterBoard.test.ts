import { describe, expect, test } from 'bun:test';
import type { ICardGroup, IRetroCard } from '../app/types/retro';
import { getUngroupedCards, resolveCardGroups } from '../app/utils/postClusterBoard';

function makeCard(overrides: Partial<IRetroCard> & Pick<IRetroCard, 'id'>): IRetroCard {
  return {
    id: overrides.id,
    column: overrides.column ?? 'went-well',
    content: overrides.content ?? overrides.id,
    authorId: overrides.authorId ?? 'user-1',
    votes: overrides.votes ?? 0,
    voterIds: overrides.voterIds ?? [],
    groupId: overrides.groupId ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-03-09T10:00:00Z'),
  };
}

function makeGroup(overrides: Partial<ICardGroup> & Pick<ICardGroup, 'id'>): ICardGroup {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    column: overrides.column ?? 'went-well',
    cardIds: overrides.cardIds ?? [],
    votes: overrides.votes ?? 0,
    voterIds: overrides.voterIds ?? [],
    createdAt: overrides.createdAt ?? new Date('2026-03-09T10:00:00Z'),
  };
}

describe('postClusterBoard helpers', () => {
  test('resolveCardGroups sorts groups and nested cards while ignoring missing card ids', () => {
    const cards = [
      makeCard({
        id: 'card-1',
        groupId: 'group-1',
        votes: 1,
        createdAt: new Date('2026-03-09T10:03:00Z'),
      }),
      makeCard({
        id: 'card-2',
        groupId: 'group-1',
        votes: 3,
        createdAt: new Date('2026-03-09T10:02:00Z'),
      }),
      makeCard({
        id: 'card-3',
        groupId: 'group-2',
        column: 'to-improve',
        votes: 0,
        createdAt: new Date('2026-03-09T10:04:00Z'),
      }),
    ];
    const groups = [
      makeGroup({
        id: 'group-2',
        column: 'to-improve',
        votes: 1,
        createdAt: new Date('2026-03-09T10:05:00Z'),
        cardIds: ['card-3'],
      }),
      makeGroup({
        id: 'group-1',
        votes: 4,
        createdAt: new Date('2026-03-09T10:01:00Z'),
        cardIds: ['card-1', 'missing-card', 'card-2'],
      }),
    ];

    const resolved = resolveCardGroups(groups, cards);

    expect(resolved.map(({ group }) => group.id)).toEqual(['group-1', 'group-2']);
    expect(resolved[0]?.cards.map((card) => card.id)).toEqual(['card-2', 'card-1']);
    expect(resolved[0]?.cards).toHaveLength(2);
  });

  test('getUngroupedCards returns only ungrouped cards sorted by votes then creation time', () => {
    const cards = [
      makeCard({
        id: 'card-1',
        votes: 1,
        createdAt: new Date('2026-03-09T10:04:00Z'),
      }),
      makeCard({
        id: 'card-2',
        groupId: 'group-1',
        votes: 5,
        createdAt: new Date('2026-03-09T10:02:00Z'),
      }),
      makeCard({
        id: 'card-3',
        votes: 3,
        createdAt: new Date('2026-03-09T10:03:00Z'),
      }),
    ];

    expect(getUngroupedCards(cards).map((card) => card.id)).toEqual(['card-3', 'card-1']);
  });
});

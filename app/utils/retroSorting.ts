import type { ICardGroup, IRetroCard } from '~/types';

function getSortableTime(value: Date | string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function sortByCreatedAt<T extends { createdAt: Date | string; id: string }>(
  items: T[]
): T[] {
  return [...items].sort((left, right) => {
    const timeDelta = getSortableTime(left.createdAt) - getSortableTime(right.createdAt);
    if (timeDelta !== 0) return timeDelta;
    return left.id.localeCompare(right.id);
  });
}

export function sortByVotesThenCreatedAt<T extends { votes: number; createdAt: Date | string; id: string }>(
  items: T[]
): T[] {
  return [...items].sort((left, right) => {
    const voteDelta = right.votes - left.votes;
    if (voteDelta !== 0) return voteDelta;

    const timeDelta = getSortableTime(left.createdAt) - getSortableTime(right.createdAt);
    if (timeDelta !== 0) return timeDelta;

    return left.id.localeCompare(right.id);
  });
}

export function sortCardsForVoting(cards: IRetroCard[]): IRetroCard[] {
  return sortByVotesThenCreatedAt(cards);
}

export function sortGroupsForVoting(groups: ICardGroup[]): ICardGroup[] {
  return sortByVotesThenCreatedAt(groups);
}

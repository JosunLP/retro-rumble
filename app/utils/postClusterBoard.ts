import type { ICardGroup, IRetroCard } from '../types';
import { sortByVotesThenCreatedAt } from './retroSorting';

export interface IResolvedCardGroup {
  group: ICardGroup;
  cards: IRetroCard[];
}

type GroupSorter = (groups: ICardGroup[]) => ICardGroup[];
type CardSorter = (cards: IRetroCard[]) => IRetroCard[];

interface ResolveGroupOptions {
  sortCards?: CardSorter;
  sortGroups?: GroupSorter;
}

export function resolveCardGroups(
  groups: ICardGroup[],
  cards: IRetroCard[],
  options: ResolveGroupOptions = {}
): IResolvedCardGroup[] {
  const {
    sortCards = sortByVotesThenCreatedAt,
    sortGroups = sortByVotesThenCreatedAt,
  } = options;
  const cardMap = new Map(cards.map((card) => [card.id, card]));

  return sortGroups(groups).map((group) => ({
    group,
    cards: sortCards(
      group.cardIds
        .map((cardId) => cardMap.get(cardId))
        .filter((card): card is IRetroCard => !!card)
    ),
  }));
}

export function getUngroupedCards(
  cards: IRetroCard[],
  sortCards: CardSorter = sortByVotesThenCreatedAt
): IRetroCard[] {
  return sortCards(cards.filter((card) => !card.groupId));
}

import type {
  IActionItem,
  ICardGroup,
  ICardGroupSnapshot,
  IParticipant,
  IParticipantSnapshot,
  IRetroCard,
  IRetroCardSnapshot,
  IRetroSession,
  IRetroSessionSnapshot,
} from '../types';
import { normalizePhase, sanitizeMaxVotesPerUser } from '../types';

function normalizeDate(value: Date | string | number): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return new Date(value);
}

function cloneParticipant(participant: IParticipant): IParticipant {
  return { ...participant };
}

function cloneCard(card: IRetroCard): IRetroCard {
  return {
    ...card,
    voterIds: [...card.voterIds],
  };
}

function cloneGroup(group: ICardGroup): ICardGroup {
  return {
    ...group,
    cardIds: [...group.cardIds],
    voterIds: [...group.voterIds],
  };
}

function cloneActionItem(actionItem: IActionItem): IActionItem {
  return { ...actionItem };
}

function getSessionTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  return null;
}

export function normalizeParticipantSnapshot(
  participant: IParticipant | IParticipantSnapshot
): IParticipant {
  return {
    ...participant,
    joinedAt: normalizeDate(participant.joinedAt),
  };
}

function normalizeCardSnapshot(card: IRetroCard | IRetroCardSnapshot): IRetroCard {
  return {
    ...card,
    voterIds: [...card.voterIds],
    createdAt: normalizeDate(card.createdAt),
  };
}

function normalizeGroupSnapshot(group: ICardGroup | ICardGroupSnapshot): ICardGroup {
  return {
    ...group,
    cardIds: [...group.cardIds],
    voterIds: [...group.voterIds],
    createdAt: normalizeDate(group.createdAt),
  };
}

export function normalizeSessionSnapshot(
  session: IRetroSession | IRetroSessionSnapshot
): IRetroSession {
  return {
    ...session,
    phase: normalizePhase(session.phase) ?? 'set-the-stage',
    participants: session.participants.map(normalizeParticipantSnapshot),
    cards: session.cards.map(normalizeCardSnapshot),
    groups: session.groups.map(normalizeGroupSnapshot),
    actionItems: session.actionItems.map(cloneActionItem),
    checkInResponses: session.checkInResponses.map((response) => ({
      ...response,
    })),
    feedbackResponses: session.feedbackResponses.map((response) => ({
      ...response,
    })),
    maxVotesPerUser: sanitizeMaxVotesPerUser(session.maxVotesPerUser),
    createdAt: normalizeDate(session.createdAt),
    updatedAt: normalizeDate(session.updatedAt),
  };
}

type MergeableEntity = { id: string };

function mergeById<T extends MergeableEntity>(
  currentItems: T[],
  nextItems: T[],
  clone: (item: T) => T,
  merge: (target: T, source: T) => void
): T[] {
  const currentById = new Map(currentItems.map((item) => [item.id, item]));

  return nextItems.map((nextItem) => {
    const currentItem = currentById.get(nextItem.id);
    if (!currentItem) {
      return clone(nextItem);
    }

    merge(currentItem, nextItem);
    return currentItem;
  });
}

function mergeParticipant(target: IParticipant, source: IParticipant): void {
  Object.assign(target, source);
}

function mergeCard(target: IRetroCard, source: IRetroCard): void {
  Object.assign(target, source, {
    voterIds: [...source.voterIds],
  });
}

function mergeGroup(target: ICardGroup, source: ICardGroup): void {
  Object.assign(target, source, {
    cardIds: [...source.cardIds],
    voterIds: [...source.voterIds],
  });
}

function mergeActionItem(target: IActionItem, source: IActionItem): void {
  Object.assign(target, source);
}

export function mergeSessionSnapshot(
  currentSession: IRetroSession | null,
  incomingSession: IRetroSession | IRetroSessionSnapshot
): IRetroSession {
  if (!currentSession) {
    return normalizeSessionSnapshot(incomingSession);
  }

  const currentTimestamp = getSessionTimestamp(currentSession.updatedAt);
  const nextTimestamp = getSessionTimestamp(incomingSession.updatedAt);

  if (
    currentTimestamp !== null
    && nextTimestamp !== null
    && nextTimestamp < currentTimestamp
  ) {
    return currentSession;
  }

  const nextSession = normalizeSessionSnapshot(incomingSession);

  currentSession.name = nextSession.name;
  currentSession.phase = nextSession.phase;
  currentSession.hostId = nextSession.hostId;
  currentSession.maxVotesPerUser = nextSession.maxVotesPerUser;
  currentSession.timerDuration = nextSession.timerDuration;
  currentSession.timerRemaining = nextSession.timerRemaining;
  currentSession.timerRunning = nextSession.timerRunning;
  currentSession.updatedAt = nextSession.updatedAt;

  currentSession.participants = mergeById(
    currentSession.participants,
    nextSession.participants,
    cloneParticipant,
    mergeParticipant
  );
  currentSession.cards = mergeById(
    currentSession.cards,
    nextSession.cards,
    cloneCard,
    mergeCard
  );
  currentSession.groups = mergeById(
    currentSession.groups,
    nextSession.groups,
    cloneGroup,
    mergeGroup
  );
  currentSession.actionItems = mergeById(
    currentSession.actionItems,
    nextSession.actionItems,
    cloneActionItem,
    mergeActionItem
  );
  currentSession.checkInResponses = nextSession.checkInResponses.map((response) => ({
    ...response,
  }));
  currentSession.feedbackResponses = nextSession.feedbackResponses.map((response) => ({
    ...response,
  }));

  return currentSession;
}

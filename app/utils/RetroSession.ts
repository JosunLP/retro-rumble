/**
 * RetroSession Class
 *
 * Manages a Retro Rumble session with all participants, cards, and groups.
 * Contains the core business logic for retrospective management.
 */

import type {
    IActionItem,
    ICardGroup,
    ICheckInResponse,
    IFeedbackResponse,
    IRetroCard,
    IRetroConfig,
    IRetroSession,
    RetroColumnType,
    RetroPhase,
} from '../types';
import {
    countGroupVotesForParticipant,
    isValidCheckInMood,
    normalizePhase,
    RETRO_PHASES,
    sanitizeMaxVotesPerUser,
} from '../types';
import { Participant } from './Participant';

const DEFAULT_CONFIG: IRetroConfig = {
  maxVotesPerUser: 5,
  timerDuration: 300, // 5 minutes
  anonymousCards: true,
};

export class RetroSession implements IRetroSession {
  public readonly id: string;
  public name: string;
  public phase: RetroPhase;
  public hostId: string;
  public participants: Participant[];
  public cards: IRetroCard[];
  public groups: ICardGroup[];
  public actionItems: IActionItem[];
  public checkInResponses: ICheckInResponse[];
  public feedbackResponses: IFeedbackResponse[];
  public maxVotesPerUser: number;
  public timerDuration: number;
  public timerRemaining: number | null;
  public timerRunning: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private config: IRetroConfig;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(name: string, hostId: string, config?: Partial<IRetroConfig>) {
    this.id = crypto.randomUUID();
    this.name = name.trim();
    this.hostId = hostId;
    this.phase = 'set-the-stage';
    this.participants = [];
    this.cards = [];
    this.groups = [];
    this.actionItems = [];
    this.checkInResponses = [];
    this.feedbackResponses = [];
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxVotesPerUser = sanitizeMaxVotesPerUser(this.config.maxVotesPerUser);
    this.timerDuration = this.config.timerDuration;
    this.timerRemaining = null;
    this.timerRunning = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ============================================
  // Participant Management
  // ============================================

  /**
   * Adds a participant to the session
   */
  public addParticipant(participant: Participant): boolean {
    if (this.getParticipantById(participant.id)) return false;
    this.participants.push(participant);
    this.touch();
    return true;
  }

  /**
   * Removes a participant from the session
   */
  public removeParticipant(participantId: string): boolean {
    const index = this.participants.findIndex((p) => p.id === participantId);
    if (index === -1) return false;
    this.participants.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Gets a participant by ID
   */
  public getParticipantById(id: string): Participant | undefined {
    return this.participants.find((p) => p.id === id);
  }

  /**
   * Transfers host role to another participant
   */
  public transferHost(newHostId: string): boolean {
    const newHost = this.getParticipantById(newHostId);
    if (!newHost) return false;

    // Remove host flag from current host
    const oldHost = this.getParticipantById(this.hostId);
    if (oldHost) oldHost.isHost = false;

    // Set new host
    this.hostId = newHostId;
    newHost.isHost = true;
    this.touch();
    return true;
  }

  // ============================================
  // Phase Management
  // ============================================

  /**
   * Changes the retro phase.
   * Validates that the phase transition is sequential (forward or backward by one step).
   * Returns true if the phase was changed, false if the transition is invalid.
   */
  public changePhase(phase: RetroPhase): boolean {
    const currentPhase = normalizePhase(this.phase) ?? this.phase;
    const currentIndex = RETRO_PHASES.indexOf(currentPhase);
    const targetIndex = RETRO_PHASES.indexOf(phase);

    // Only allow moving one step forward or backward
    if (Math.abs(targetIndex - currentIndex) !== 1) return false;

    this.phase = phase;
    this.stopTimer();
    this.touch();
    return true;
  }

  // ============================================
  // Card Management
  // ============================================

  /**
   * Adds a new card to a column
   */
  public addCard(
    column: RetroColumnType,
    content: string,
    authorId: string
  ): IRetroCard {
    const card: IRetroCard = {
      id: crypto.randomUUID(),
      column,
      content: content.trim(),
      authorId,
      votes: 0,
      voterIds: [],
      groupId: null,
      createdAt: new Date(),
    };
    this.cards.push(card);
    this.touch();
    return card;
  }

  /**
   * Edits a card's content (only by author or host during gather-data; host can edit in any phase)
   */
  public editCard(
    cardId: string,
    content: string,
    participantId: string
  ): boolean {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return false;
    const isHost = participantId === this.hostId;
    // Non-host users can only edit during gather-data phase
    if (!isHost && this.phase !== 'gather-data') return false;
    // Only the author or host can edit
    if (card.authorId !== participantId && !isHost)
      return false;
    card.content = content.trim();
    this.touch();
    return true;
  }

  /**
   * Deletes a card (only by author or host during gather-data; host can delete in any phase)
   */
  public deleteCard(cardId: string, participantId: string): boolean {
    const cardIndex = this.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return false;
    const card = this.cards[cardIndex]!;
    const isHost = participantId === this.hostId;
    // Non-host users can only delete during gather-data phase
    if (!isHost && this.phase !== 'gather-data') return false;
    // Only the author or host can delete
    if (card.authorId !== participantId && !isHost)
      return false;

    // Remove from any group
    if (card.groupId) {
      const group = this.groups.find((g) => g.id === card.groupId);
      if (group) {
        group.cardIds = group.cardIds.filter((id) => id !== cardId);
        if (group.cardIds.length === 0) {
          this.groups = this.groups.filter((g) => g.id !== group.id);
        }
      }
    }

    this.cards.splice(cardIndex, 1);
    this.touch();
    return true;
  }

  /**
   * Moves a card to a different column
   */
  public moveCard(cardId: string, column: RetroColumnType): boolean {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return false;
    card.column = column;
    this.touch();
    return true;
  }

  // ============================================
  // Voting
  // ============================================

  /**
   * Counts total votes cast by a participant across all cards and groups.
   * Delegates to the shared pure function for DRY compliance.
   */
  public countUserVotes(participantId: string): number {
    return countGroupVotesForParticipant(this.groups, participantId);
  }

  /**
   * Card voting is intentionally disabled.
   * Voting is only supported on groups (see voteGroup).
   * This method is a no-op and always returns false.
   */
  public voteCard(cardId: string, participantId: string): boolean {
    void cardId;
    void participantId;
    return false;
  }

  /**
   * Removes a vote from a card
   */
  public unvoteCard(cardId: string, participantId: string): boolean {
    if (this.phase !== 'voting') return false;

    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return false;

    const voterIndex = card.voterIds.indexOf(participantId);
    if (voterIndex === -1) return false;

    card.voterIds.splice(voterIndex, 1);
    card.votes = card.voterIds.length;
    this.touch();
    return true;
  }

  /**
   * Gets remaining votes for a participant
   */
  public getRemainingVotes(participantId: string): number {
    return this.maxVotesPerUser - this.countUserVotes(participantId);
  }

  // ============================================
  // Grouping
  // ============================================

  /**
   * Creates a new group of cards
   */
  public createGroup(
    title: string,
    column: RetroColumnType,
    cardIds: string[]
  ): ICardGroup | null {
    if (this.phase !== 'cluster-cards') return null;

    // Verify all cards exist (cross-column grouping allowed)
    const validCards = cardIds.filter((id) => {
      const card = this.cards.find((c) => c.id === id);
      return card && !card.groupId;
    });

    if (validCards.length < 2) return null;

    const group: ICardGroup = {
      id: crypto.randomUUID(),
      title: title.trim(),
      column,
      cardIds: validCards,
      votes: 0,
      voterIds: [],
      createdAt: new Date(),
    };

    // Assign group ID to cards
    validCards.forEach((cardId) => {
      const card = this.cards.find((c) => c.id === cardId);
      if (card) card.groupId = group.id;
    });

    this.groups.push(group);
    this.touch();
    return group;
  }

  /**
   * Adds a card to an existing group
   */
  public addCardToGroup(groupId: string, cardId: string): boolean {
    if (this.phase !== 'cluster-cards') return false;

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const card = this.cards.find((c) => c.id === cardId);
    if (!card || card.groupId) return false;

    group.cardIds.push(cardId);
    card.groupId = groupId;
    this.touch();
    return true;
  }

  /**
   * Removes a card from a group
   */
  public removeCardFromGroup(groupId: string, cardId: string): boolean {
    if (this.phase !== 'cluster-cards') return false;

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const card = this.cards.find((c) => c.id === cardId);
    if (!card || card.groupId !== groupId) return false;

    group.cardIds = group.cardIds.filter((id) => id !== cardId);
    card.groupId = null;

    // Remove empty groups
    if (group.cardIds.length === 0) {
      this.groups = this.groups.filter((g) => g.id !== groupId);
    }

    this.touch();
    return true;
  }

  /**
   * Renames a group (only during name-groups phase)
   */
  public renameGroup(groupId: string, title: string): boolean {
    if (this.phase !== 'name-groups') return false;
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;
    group.title = title.trim();
    this.touch();
    return true;
  }

  /**
   * Moves a group to a different column
   */
  public moveGroup(groupId: string, column: RetroColumnType): boolean {
    if (this.phase !== 'cluster-cards') return false;
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;
    group.column = column;
    this.touch();
    return true;
  }

  /**
   * Deletes a group (cards are kept, just ungrouped).
   * Only allowed during cluster-cards phase.
   */
  public deleteGroup(groupId: string): boolean {
    if (this.phase !== 'cluster-cards') return false;
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    // Ungroup all cards
    group.cardIds.forEach((cardId) => {
      const card = this.cards.find((c) => c.id === cardId);
      if (card) card.groupId = null;
    });

    this.groups = this.groups.filter((g) => g.id !== groupId);
    this.touch();
    return true;
  }

  // ============================================
  // Group Voting
  // ============================================

  /**
   * Votes for a group.
   * A participant may place multiple votes on the same group (dot voting),
   * limited only by the per-user vote budget.
   */
  public voteGroup(groupId: string, participantId: string): boolean {
    if (this.phase !== 'voting') return false;

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    if (this.countUserVotes(participantId) >= this.maxVotesPerUser) return false;

    group.voterIds.push(participantId);
    group.votes = group.voterIds.length;
    this.touch();
    return true;
  }

  /**
   * Removes a vote from a group
   */
  public unvoteGroup(groupId: string, participantId: string): boolean {
    if (this.phase !== 'voting') return false;

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const voterIndex = group.voterIds.indexOf(participantId);
    if (voterIndex === -1) return false;

    group.voterIds.splice(voterIndex, 1);
    group.votes = group.voterIds.length;
    this.touch();
    return true;
  }

  // ============================================
  // Timer
  // ============================================

  /**
   * Starts the timer
   */
  public startTimer(
    onTick?: (remaining: number) => void,
    onFinished?: () => void
  ): void {
    this.stopTimer();
    this.timerRemaining = this.timerDuration;
    this.timerRunning = true;
    this.touch();

    this.timerInterval = setInterval(() => {
      if (this.timerRemaining !== null && this.timerRemaining > 0) {
        this.timerRemaining--;
        onTick?.(this.timerRemaining);
      } else {
        this.stopTimer();
        onFinished?.();
      }
    }, 1000);
  }

  /**
   * Stops the timer
   */
  public stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerRunning = false;
    this.timerRemaining = null;
    this.touch();
  }

  /**
   * Sets the timer duration.
   * Clamped between 0 and 3600 seconds (1 hour).
   */
  public static readonly MAX_TIMER_DURATION = 3600;

  public setTimerDuration(duration: number): void {
    this.timerDuration = Math.max(0, Math.min(duration, RetroSession.MAX_TIMER_DURATION));
    this.touch();
  }

  // ============================================
  // Action Items
  // ============================================

  /**
   * Adds a new action item
   */
  public addActionItem(
    text: string,
    assignee: string | null = null,
    dueDate: string | null = null
  ): IActionItem {
    const item: IActionItem = {
      id: crypto.randomUUID(),
      text: text.trim(),
      assignee,
      dueDate,
      done: false,
    };
    this.actionItems.push(item);
    this.touch();
    return item;
  }

  /**
   * Edits an existing action item
   */
  public editActionItem(
    actionId: string,
    text: string,
    assignee?: string | null,
    dueDate?: string | null
  ): boolean {
    const item = this.actionItems.find((a) => a.id === actionId);
    if (!item) return false;
    item.text = text.trim();
    if (assignee !== undefined) item.assignee = assignee;
    if (dueDate !== undefined) item.dueDate = dueDate;
    this.touch();
    return true;
  }

  /**
   * Deletes an action item
   */
  public deleteActionItem(actionId: string): boolean {
    const idx = this.actionItems.findIndex((a) => a.id === actionId);
    if (idx === -1) return false;
    this.actionItems.splice(idx, 1);
    this.touch();
    return true;
  }

  /**
   * Toggles an action item's done status
   */
  public toggleActionItem(actionId: string): boolean {
    const item = this.actionItems.find((a) => a.id === actionId);
    if (!item) return false;
    item.done = !item.done;
    this.touch();
    return true;
  }

  // ============================================
  // Check-In & Feedback
  // ============================================

  /**
   * Adds or updates a participant's check-in mood
   */
  public submitCheckIn(participantId: string, mood: string): boolean {
    if (this.phase !== 'set-the-stage') return false;
    if (!this.getParticipantById(participantId)) return false;
    if (!isValidCheckInMood(mood)) return false;

    const existing = this.checkInResponses.find(
      (r) => r.participantId === participantId
    );
    if (existing) {
      existing.mood = mood;
    } else {
      this.checkInResponses.push({ participantId, mood });
    }
    this.touch();
    return true;
  }

  /**
   * Adds or updates a participant's retro feedback rating (1–5)
   */
  public submitFeedback(participantId: string, rating: number): boolean {
    if (this.phase !== 'close-retro') return false;
    if (!this.getParticipantById(participantId)) return false;
    if (!Number.isFinite(rating)) return false;

    const clamped = Math.max(1, Math.min(5, Math.round(rating)));
    const existing = this.feedbackResponses.find(
      (r) => r.participantId === participantId
    );
    if (existing) {
      existing.rating = clamped;
    } else {
      this.feedbackResponses.push({ participantId, rating: clamped });
    }
    this.touch();
    return true;
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Gets cards for a specific column
   */
  public getColumnCards(column: RetroColumnType): IRetroCard[] {
    return this.cards.filter((c) => c.column === column);
  }

  /**
   * Gets cards sorted by votes (descending)
   */
  public getCardsSortedByVotes(column?: RetroColumnType): IRetroCard[] {
    const cards = column ? this.getColumnCards(column) : [...this.cards];
    return cards.sort((a, b) => b.votes - a.votes);
  }

  /**
   * Updates the timestamp
   */
  private touch(): void {
    this.updatedAt = new Date();
  }

  /**
   * Serializes session to JSON
   */
  /**
   * Serializes the session to a plain data object.
   * Returns deep copies of all collections to prevent external mutation
   * of internal state.
   */
  public toJSON(): IRetroSession {
    return {
      id: this.id,
      name: this.name,
      phase: this.phase,
      hostId: this.hostId,
      participants: this.participants.map((p) => p.toJSON()),
      cards: this.cards.map((c) => ({ ...c, voterIds: [...c.voterIds] })),
      groups: this.groups.map((g) => ({ ...g, cardIds: [...g.cardIds], voterIds: [...g.voterIds] })),
      actionItems: this.actionItems.map((a) => ({ ...a })),
      checkInResponses: [...this.checkInResponses],
      feedbackResponses: [...this.feedbackResponses],
      maxVotesPerUser: this.maxVotesPerUser,
      timerDuration: this.timerDuration,
      timerRemaining: this.timerRemaining,
      timerRunning: this.timerRunning,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates a RetroSession from JSON data
   */
  public static fromJSON(data: IRetroSession): RetroSession {
    const session = new RetroSession(data.name, data.hostId);
    Object.assign(session, {
      id: data.id,
      phase: normalizePhase(data.phase) ?? 'set-the-stage',
      cards: data.cards ?? [],
      groups: (data.groups ?? []).map((g) => ({ ...g, createdAt: new Date(g.createdAt) })),
      actionItems: data.actionItems ?? [],
      checkInResponses: data.checkInResponses ?? [],
      feedbackResponses: data.feedbackResponses ?? [],
      maxVotesPerUser: sanitizeMaxVotesPerUser(data.maxVotesPerUser),
      timerDuration: data.timerDuration,
      timerRemaining: data.timerRemaining,
      timerRunning: data.timerRunning,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
    session.participants = data.participants.map((p) =>
      Participant.fromJSON(p)
    );
    return session;
  }
}

/**
 * RetroSession Class
 *
 * Manages a Retro Rumble session with all participants, cards, and groups.
 * Contains the core business logic for retrospective management.
 */

import type {
  ICardGroup,
  IRetroCard,
  IRetroConfig,
  IRetroSession,
  RetroColumnType,
  RetroPhase,
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
  public readonly hostId: string;
  public participants: Participant[];
  public cards: IRetroCard[];
  public groups: ICardGroup[];
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
    this.phase = 'writing';
    this.participants = [];
    this.cards = [];
    this.groups = [];
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxVotesPerUser = this.config.maxVotesPerUser;
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

  // ============================================
  // Phase Management
  // ============================================

  /**
   * Changes the retro phase
   */
  public changePhase(phase: RetroPhase): void {
    this.phase = phase;
    this.stopTimer();
    this.touch();
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
   * Edits a card's content (only by author)
   */
  public editCard(
    cardId: string,
    content: string,
    participantId: string
  ): boolean {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return false;
    // Only the author or host can edit
    if (card.authorId !== participantId && participantId !== this.hostId)
      return false;
    card.content = content.trim();
    this.touch();
    return true;
  }

  /**
   * Deletes a card (only by author or host)
   */
  public deleteCard(cardId: string, participantId: string): boolean {
    const cardIndex = this.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return false;
    const card = this.cards[cardIndex]!;
    // Only the author or host can delete
    if (card.authorId !== participantId && participantId !== this.hostId)
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
   * Votes for a card
   */
  public voteCard(cardId: string, participantId: string): boolean {
    if (this.phase !== 'voting') return false;

    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return false;

    // Check if already voted for this card
    if (card.voterIds.includes(participantId)) return false;

    // Check max votes per user
    const userVoteCount = this.cards.reduce(
      (count, c) => count + (c.voterIds.includes(participantId) ? 1 : 0),
      0
    );
    if (userVoteCount >= this.maxVotesPerUser) return false;

    card.voterIds.push(participantId);
    card.votes = card.voterIds.length;
    this.touch();
    return true;
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
    const usedVotes = this.cards.reduce(
      (count, c) => count + (c.voterIds.includes(participantId) ? 1 : 0),
      0
    );
    return this.maxVotesPerUser - usedVotes;
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
    if (this.phase !== 'grouping') return null;

    // Verify all cards exist and are in the same column
    const validCards = cardIds.filter((id) => {
      const card = this.cards.find((c) => c.id === id);
      return card && card.column === column && !card.groupId;
    });

    if (validCards.length < 2) return null;

    const group: ICardGroup = {
      id: crypto.randomUUID(),
      title: title.trim(),
      column,
      cardIds: validCards,
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
    if (this.phase !== 'grouping') return false;

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const card = this.cards.find((c) => c.id === cardId);
    if (!card || card.column !== group.column || card.groupId) return false;

    group.cardIds.push(cardId);
    card.groupId = groupId;
    this.touch();
    return true;
  }

  /**
   * Removes a card from a group
   */
  public removeCardFromGroup(groupId: string, cardId: string): boolean {
    if (this.phase !== 'grouping') return false;

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
   * Renames a group
   */
  public renameGroup(groupId: string, title: string): boolean {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;
    group.title = title.trim();
    this.touch();
    return true;
  }

  /**
   * Deletes a group (cards are kept, just ungrouped)
   */
  public deleteGroup(groupId: string): boolean {
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
   * Sets the timer duration
   */
  public setTimerDuration(duration: number): void {
    this.timerDuration = Math.max(0, duration);
    this.touch();
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
  public toJSON(): IRetroSession {
    return {
      id: this.id,
      name: this.name,
      phase: this.phase,
      hostId: this.hostId,
      participants: this.participants.map((p) => p.toJSON()),
      cards: this.cards,
      groups: this.groups,
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
      phase: data.phase,
      cards: data.cards ?? [],
      groups: data.groups ?? [],
      maxVotesPerUser: data.maxVotesPerUser,
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

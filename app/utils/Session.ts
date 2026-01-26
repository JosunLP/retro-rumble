import type { RetroSession, SessionPhase, Participant, RetroCard, RetroCardType } from '../types'

/**
 * Session class for managing retro session data
 * Follows OOP principles from planning-poker
 */
export class Session implements RetroSession {
  id: string
  title: string
  description?: string
  phase: SessionPhase
  facilitatorId: string
  participants: Participant[]
  cards: RetroCard[]
  maxVotesPerParticipant: number
  isAnonymousMode: boolean
  createdAt: Date
  updatedAt: Date

  constructor(
    id: string,
    title: string,
    facilitatorId: string,
    isAnonymousMode: boolean = false,
    maxVotesPerParticipant: number = 3,
    description?: string,
  ) {
    this.id = id
    this.title = title
    this.description = description
    this.phase = 'writing'
    this.facilitatorId = facilitatorId
    this.participants = []
    this.cards = []
    this.maxVotesPerParticipant = maxVotesPerParticipant
    this.isAnonymousMode = isAnonymousMode
    this.createdAt = new Date()
    this.updatedAt = new Date()
  }

  /**
   * Add a participant to the session
   */
  addParticipant(participant: Participant): void {
    if (!this.participants.find(p => p.id === participant.id)) {
      this.participants.push(participant)
      this.updatedAt = new Date()
    }
  }

  /**
   * Remove a participant from the session
   */
  removeParticipant(participantId: string): void {
    this.participants = this.participants.filter(p => p.id !== participantId)
    this.updatedAt = new Date()
  }

  /**
   * Get participant by ID
   */
  getParticipant(participantId: string): Participant | undefined {
    return this.participants.find(p => p.id === participantId)
  }

  /**
   * Add a card to the session
   */
  addCard(card: RetroCard): void {
    this.cards.push(card)
    this.updatedAt = new Date()
  }

  /**
   * Update a card
   */
  updateCard(cardId: string, updates: Partial<RetroCard>): void {
    const cardIndex = this.cards.findIndex(c => c.id === cardId)
    if (cardIndex !== -1) {
      const currentCard = this.cards[cardIndex]
      if (currentCard) {
        this.cards[cardIndex] = {
          ...currentCard,
          ...updates,
          id: currentCard.id,
          updatedAt: new Date(),
        }
        this.updatedAt = new Date()
      }
    }
  }

  /**
   * Delete a card
   */
  deleteCard(cardId: string): void {
    this.cards = this.cards.filter(c => c.id !== cardId)
    this.updatedAt = new Date()
  }

  /**
   * Get cards by type
   */
  getCardsByType(type: RetroCardType): RetroCard[] {
    return this.cards.filter(c => c.type === type)
  }

  /**
   * Change session phase
   */
  setPhase(phase: SessionPhase): void {
    this.phase = phase
    this.updatedAt = new Date()
  }

  /**
   * Check if participant is facilitator
   */
  isFacilitator(participantId: string): boolean {
    return this.facilitatorId === participantId
  }

  /**
   * Get vote count for a participant
   */
  getVoteCount(participantId: string): number {
    return this.cards.reduce((count, card) => {
      return count + (card.voterIds.includes(participantId) ? 1 : 0)
    }, 0)
  }

  /**
   * Check if participant can vote
   */
  canVote(participantId: string): boolean {
    return this.getVoteCount(participantId) < this.maxVotesPerParticipant
  }

  /**
   * Get statistics for session
   */
  getStats() {
    return {
      totalCards: this.cards.length,
      positiveCards: this.getCardsByType('positive').length,
      improveCards: this.getCardsByType('improve').length,
      actionCards: this.getCardsByType('action').length,
      totalParticipants: this.participants.length,
      onlineParticipants: this.participants.filter(p => p.isOnline).length,
    }
  }

  /**
   * Convert to plain object
   */
  toJSON(): RetroSession {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      phase: this.phase,
      facilitatorId: this.facilitatorId,
      participants: this.participants,
      cards: this.cards,
      maxVotesPerParticipant: this.maxVotesPerParticipant,
      isAnonymousMode: this.isAnonymousMode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}

import type { Participant, ParticipantRole } from '../types'

/**
 * Participant class for managing participant data
 * Follows OOP principles from planning-poker
 */
export class ParticipantClass implements Participant {
  id: string
  name: string
  role: ParticipantRole
  isAnonymous: boolean
  sessionId: string
  joinedAt: Date
  isOnline: boolean

  constructor(
    id: string,
    name: string,
    sessionId: string,
    role: ParticipantRole = 'participant',
    isAnonymous: boolean = false,
  ) {
    this.id = id
    this.name = name
    this.role = role
    this.isAnonymous = isAnonymous
    this.sessionId = sessionId
    this.joinedAt = new Date()
    this.isOnline = true
  }

  /**
   * Get display name for participant
   * Returns "Anonymous" if participant is anonymous
   */
  getDisplayName(): string {
    return this.isAnonymous ? 'Anonymous' : this.name
  }

  /**
   * Check if participant can facilitate
   */
  isFacilitator(): boolean {
    return this.role === 'facilitator'
  }

  /**
   * Check if participant can vote
   */
  canVote(): boolean {
    return this.role !== 'observer'
  }

  /**
   * Set online status
   */
  setOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline
  }

  /**
   * Convert to plain object
   */
  toJSON(): Participant {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      isAnonymous: this.isAnonymous,
      sessionId: this.sessionId,
      joinedAt: this.joinedAt,
      isOnline: this.isOnline,
    }
  }
}

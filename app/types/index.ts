/**
 * Type definitions for Retro Rumble
 */

/**
 * Card types for retrospective board
 */
export type RetroCardType = 'positive' | 'improve' | 'action'

/**
 * Card status
 */
export type CardStatus = 'active' | 'grouped' | 'archived'

/**
 * Participant role
 */
export type ParticipantRole = 'facilitator' | 'participant' | 'observer'

/**
 * Session phase
 */
export type SessionPhase = 'writing' | 'grouping' | 'voting' | 'discussion' | 'completed'

/**
 * Retro Card interface
 */
export interface RetroCard {
  id: string
  type: RetroCardType
  content: string
  authorId: string
  authorName: string
  votes: number
  voterIds: string[]
  groupId?: string
  status: CardStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * Participant interface
 */
export interface Participant {
  id: string
  name: string
  role: ParticipantRole
  isAnonymous: boolean
  sessionId: string
  joinedAt: Date
  isOnline: boolean
}

/**
 * Retro Session interface
 */
export interface RetroSession {
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
}

/**
 * Card Group interface for grouping similar cards
 */
export interface CardGroup {
  id: string
  title: string
  cardIds: string[]
  sessionId: string
  createdAt: Date
}

/**
 * Vote event interface
 */
export interface VoteEvent {
  cardId: string
  participantId: string
  action: 'add' | 'remove'
}

/**
 * WebSocket message types
 */
export type WSMessageType = 
  | 'join'
  | 'leave'
  | 'card-added'
  | 'card-updated'
  | 'card-deleted'
  | 'vote-changed'
  | 'phase-changed'
  | 'participant-joined'
  | 'participant-left'

/**
 * WebSocket message interface
 */
export interface WSMessage {
  type: WSMessageType
  payload: any
  sessionId: string
  timestamp: Date
}

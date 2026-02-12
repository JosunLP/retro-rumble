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
  createdAt: string // ISO 8601 string
  updatedAt: string // ISO 8601 string
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
  joinedAt: string // ISO 8601 string
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
  createdAt: string // ISO 8601 string
  updatedAt: string // ISO 8601 string
}

/**
 * Card Group interface for grouping similar cards
 */
export interface CardGroup {
  id: string
  title: string
  cardIds: string[]
  sessionId: string
  createdAt: string // ISO 8601 string
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
 * WebSocket message payloads
 */
export interface JoinPayload {
  participant: Participant
}

export interface LeavePayload {
  participantId: string
}

export interface CardAddedPayload {
  card: RetroCard
}

export interface CardUpdatedPayload {
  card: RetroCard
}

export interface CardDeletedPayload {
  cardId: string
}

export interface VoteChangedPayload extends VoteEvent {}

export interface PhaseChangedPayload {
  phase: SessionPhase
}

export interface ParticipantJoinedPayload {
  participant: Participant
}

export interface ParticipantLeftPayload {
  participantId: string
}

/**
 * WebSocket message type (discriminated union for type safety)
 */
export type WSMessage =
  | {
      type: 'join'
      payload: JoinPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'leave'
      payload: LeavePayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'card-added'
      payload: CardAddedPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'card-updated'
      payload: CardUpdatedPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'card-deleted'
      payload: CardDeletedPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'vote-changed'
      payload: VoteChangedPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'phase-changed'
      payload: PhaseChangedPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'participant-joined'
      payload: ParticipantJoinedPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }
  | {
      type: 'participant-left'
      payload: ParticipantLeftPayload
      sessionId: string
      timestamp: string // ISO 8601 string
    }

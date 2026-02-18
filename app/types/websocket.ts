/**
 * WebSocket Message Types for Retro Rumble
 *
 * Defines all message types for real-time communication
 * between client and server.
 */

import type {
    IParticipant,
    IRetroSession,
    RetroColumnType,
    RetroPhase,
} from './retro';

// ============================================
// Client-to-Server Message Types
// ============================================

export type ClientMessageType =
  | 'session:create'
  | 'session:join'
  | 'session:leave'
  | 'phase:change'
  | 'card:add'
  | 'card:edit'
  | 'card:delete'
  | 'card:vote'
  | 'card:unvote'
  | 'card:move'
  | 'group:create'
  | 'group:add-card'
  | 'group:remove-card'
  | 'group:rename'
  | 'group:delete'
  | 'action:add'
  | 'action:edit'
  | 'action:delete'
  | 'action:toggle'
  | 'checkin:respond'
  | 'feedback:respond'
  | 'timer:start'
  | 'timer:stop'
  | 'timer:set'
  | 'ping';

// ============================================
// Server-to-Client Message Types
// ============================================

export type ServerMessageType =
  | 'session:created'
  | 'session:joined'
  | 'session:updated'
  | 'session:left'
  | 'session:error'
  | 'participant:joined'
  | 'participant:left'
  | 'timer:tick'
  | 'timer:finished'
  | 'pong';

// ============================================
// Base Message Structures
// ============================================

/**
 * Base structure for client messages
 */
export interface ClientMessage<
  T extends ClientMessageType = ClientMessageType,
  P = unknown,
> {
  type: T;
  payload: P;
  timestamp: number;
}

/**
 * Base structure for server messages
 */
export interface ServerMessage<
  T extends ServerMessageType = ServerMessageType,
  P = unknown,
> {
  type: T;
  payload: P;
  timestamp: number;
}

// ============================================
// Client Message Payloads
// ============================================

export interface CreateSessionPayload {
  sessionName: string;
  participantName: string;
  maxVotesPerUser?: number;
  timerDuration?: number;
}

export interface JoinSessionPayload {
  joinCode: string;
  participantName: string;
}

export interface LeaveSessionPayload {
  sessionId: string;
}

export interface PhaseChangePayload {
  sessionId: string;
  phase: RetroPhase;
}

export interface AddCardPayload {
  sessionId: string;
  column: RetroColumnType;
  content: string;
}

export interface EditCardPayload {
  sessionId: string;
  cardId: string;
  content: string;
}

export interface DeleteCardPayload {
  sessionId: string;
  cardId: string;
}

export interface VoteCardPayload {
  sessionId: string;
  cardId: string;
}

export interface UnvoteCardPayload {
  sessionId: string;
  cardId: string;
}

export interface MoveCardPayload {
  sessionId: string;
  cardId: string;
  column: RetroColumnType;
}

export interface CreateGroupPayload {
  sessionId: string;
  title: string;
  column: RetroColumnType;
  cardIds: string[];
}

export interface AddCardToGroupPayload {
  sessionId: string;
  groupId: string;
  cardId: string;
}

export interface RemoveCardFromGroupPayload {
  sessionId: string;
  groupId: string;
  cardId: string;
}

export interface RenameGroupPayload {
  sessionId: string;
  groupId: string;
  title: string;
}

export interface DeleteGroupPayload {
  sessionId: string;
  groupId: string;
}

export interface TimerStartPayload {
  sessionId: string;
}

export interface TimerStopPayload {
  sessionId: string;
}

export interface TimerSetPayload {
  sessionId: string;
  duration: number;
}

export interface AddActionItemPayload {
  sessionId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
}

export interface EditActionItemPayload {
  sessionId: string;
  actionId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
}

export interface DeleteActionItemPayload {
  sessionId: string;
  actionId: string;
}

export interface ToggleActionItemPayload {
  sessionId: string;
  actionId: string;
}

export interface CheckInRespondPayload {
  sessionId: string;
  mood: string;
}

export interface FeedbackRespondPayload {
  sessionId: string;
  rating: number;
}

// ============================================
// Server Message Payloads
// ============================================

export interface SessionCreatedPayload {
  session: IRetroSession;
  joinCode: string;
  participant: IParticipant;
}

export interface SessionJoinedPayload {
  session: IRetroSession;
  joinCode: string;
  participant: IParticipant;
}

export interface SessionUpdatedPayload {
  session: IRetroSession;
}

export interface SessionLeftPayload {
  success: boolean;
}

export interface SessionErrorPayload {
  message: string;
  code: string;
}

export interface ParticipantJoinedPayload {
  participant: IParticipant;
  sessionId: string;
}

export interface ParticipantLeftPayload {
  participantId: string;
  sessionId: string;
}

export interface TimerTickPayload {
  remaining: number;
}

export interface TimerFinishedPayload {
  sessionId: string;
}

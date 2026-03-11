/**
 * WebSocket Route for Retro Rumble
 *
 * Handles all real-time communication between clients and server.
 * Uses crossws for WebSocket support in Nitro.
 */

import type { Peer } from 'crossws';
import type {
    AddActionItemPayload,
    AddCardPayload,
    AddCardToGroupPayload,
    CheckInRespondPayload,
    ClientMessage,
    CreateGroupPayload,
    CreateSessionPayload,
    DeleteActionItemPayload,
    DeleteCardPayload,
    DeleteGroupPayload,
    EditActionItemPayload,
    EditCardPayload,
    FeedbackRespondPayload,
    JoinSessionPayload,
    MoveCardPayload,
    MoveGroupPayload,
    PhaseChangePayload,
    RejoinSessionPayload,
    RemoveCardFromGroupPayload,
    RenameGroupPayload,
    ServerMessage,
    TimerSetPayload,
    ToggleActionItemPayload,
    UnvoteCardPayload,
    UnvoteGroupPayload,
    VoteCardPayload,
    VoteGroupPayload,
} from '../../app/types/websocket';
import { normalizePhase } from '../../app/types/retro';
import { sessionStore } from '../utils/sessionStore';

/**
 * Sends a typed message to a peer
 */
function sendMessage<T>(peer: Peer, type: string, payload: T): void {
  const message: ServerMessage = {
    type: type as ServerMessage['type'],
    payload,
    timestamp: Date.now(),
  };
  peer.send(JSON.stringify(message));
}

/**
 * Broadcasts a message to all peers in a session
 */
function broadcastToSession(
  sessionId: string,
  type: string,
  payload: unknown,
  excludePeer?: Peer
): void {
  const connections = sessionStore.getSessionConnections(sessionId);
  if (!connections) return;

  const message: ServerMessage = {
    type: type as ServerMessage['type'],
    payload,
    timestamp: Date.now(),
  };
  const messageStr = JSON.stringify(message);

  for (const [, peer] of connections) {
    if (peer !== excludePeer) {
      peer.send(messageStr);
    }
  }
}

type ActionItemErrorCode =
  | 'INVALID_DUE_DATE'
  | 'PAST_DUE_DATE'
  | 'ACTION_ADD_FAILED'
  | 'ACTION_EDIT_FAILED';

function getActionItemErrorCode(
  error: unknown,
  fallbackCode: 'ACTION_ADD_FAILED' | 'ACTION_EDIT_FAILED'
): ActionItemErrorCode {
  if (error instanceof Error) {
    if (error.message === 'PAST_DUE_DATE') return 'PAST_DUE_DATE';
    if (error.message === 'INVALID_DUE_DATE') return 'INVALID_DUE_DATE';
  }

  console.error(`[WebSocket] Unexpected ${fallbackCode}:`, error);
  return fallbackCode;
}

/**
 * Safely dispatches a handler, catching any uncaught exceptions so that
 * one bad message never tears down the entire WebSocket connection.
 */
function safeDispatch(peer: Peer, handler: () => void): void {
  try {
    handler();
  } catch (error) {
    console.error('[WebSocket] Handler error:', error);
    sendMessage(peer, 'session:error', {
      message: 'An internal error occurred. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Handles incoming WebSocket messages
 */
function handleMessage(peer: Peer, data: string): void {
  let message: ClientMessage;
  try {
    message = JSON.parse(data) as ClientMessage;
  } catch (error) {
    console.error('[WebSocket] Error parsing message:', error);
    sendMessage(peer, 'session:error', {
      message: 'Invalid message format.',
      code: 'INVALID_MESSAGE',
    });
    return;
  }

  switch (message.type) {
    case 'session:create':
      safeDispatch(peer, () => handleCreateSession(peer, message.payload as CreateSessionPayload));
      break;
    case 'session:join':
      safeDispatch(peer, () => handleJoinSession(peer, message.payload as JoinSessionPayload));
      break;
    case 'session:rejoin':
      safeDispatch(peer, () => handleRejoinSession(peer, message.payload as RejoinSessionPayload));
      break;
    case 'session:leave':
      safeDispatch(peer, () => handleLeaveSession(peer));
      break;
    case 'phase:change':
      safeDispatch(peer, () => handlePhaseChange(peer, message.payload as PhaseChangePayload));
      break;
    case 'card:add':
      safeDispatch(peer, () => handleAddCard(peer, message.payload as AddCardPayload));
      break;
    case 'card:edit':
      safeDispatch(peer, () => handleEditCard(peer, message.payload as EditCardPayload));
      break;
    case 'card:delete':
      safeDispatch(peer, () => handleDeleteCard(peer, message.payload as DeleteCardPayload));
      break;
    case 'card:vote':
      safeDispatch(peer, () => handleVoteCard(peer, message.payload as VoteCardPayload));
      break;
    case 'card:unvote':
      safeDispatch(peer, () => handleUnvoteCard(peer, message.payload as UnvoteCardPayload));
      break;
    case 'card:move':
      safeDispatch(peer, () => handleMoveCard(peer, message.payload as MoveCardPayload));
      break;
    case 'group:create':
      safeDispatch(peer, () => handleCreateGroup(peer, message.payload as CreateGroupPayload));
      break;
    case 'group:add-card':
      safeDispatch(peer, () => handleAddCardToGroup(peer, message.payload as AddCardToGroupPayload));
      break;
    case 'group:remove-card':
      safeDispatch(peer, () => handleRemoveCardFromGroup(peer, message.payload as RemoveCardFromGroupPayload));
      break;
    case 'group:rename':
      safeDispatch(peer, () => handleRenameGroup(peer, message.payload as RenameGroupPayload));
      break;
    case 'group:move':
      safeDispatch(peer, () => handleMoveGroup(peer, message.payload as MoveGroupPayload));
      break;
    case 'group:delete':
      safeDispatch(peer, () => handleDeleteGroup(peer, message.payload as DeleteGroupPayload));
      break;
    case 'group:vote':
      safeDispatch(peer, () => handleVoteGroup(peer, message.payload as VoteGroupPayload));
      break;
    case 'group:unvote':
      safeDispatch(peer, () => handleUnvoteGroup(peer, message.payload as UnvoteGroupPayload));
      break;
    case 'action:add':
      safeDispatch(peer, () => handleAddActionItem(peer, message.payload as AddActionItemPayload));
      break;
    case 'action:edit':
      safeDispatch(peer, () => handleEditActionItem(peer, message.payload as EditActionItemPayload));
      break;
    case 'action:delete':
      safeDispatch(peer, () => handleDeleteActionItem(peer, message.payload as DeleteActionItemPayload));
      break;
    case 'action:toggle':
      safeDispatch(peer, () => handleToggleActionItem(peer, message.payload as ToggleActionItemPayload));
      break;
    case 'checkin:respond':
      safeDispatch(peer, () => handleCheckInRespond(peer, message.payload as CheckInRespondPayload));
      break;
    case 'feedback:respond':
      safeDispatch(peer, () => handleFeedbackRespond(peer, message.payload as FeedbackRespondPayload));
      break;
    case 'timer:start':
      safeDispatch(peer, () => handleTimerStart(peer));
      break;
    case 'timer:stop':
      safeDispatch(peer, () => handleTimerStop(peer));
      break;
    case 'timer:set':
      safeDispatch(peer, () => handleTimerSet(peer, message.payload as TimerSetPayload));
      break;
    case 'ping':
      sendMessage(peer, 'pong', {});
      break;
    default:
      console.warn('[WebSocket] Unknown message type:', message.type);
  }
}

// ============================================
// Session Handlers
// ============================================

function handleCreateSession(peer: Peer, payload: CreateSessionPayload): void {
  try {
    const result = sessionStore.createSession(
      payload.sessionName,
      payload.participantName,
      peer,
      {
        maxVotesPerUser: payload.maxVotesPerUser,
        timerDuration: payload.timerDuration,
      }
    );

    sendMessage(peer, 'session:created', {
      session: result.session,
      joinCode: result.joinCode,
      participant: result.participant,
    });
  } catch {
    sendMessage(peer, 'session:error', {
      message: 'Could not create session. Please check your input.',
      code: 'SESSION_CREATE_FAILED',
    });
  }
}

function handleJoinSession(peer: Peer, payload: JoinSessionPayload): void {
  const result = sessionStore.joinSession(
    payload.joinCode,
    payload.participantName,
    peer
  );

  if (!result) {
    sendMessage(peer, 'session:error', {
      message: 'Session not found. Please check the join code.',
      code: 'SESSION_NOT_FOUND',
    });
    return;
  }

  sendMessage(peer, 'session:joined', {
    session: result.session,
    joinCode: result.joinCode,
    participant: result.participant,
  });

  broadcastToSession(
    result.session.id,
    'participant:joined',
    {
      participant: result.participant,
      sessionId: result.session.id,
    },
    peer
  );
}

function handleRejoinSession(
  peer: Peer,
  payload: RejoinSessionPayload
): void {
  const result = sessionStore.rejoinSession(
    payload.joinCode,
    payload.participantId,
    peer
  );

  if (!result) {
    sendMessage(peer, 'session:error', {
      message: 'Could not rejoin session. It may have ended.',
      code: 'REJOIN_FAILED',
    });
    return;
  }

  sendMessage(peer, 'session:rejoined', {
    session: result.session,
    joinCode: result.joinCode,
    participant: result.participant,
  });

  broadcastToSession(
    result.session.id,
    'session:updated',
    { session: result.session },
    peer
  );
}

function handleLeaveSession(peer: Peer): void {
  const result = sessionStore.leaveSession(peer);

  if (!result) {
    sendMessage(peer, 'session:left', { success: false });
    return;
  }

  sendMessage(peer, 'session:left', { success: true });

  if (result.session) {
    broadcastToSession(result.sessionId, 'participant:left', {
      participantId: result.participantId,
      sessionId: result.sessionId,
    });

    broadcastToSession(result.sessionId, 'session:updated', {
      session: result.session,
    });
  }
}

// ============================================
// Phase Handlers
// ============================================

function handlePhaseChange(peer: Peer, payload: PhaseChangePayload): void {
  const phase = normalizePhase(payload.phase);
  if (!phase) {
    sendMessage(peer, 'session:error', {
      code: 'INVALID_PHASE',
    });
    return;
  }
  const session = sessionStore.changePhase(peer, phase);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Only the host can change the phase.',
      code: 'NOT_AUTHORIZED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

// ============================================
// Card Handlers
// ============================================

function handleAddCard(peer: Peer, payload: AddCardPayload): void {
  const session = sessionStore.addCard(peer, payload.column, payload.content);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message:
        'Could not add card. Cards can only be added during the Gather Data phase.',
      code: 'CARD_ADD_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleEditCard(peer: Peer, payload: EditCardPayload): void {
  const session = sessionStore.editCard(peer, payload.cardId, payload.content);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not edit card.',
      code: 'CARD_EDIT_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleDeleteCard(peer: Peer, payload: DeleteCardPayload): void {
  const session = sessionStore.deleteCard(peer, payload.cardId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not delete card.',
      code: 'CARD_DELETE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleVoteCard(peer: Peer, payload: VoteCardPayload): void {
  const session = sessionStore.voteCard(peer, payload.cardId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      code: 'VOTE_GROUP_ONLY',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleUnvoteCard(peer: Peer, payload: UnvoteCardPayload): void {
  const session = sessionStore.unvoteCard(peer, payload.cardId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not remove vote.',
      code: 'UNVOTE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleMoveCard(peer: Peer, payload: MoveCardPayload): void {
  const session = sessionStore.moveCard(peer, payload.cardId, payload.column);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not move card.',
      code: 'CARD_MOVE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

// ============================================
// Group Handlers
// ============================================

function handleCreateGroup(peer: Peer, payload: CreateGroupPayload): void {
  const session = sessionStore.createGroup(
    peer,
    payload.title,
    payload.column,
    payload.cardIds
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not create group.',
      code: 'GROUP_CREATE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleAddCardToGroup(
  peer: Peer,
  payload: AddCardToGroupPayload
): void {
  const session = sessionStore.addCardToGroup(
    peer,
    payload.groupId,
    payload.cardId
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not add card to group.',
      code: 'GROUP_ADD_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleRemoveCardFromGroup(
  peer: Peer,
  payload: RemoveCardFromGroupPayload
): void {
  const session = sessionStore.removeCardFromGroup(
    peer,
    payload.groupId,
    payload.cardId
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not remove card from group.',
      code: 'GROUP_REMOVE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleRenameGroup(peer: Peer, payload: RenameGroupPayload): void {
  const session = sessionStore.renameGroup(
    peer,
    payload.groupId,
    payload.title
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not rename group.',
      code: 'GROUP_RENAME_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleMoveGroup(peer: Peer, payload: MoveGroupPayload): void {
  const session = sessionStore.moveGroup(
    peer,
    payload.groupId,
    payload.column
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not move group.',
      code: 'GROUP_MOVE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleDeleteGroup(peer: Peer, payload: DeleteGroupPayload): void {
  const session = sessionStore.deleteGroup(peer, payload.groupId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not delete group.',
      code: 'GROUP_DELETE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleVoteGroup(peer: Peer, payload: VoteGroupPayload): void {
  const session = sessionStore.voteGroup(peer, payload.groupId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not vote for group. You may have reached your vote limit.',
      code: 'VOTE_GROUP_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleUnvoteGroup(peer: Peer, payload: UnvoteGroupPayload): void {
  const session = sessionStore.unvoteGroup(peer, payload.groupId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not remove vote from group.',
      code: 'UNVOTE_GROUP_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

// ============================================
// Action Item Handlers
// ============================================

function handleAddActionItem(peer: Peer, payload: AddActionItemPayload): void {
  let session = null;

  try {
    session = sessionStore.addActionItem(
      peer,
      payload.text,
      payload.assignee,
      payload.dueDate
    );
  } catch (error) {
    sendMessage(peer, 'session:error', {
      code: getActionItemErrorCode(error, 'ACTION_ADD_FAILED'),
    });
    return;
  }

  if (!session) {
    sendMessage(peer, 'session:error', {
      code: 'ACTION_ADD_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleEditActionItem(
  peer: Peer,
  payload: EditActionItemPayload
): void {
  let session = null;

  try {
    session = sessionStore.editActionItem(
      peer,
      payload.actionId,
      payload.text,
      payload.assignee,
      payload.dueDate
    );
  } catch (error) {
    sendMessage(peer, 'session:error', {
      code: getActionItemErrorCode(error, 'ACTION_EDIT_FAILED'),
    });
    return;
  }

  if (!session) {
    sendMessage(peer, 'session:error', {
      code: 'ACTION_EDIT_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleDeleteActionItem(
  peer: Peer,
  payload: DeleteActionItemPayload
): void {
  const session = sessionStore.deleteActionItem(peer, payload.actionId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not delete action item.',
      code: 'ACTION_DELETE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleToggleActionItem(
  peer: Peer,
  payload: ToggleActionItemPayload
): void {
  const session = sessionStore.toggleActionItem(peer, payload.actionId);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not toggle action item.',
      code: 'ACTION_TOGGLE_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

// ============================================
// Check-In & Feedback Handlers
// ============================================

function handleCheckInRespond(
  peer: Peer,
  payload: CheckInRespondPayload
): void {
  const session = sessionStore.submitCheckIn(peer, payload.mood);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not submit check-in.',
      code: 'CHECKIN_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleFeedbackRespond(
  peer: Peer,
  payload: FeedbackRespondPayload
): void {
  const session = sessionStore.submitFeedback(peer, payload.rating);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not submit feedback.',
      code: 'FEEDBACK_FAILED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

// ============================================
// Timer Handlers
// ============================================

function handleTimerStart(peer: Peer): void {
  const session = sessionStore.startTimer(
    peer,
    (sessionId, remaining) => {
      broadcastToSession(sessionId, 'timer:tick', { remaining });
    },
    (sessionId) => {
      broadcastToSession(sessionId, 'timer:finished', { sessionId });
    }
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Only the host can control the timer.',
      code: 'NOT_AUTHORIZED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleTimerStop(peer: Peer): void {
  const session = sessionStore.stopTimer(peer);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Only the host can control the timer.',
      code: 'NOT_AUTHORIZED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

function handleTimerSet(peer: Peer, payload: TimerSetPayload): void {
  const session = sessionStore.setTimerDuration(peer, payload.duration);

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Only the host can set the timer.',
      code: 'NOT_AUTHORIZED',
    });
    return;
  }

  broadcastToSession(session.id, 'session:updated', { session });
}

// ============================================
// WebSocket Event Handler
// ============================================

export default defineWebSocketHandler({
  open(peer) {
    console.log(`[WebSocket] Client connected: ${peer.id}`);
  },

  message(peer, message) {
    const data = typeof message === 'string' ? message : message.text();
    handleMessage(peer, data);
  },

  close(peer) {
    console.log(`[WebSocket] Client disconnected: ${peer.id}`);
    // Only unmap the peer, keep participant in session for potential rejoin
    const result = sessionStore.disconnectPeer(peer);

    if (result?.session) {
      broadcastToSession(result.sessionId, 'session:updated', {
        session: result.session,
      });
    }
  },

  error(peer, error) {
    console.error(`[WebSocket] Error for peer ${peer.id}:`, error);
  },
});

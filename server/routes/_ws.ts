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
  ClientMessage,
  CreateGroupPayload,
  CreateSessionPayload,
  DeleteActionItemPayload,
  DeleteCardPayload,
  DeleteGroupPayload,
  EditActionItemPayload,
  EditCardPayload,
  JoinSessionPayload,
  MoveCardPayload,
  PhaseChangePayload,
  RemoveCardFromGroupPayload,
  RenameGroupPayload,
  ServerMessage,
  TimerSetPayload,
  ToggleActionItemPayload,
  UnvoteCardPayload,
  VoteCardPayload,
} from '../../app/types/websocket';
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

/**
 * Handles incoming WebSocket messages
 */
function handleMessage(peer: Peer, data: string): void {
  try {
    const message = JSON.parse(data) as ClientMessage;

    switch (message.type) {
      case 'session:create':
        handleCreateSession(peer, message.payload as CreateSessionPayload);
        break;
      case 'session:join':
        handleJoinSession(peer, message.payload as JoinSessionPayload);
        break;
      case 'session:leave':
        handleLeaveSession(peer);
        break;
      case 'phase:change':
        handlePhaseChange(peer, message.payload as PhaseChangePayload);
        break;
      case 'card:add':
        handleAddCard(peer, message.payload as AddCardPayload);
        break;
      case 'card:edit':
        handleEditCard(peer, message.payload as EditCardPayload);
        break;
      case 'card:delete':
        handleDeleteCard(peer, message.payload as DeleteCardPayload);
        break;
      case 'card:vote':
        handleVoteCard(peer, message.payload as VoteCardPayload);
        break;
      case 'card:unvote':
        handleUnvoteCard(peer, message.payload as UnvoteCardPayload);
        break;
      case 'card:move':
        handleMoveCard(peer, message.payload as MoveCardPayload);
        break;
      case 'group:create':
        handleCreateGroup(peer, message.payload as CreateGroupPayload);
        break;
      case 'group:add-card':
        handleAddCardToGroup(peer, message.payload as AddCardToGroupPayload);
        break;
      case 'group:remove-card':
        handleRemoveCardFromGroup(
          peer,
          message.payload as RemoveCardFromGroupPayload
        );
        break;
      case 'group:rename':
        handleRenameGroup(peer, message.payload as RenameGroupPayload);
        break;
      case 'group:delete':
        handleDeleteGroup(peer, message.payload as DeleteGroupPayload);
        break;
      case 'action:add':
        handleAddActionItem(peer, message.payload as AddActionItemPayload);
        break;
      case 'action:edit':
        handleEditActionItem(peer, message.payload as EditActionItemPayload);
        break;
      case 'action:delete':
        handleDeleteActionItem(
          peer,
          message.payload as DeleteActionItemPayload
        );
        break;
      case 'action:toggle':
        handleToggleActionItem(
          peer,
          message.payload as ToggleActionItemPayload
        );
        break;
      case 'timer:start':
        handleTimerStart(peer);
        break;
      case 'timer:stop':
        handleTimerStop(peer);
        break;
      case 'timer:set':
        handleTimerSet(peer, message.payload as TimerSetPayload);
        break;
      case 'ping':
        sendMessage(peer, 'pong', {});
        break;
      default:
        console.warn('[WebSocket] Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('[WebSocket] Error parsing message:', error);
    sendMessage(peer, 'session:error', {
      message: 'Invalid message',
      code: 'INVALID_MESSAGE',
    });
  }
}

// ============================================
// Session Handlers
// ============================================

function handleCreateSession(peer: Peer, payload: CreateSessionPayload): void {
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
  const session = sessionStore.changePhase(peer, payload.phase);

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
        'Could not add card. Cards can only be added during the writing phase.',
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
      message: 'Could not vote. You may have reached your vote limit.',
      code: 'VOTE_FAILED',
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

// ============================================
// Action Item Handlers
// ============================================

function handleAddActionItem(peer: Peer, payload: AddActionItemPayload): void {
  const session = sessionStore.addActionItem(
    peer,
    payload.text,
    payload.assignee,
    payload.dueDate
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not add action item.',
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
  const session = sessionStore.editActionItem(
    peer,
    payload.actionId,
    payload.text,
    payload.assignee,
    payload.dueDate
  );

  if (!session) {
    sendMessage(peer, 'session:error', {
      message: 'Could not edit action item.',
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
    handleLeaveSession(peer);
  },

  error(peer, error) {
    console.error(`[WebSocket] Error for peer ${peer.id}:`, error);
  },
});

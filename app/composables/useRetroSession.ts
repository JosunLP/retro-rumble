/**
 * useRetroSession Composable
 *
 * Manages the state of a Retro Rumble session with real-time synchronization.
 * Uses WebSocket for multi-user communication.
 */

import type { ISessionState, RetroColumnType, RetroPhase } from '~/types';
import type {
    ParticipantJoinedPayload,
    ParticipantLeftPayload,
    SessionCreatedPayload,
    SessionErrorPayload,
    SessionJoinedPayload,
    SessionLeftPayload,
    SessionUpdatedPayload,
    TimerTickPayload,
} from '~/types/websocket';

/**
 * Extended state with join code and connection status
 */
interface ExtendedSessionState extends ISessionState {
  joinCode: string | null;
}

/**
 * Composable for retro session management with WebSocket
 *
 * @example
 * ```ts
 * const { session, createSession, joinSession, addCard, connectionStatus } = useRetroSession()
 * ```
 */
export function useRetroSession() {
  /**
   * WebSocket Composable
   */
  const {
    status: connectionStatus,
    send,
    on,
    connect,
  } = useWebSocket({
    autoConnect: true,
    autoReconnect: true,
  });

  /**
   * Reactive session state
   */
  const state = useState<ExtendedSessionState>('retro-session', () => ({
    session: null,
    currentParticipant: null,
    isHost: false,
    isConnected: false,
    error: null,
    joinCode: null,
  }));

  /**
   * Flag to ensure WebSocket handlers are registered only once per browser tab
   */
  const handlersRegistered = useState<boolean>(
    'retro-handlers-registered',
    () => false
  );

  /**
   * Wait for connection if not yet connected
   */
  async function ensureConnected(): Promise<boolean> {
    if (connectionStatus.value === 'connected') return true;

    connect();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      const unwatch = watch(connectionStatus, (status) => {
        if (status === 'connected') {
          clearTimeout(timeout);
          unwatch();
          resolve(true);
        } else if (status === 'error') {
          clearTimeout(timeout);
          unwatch();
          resolve(false);
        }
      });
    });
  }

  /**
   * Register WebSocket event handlers (only once per browser tab)
   */
  if (import.meta.client && !handlersRegistered.value) {
    handlersRegistered.value = true;

    // Session created
    on<SessionCreatedPayload>('session:created', (payload) => {
      state.value = {
        session: payload.session,
        currentParticipant: payload.participant,
        isHost: true,
        isConnected: true,
        error: null,
        joinCode: payload.joinCode,
      };
    });

    // Session joined
    on<SessionJoinedPayload>('session:joined', (payload) => {
      state.value = {
        session: payload.session,
        currentParticipant: payload.participant,
        isHost: payload.session.hostId === payload.participant.id,
        isConnected: true,
        error: null,
        joinCode: payload.joinCode,
      };
    });

    // Session updated
    on<SessionUpdatedPayload>('session:updated', (payload) => {
      if (!state.value.currentParticipant) return;

      const updatedParticipant = payload.session.participants.find(
        (p) => p.id === state.value.currentParticipant?.id
      );

      state.value = {
        ...state.value,
        session: payload.session,
        currentParticipant:
          updatedParticipant ?? state.value.currentParticipant,
        isHost: payload.session.hostId === state.value.currentParticipant?.id,
      };
    });

    // Participant joined
    on<ParticipantJoinedPayload>('participant:joined', (payload) => {
      if (!state.value.session) return;

      const exists = state.value.session.participants.some(
        (p) => p.id === payload.participant.id
      );
      if (exists) return;

      state.value = {
        ...state.value,
        session: {
          ...state.value.session,
          participants: [
            ...state.value.session.participants,
            payload.participant,
          ],
        },
      };
    });

    // Participant left
    on<ParticipantLeftPayload>('participant:left', (payload) => {
      if (!state.value.session) return;

      state.value = {
        ...state.value,
        session: {
          ...state.value.session,
          participants: state.value.session.participants.filter(
            (p) => p.id !== payload.participantId
          ),
        },
      };
    });

    // Session left confirmed
    on<SessionLeftPayload>('session:left', () => {
      state.value = {
        session: null,
        currentParticipant: null,
        isHost: false,
        isConnected: false,
        error: null,
        joinCode: null,
      };
    });

    // Timer tick
    on<TimerTickPayload>('timer:tick', (payload) => {
      if (!state.value.session) return;
      state.value = {
        ...state.value,
        session: {
          ...state.value.session,
          timerRemaining: payload.remaining,
        },
      };
    });

    // Timer finished
    on('timer:finished', () => {
      if (!state.value.session) return;

      // Play harmonious chime for all users
      const { playChime } = useTimerSound();
      playChime();

      state.value = {
        ...state.value,
        session: {
          ...state.value.session,
          timerRunning: false,
          timerRemaining: null,
        },
      };
    });

    // Error
    on<SessionErrorPayload>('session:error', (payload) => {
      state.value = {
        ...state.value,
        error: payload.message,
      };
    });
  }

  // ============================================
  // Computed Properties
  // ============================================

  const joinCode = computed(() => state.value.joinCode);
  const session = computed(() => state.value.session);
  const currentParticipant = computed(() => state.value.currentParticipant);
  const isHost = computed(() => state.value.isHost);
  const error = computed(() => state.value.error);

  const participantCount = computed(
    () => state.value.session?.participants.length ?? 0
  );

  const remainingVotes = computed(() => {
    if (!state.value.session || !state.value.currentParticipant) return 0;
    const usedVotes = state.value.session.cards.reduce(
      (count, c) =>
        count +
        (c.voterIds.includes(state.value.currentParticipant!.id) ? 1 : 0),
      0
    );
    return state.value.session.maxVotesPerUser - usedVotes;
  });

  const currentPhase = computed(() => state.value.session?.phase ?? 'set-the-stage');

  // ============================================
  // Actions
  // ============================================

  async function createSession(
    sessionName: string,
    participantName: string,
    maxVotesPerUser?: number,
    timerDuration?: number
  ): Promise<void> {
    if (!sessionName.trim() || !participantName.trim()) {
      state.value = { ...state.value, error: 'Please fill in all fields.' };
      return;
    }

    const connected = await ensureConnected();
    if (!connected) {
      state.value = {
        ...state.value,
        error: 'Could not connect to the server.',
      };
      return;
    }

    send('session:create', {
      sessionName: sessionName.trim(),
      participantName: participantName.trim(),
      maxVotesPerUser,
      timerDuration,
    });
  }

  async function joinSession(
    code: string,
    participantName: string
  ): Promise<void> {
    const normalizedCode = code.toUpperCase().trim();
    if (normalizedCode.length !== 6) {
      state.value = {
        ...state.value,
        error: 'The join code must be 6 characters long.',
      };
      return;
    }
    if (!participantName.trim()) {
      state.value = { ...state.value, error: 'Please enter your name.' };
      return;
    }

    const connected = await ensureConnected();
    if (!connected) {
      state.value = {
        ...state.value,
        error: 'Could not connect to the server.',
      };
      return;
    }

    send('session:join', {
      joinCode: normalizedCode,
      participantName: participantName.trim(),
    });
  }

  function changePhase(phase: RetroPhase): void {
    if (!state.value.session || !state.value.isHost) return;
    send('phase:change', { sessionId: state.value.session.id, phase });
  }

  function addCard(column: RetroColumnType, content: string): void {
    if (!state.value.session) return;
    send('card:add', { sessionId: state.value.session.id, column, content });
  }

  function editCard(cardId: string, content: string): void {
    if (!state.value.session) return;
    send('card:edit', { sessionId: state.value.session.id, cardId, content });
  }

  function deleteCard(cardId: string): void {
    if (!state.value.session) return;
    send('card:delete', { sessionId: state.value.session.id, cardId });
  }

  function voteCard(cardId: string): void {
    if (!state.value.session) return;
    send('card:vote', { sessionId: state.value.session.id, cardId });
  }

  function unvoteCard(cardId: string): void {
    if (!state.value.session) return;
    send('card:unvote', { sessionId: state.value.session.id, cardId });
  }

  function moveCard(cardId: string, column: RetroColumnType): void {
    if (!state.value.session) return;
    send('card:move', { sessionId: state.value.session.id, cardId, column });
  }

  function createGroup(
    title: string,
    column: RetroColumnType,
    cardIds: string[]
  ): void {
    if (!state.value.session || !state.value.isHost) return;
    send('group:create', {
      sessionId: state.value.session.id,
      title,
      column,
      cardIds,
    });
  }

  function addCardToGroup(groupId: string, cardId: string): void {
    if (!state.value.session || !state.value.isHost) return;
    send('group:add-card', {
      sessionId: state.value.session.id,
      groupId,
      cardId,
    });
  }

  function removeCardFromGroup(groupId: string, cardId: string): void {
    if (!state.value.session || !state.value.isHost) return;
    send('group:remove-card', {
      sessionId: state.value.session.id,
      groupId,
      cardId,
    });
  }

  function renameGroup(groupId: string, title: string): void {
    if (!state.value.session || !state.value.isHost) return;
    send('group:rename', { sessionId: state.value.session.id, groupId, title });
  }

  function deleteGroup(groupId: string): void {
    if (!state.value.session || !state.value.isHost) return;
    send('group:delete', { sessionId: state.value.session.id, groupId });
  }

  function startTimer(): void {
    if (!state.value.session || !state.value.isHost) return;
    send('timer:start', { sessionId: state.value.session.id });
  }

  function stopTimer(): void {
    if (!state.value.session || !state.value.isHost) return;
    send('timer:stop', { sessionId: state.value.session.id });
  }

  function setTimerDuration(duration: number): void {
    if (!state.value.session || !state.value.isHost) return;
    send('timer:set', { sessionId: state.value.session.id, duration });
  }

  function leaveSession(): void {
    if (!state.value.session) return;
    send('session:leave', { sessionId: state.value.session.id });
  }

  function addActionItem(
    text: string,
    assignee?: string,
    dueDate?: string
  ): void {
    if (!state.value.session) return;
    send('action:add', {
      sessionId: state.value.session.id,
      text,
      assignee,
      dueDate,
    });
  }

  function editActionItem(
    actionId: string,
    text: string,
    assignee?: string,
    dueDate?: string
  ): void {
    if (!state.value.session || !state.value.isHost) return;
    send('action:edit', {
      sessionId: state.value.session.id,
      actionId,
      text,
      assignee,
      dueDate,
    });
  }

  function deleteActionItem(actionId: string): void {
    if (!state.value.session || !state.value.isHost) return;
    send('action:delete', { sessionId: state.value.session.id, actionId });
  }

  function toggleActionItem(actionId: string): void {
    if (!state.value.session || !state.value.isHost) return;
    send('action:toggle', { sessionId: state.value.session.id, actionId });
  }

  function submitCheckIn(mood: string): void {
    if (!state.value.session) return;
    send('checkin:respond', { sessionId: state.value.session.id, mood });
  }

  function submitFeedback(rating: number): void {
    if (!state.value.session) return;
    send('feedback:respond', { sessionId: state.value.session.id, rating });
  }

  function clearError(): void {
    state.value = { ...state.value, error: null };
  }

  return {
    // State
    session,
    currentParticipant,
    isHost,
    joinCode,
    error,
    connectionStatus,
    participantCount,
    remainingVotes,
    currentPhase,

    // Actions
    createSession,
    joinSession,
    changePhase,
    addCard,
    editCard,
    deleteCard,
    voteCard,
    unvoteCard,
    moveCard,
    createGroup,
    addCardToGroup,
    removeCardFromGroup,
    renameGroup,
    deleteGroup,
    startTimer,
    stopTimer,
    setTimerDuration,
    leaveSession,
    addActionItem,
    editActionItem,
    deleteActionItem,
    toggleActionItem,
    submitCheckIn,
    submitFeedback,
    clearError,
  };
}

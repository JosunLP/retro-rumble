/**
 * useRetroSession Composable
 *
 * Manages the state of a Retro Rumble session with real-time synchronization.
 * Uses WebSocket for multi-user communication.
 */

import type {
    CheckInMood,
    IExtendedSessionState,
    RetroColumnType,
    RetroPhase,
} from '~/types';
import { countGroupVotesForParticipant, normalizePhase } from '~/types';
import type {
    ParticipantJoinedPayload,
    ParticipantLeftPayload,
    SessionCreatedPayload,
    SessionErrorPayload,
    SessionJoinedPayload,
    SessionLeftPayload,
    SessionRejoinedPayload,
    SessionUpdatedPayload,
    TimerTickPayload,
} from '~/types/websocket';
import { mergeSessionSnapshot, normalizeSessionSnapshot } from '~/utils/sessionState';

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
   * i18n for translated error messages (composable runs inside setup())
   */
  const { t } = useI18n();

  /**
   * WebSocket Composable
   */
  const {
    status: connectionStatus,
    send,
    on,
    connect,
    forceReconnect,
  } = useWebSocket({
    autoConnect: true,
    autoReconnect: true,
  });

  /**
   * Reactive session state
   */
  const state = useState<IExtendedSessionState>('retro-session', () => ({
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

  function setSessionState(
    payloadSession: SessionCreatedPayload['session'] | SessionJoinedPayload['session']
  ): void {
    const session = mergeSessionSnapshot(state.value.session, payloadSession);
    const participant = session.participants.find(
      (candidate) => candidate.id === state.value.currentParticipant?.id
    );

    state.value = {
      ...state.value,
      session,
      currentParticipant: participant ?? state.value.currentParticipant,
      isHost: session.hostId === (participant ?? state.value.currentParticipant)?.id,
    };
  }

  function replaceSessionState(
    payloadSession: SessionCreatedPayload['session'] | SessionJoinedPayload['session'],
    participant: SessionCreatedPayload['participant'] | SessionJoinedPayload['participant'],
    joinCodeValue: string,
    hostOverride?: boolean
  ): void {
    const session = normalizeSessionSnapshot(payloadSession);
    state.value = {
      session,
      currentParticipant: participant,
      isHost: hostOverride ?? session.hostId === participant.id,
      isConnected: true,
      error: null,
      joinCode: joinCodeValue,
    };
  }

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
      replaceSessionState(
        payload.session,
        payload.participant,
        payload.joinCode,
        true
      );
    });

    // Session joined
    on<SessionJoinedPayload>('session:joined', (payload) => {
      replaceSessionState(payload.session, payload.participant, payload.joinCode);
    });

    // Session rejoined (after reconnect)
    on<SessionRejoinedPayload>('session:rejoined', (payload) => {
      replaceSessionState(payload.session, payload.participant, payload.joinCode);
    });

    // Session updated
    on<SessionUpdatedPayload>('session:updated', (payload) => {
      if (!state.value.currentParticipant) return;
      setSessionState(payload.session);
    });

    // Participant joined
    on<ParticipantJoinedPayload>('participant:joined', (payload) => {
      if (!state.value.session) return;

      const exists = state.value.session.participants.some(
        (p) => p.id === payload.participant.id
      );
      if (exists) return;

      state.value.session.participants = [
        ...state.value.session.participants,
        payload.participant,
      ];
      state.value = {
        ...state.value,
        session: state.value.session,
      };
    });

    // Participant left
    on<ParticipantLeftPayload>('participant:left', (payload) => {
      if (!state.value.session) return;

      state.value.session.participants = state.value.session.participants.filter(
        (p) => p.id !== payload.participantId
      );
      state.value = {
        ...state.value,
        session: state.value.session,
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
      // Map backend error codes to i18n keys (do not resolve them eagerly)
      const errorKeyMap: Record<string, string> = {
        PAST_DUE_DATE: 'errors.pastDueDate',
        INVALID_DUE_DATE: 'errors.invalidDueDate',
        INVALID_PHASE: 'errors.invalidPhase',
        ACTION_ADD_FAILED: 'errors.actionAddFailed',
        ACTION_EDIT_FAILED: 'errors.actionEditFailed',
        VOTE_GROUP_ONLY: 'errors.voteGroupOnly',
      };

      const specificKey = errorKeyMap[payload.code];
      let specificMessage: string | null = null;
      if (specificKey) {
        const candidate = t(specificKey);
        // If the translation key is missing, most i18n setups return the key itself
        specificMessage = candidate === specificKey ? null : candidate;
      }

      // Generic fallback: use i18n generic error as a last resort
      const genericKey = 'errors.genericError';
      const genericCandidate = t(genericKey);
      const genericMessage = genericCandidate === genericKey ? genericKey : genericCandidate;

      // Prefer a specific mapped message, then server-provided message, then generic i18n
      const message = specificMessage ?? payload.message ?? genericMessage;
      state.value = {
        ...state.value,
        error: message,
      };
    });

    // Auto-rejoin when WebSocket reconnects
    watch(connectionStatus, (newStatus) => {
      if (
        newStatus === 'connected' &&
        state.value.joinCode &&
        state.value.currentParticipant
      ) {
        send('session:rejoin', {
          joinCode: state.value.joinCode,
          participantId: state.value.currentParticipant.id,
        });
      }
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
    const pid = state.value.currentParticipant.id;
    const used = countGroupVotesForParticipant(
      state.value.session.groups,
      pid
    );
    return Math.max(0, state.value.session.maxVotesPerUser - used);
  });

  const currentPhase = computed(
    () => normalizePhase(state.value.session?.phase) ?? 'set-the-stage'
  );

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
      state.value = { ...state.value, error: t('errors.fillAllFields') };
      return;
    }

    const connected = await ensureConnected();
    if (!connected) {
      state.value = {
        ...state.value,
        error: t('errors.connectionFailed'),
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
        error: t('errors.joinCodeLength'),
      };
      return;
    }
    if (!participantName.trim()) {
      state.value = { ...state.value, error: t('errors.enterYourName') };
      return;
    }

    const connected = await ensureConnected();
    if (!connected) {
      state.value = {
        ...state.value,
        error: t('errors.connectionFailed'),
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

  function voteGroup(groupId: string): void {
    if (!state.value.session) return;
    send('group:vote', { sessionId: state.value.session.id, groupId });
  }

  function unvoteGroup(groupId: string): void {
    if (!state.value.session) return;
    send('group:unvote', { sessionId: state.value.session.id, groupId });
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
    if (!state.value.session) return;
    send('group:create', {
      sessionId: state.value.session.id,
      title,
      column,
      cardIds,
    });
  }

  function addCardToGroup(groupId: string, cardId: string): void {
    if (!state.value.session) return;
    send('group:add-card', {
      sessionId: state.value.session.id,
      groupId,
      cardId,
    });
  }

  function removeCardFromGroup(groupId: string, cardId: string): void {
    if (!state.value.session) return;
    send('group:remove-card', {
      sessionId: state.value.session.id,
      groupId,
      cardId,
    });
  }

  function renameGroup(groupId: string, title: string): void {
    if (!state.value.session) return;
    send('group:rename', { sessionId: state.value.session.id, groupId, title });
  }

  function moveGroup(groupId: string, column: RetroColumnType): void {
    if (!state.value.session) return;
    send('group:move', { sessionId: state.value.session.id, groupId, column });
  }

  function deleteGroup(groupId: string): void {
    if (!state.value.session) return;
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

  function submitCheckIn(mood: CheckInMood): void {
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

  /**
   * Manually triggers a reconnect attempt.
   * Closes the current socket (without blocking auto-reconnect)
   * and initiates a fresh connection.
   */
  function reconnect(): void {
    forceReconnect();
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
    voteGroup,
    unvoteGroup,
    moveCard,
    createGroup,
    addCardToGroup,
    removeCardFromGroup,
    renameGroup,
    moveGroup,
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
    reconnect,
  };
}

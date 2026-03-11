/**
 * Session Store for Retro Rumble
 *
 * Server-side singleton that manages all active retro sessions.
 * Maps join codes to sessions and peers to participants.
 */

import type { Peer } from 'crossws';
import type {
    IParticipant,
    IRetroSession,
    RetroColumnType,
    RetroPhase,
} from '../../app/types/retro';
import {
    getYesterdayISODateUTC,
    isPastISODate,
    isValidColumnType,
    isValidISODate,
    isValidPhase,
    JOIN_CODE_CHARS,
    JOIN_CODE_LENGTH,
    MAX_ACTION_ITEM_TEXT_LENGTH,
    MAX_ACTION_ITEMS_PER_SESSION,
    MAX_CARD_CONTENT_LENGTH,
    MAX_CARDS_PER_USER,
    MAX_GROUP_TITLE_LENGTH,
    MAX_PARTICIPANT_NAME_LENGTH,
    MAX_SESSION_NAME_LENGTH,
    sanitizeMaxVotesPerUser,
} from '../../app/types/retro';
import { Participant } from '../../app/utils/Participant';
import { RetroSession } from '../../app/utils/RetroSession';

/**
 * Mapping of peer to session/participant info
 */
interface PeerInfo {
  sessionId: string;
  participantId: string;
}

/**
 * Session entry with join code
 */
interface SessionEntry {
  session: RetroSession;
  joinCode: string;
  connections: Map<string, Peer>; // participantId -> peer
  emptySince: number | null;
}

const SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Strips HTML tags from a string.
 * Defense-in-depth: all user-provided text is plain-text only,
 * so we remove anything that looks like a tag before storing.
 *
 * The regex is applied iteratively to handle nested / malformed constructs
 * such as `<<script>>` which a single pass would miss.
 */
function stripHtml(text: string): string {
  let result = text;
  let previous: string;
  do {
    previous = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== previous);
  // Remove any remaining lone angle brackets as a final safety measure
  return result.replace(/[<>]/g, '');
}

class SessionStore {
  private sessions: Map<string, SessionEntry> = new Map(); // sessionId -> entry
  private joinCodes: Map<string, string> = new Map(); // joinCode -> sessionId
  private peerMap: Map<Peer, PeerInfo> = new Map(); // peer -> info
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, SESSION_CLEANUP_INTERVAL_MS);
  }

  /**
   * Removes sessions that have had no active WebSocket connections for a while.
   * This prevents stale in-memory sessions from accumulating when everyone
   * closes their browser tab without explicitly leaving.
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();

    for (const [sessionId, entry] of this.sessions.entries()) {
      if (entry.connections.size > 0) {
        entry.emptySince = null;
        continue;
      }

      if (!entry.emptySince) {
        entry.emptySince = now;
        continue;
      }

      if (now - entry.emptySince < SESSION_IDLE_TTL_MS) {
        continue;
      }

      entry.session.stopTimer();
      this.joinCodes.delete(entry.joinCode);
      this.sessions.delete(sessionId);
      console.log(`[SessionStore] Session expired (idle timeout): ${sessionId}`);
    }
  }

  /**
   * Generates a unique join code
   */
  private generateJoinCode(): string {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
        code +=
          JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
      }
    } while (this.joinCodes.has(code));
    return code;
  }

  /**
   * Creates a new retro session
   */
  public createSession(
    sessionName: string,
    participantName: string,
    peer: Peer,
    config?: { maxVotesPerUser?: number; timerDuration?: number }
  ): { session: IRetroSession; joinCode: string; participant: Participant } {
    // Validate and sanitize input lengths (strip HTML as defense-in-depth)
    const safeName = stripHtml(sessionName).trim().slice(0, MAX_SESSION_NAME_LENGTH);
    const safeParticipantName = stripHtml(participantName).trim().slice(0, MAX_PARTICIPANT_NAME_LENGTH);
    if (!safeName || !safeParticipantName) {
      throw new Error('SESSION_NAME_EMPTY');
    }
    const participant = new Participant(safeParticipantName, true);
    const session = new RetroSession(safeName, participant.id, {
      maxVotesPerUser: sanitizeMaxVotesPerUser(config?.maxVotesPerUser),
      timerDuration: config?.timerDuration ?? 300,
      anonymousCards: true,
    });

    session.addParticipant(participant);

    const joinCode = this.generateJoinCode();
    const connections = new Map<string, Peer>();
    connections.set(participant.id, peer);

    const entry: SessionEntry = {
      session,
      joinCode,
      connections,
      emptySince: null,
    };
    this.sessions.set(session.id, entry);
    this.joinCodes.set(joinCode, session.id);
    this.peerMap.set(peer, {
      sessionId: session.id,
      participantId: participant.id,
    });

    console.log(`[SessionStore] Session created: ${session.id} (${joinCode})`);
    return { session: session.toJSON(), joinCode, participant };
  }

  /**
   * Joins an existing session
   */
  public joinSession(
    joinCode: string,
    participantName: string,
    peer: Peer
  ): {
    session: IRetroSession;
    joinCode: string;
    participant: Participant;
  } | null {
    const normalizedCode = joinCode.toUpperCase().trim();
    const sessionId = this.joinCodes.get(normalizedCode);
    if (!sessionId) return null;

    const entry = this.sessions.get(sessionId);
    if (!entry) return null;

    const safeParticipantName = stripHtml(participantName).trim().slice(0, MAX_PARTICIPANT_NAME_LENGTH);
    if (!safeParticipantName) return null;

    const participant = new Participant(safeParticipantName, false);
    entry.session.addParticipant(participant);
    entry.connections.set(participant.id, peer);
    entry.emptySince = null;
    this.peerMap.set(peer, { sessionId, participantId: participant.id });

    console.log(
      `[SessionStore] Participant joined: ${participant.name} -> ${sessionId}`
    );
    return {
      session: entry.session.toJSON(),
      joinCode: normalizedCode,
      participant,
    };
  }

  /**
   * Removes a participant when they explicitly leave the session.
   * Handles host transfer when the host leaves.
   */
  public leaveSession(peer: Peer): {
    sessionId: string;
    participantId: string;
    session: IRetroSession | null;
  } | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) {
      this.peerMap.delete(peer);
      return null;
    }

    const wasHost = entry.session.hostId === info.participantId;

    entry.session.removeParticipant(info.participantId);
    entry.connections.delete(info.participantId);
    entry.emptySince = entry.connections.size === 0 ? Date.now() : null;
    this.peerMap.delete(peer);

    // If no participants left, remove the session
    if (entry.session.participants.length === 0) {
      entry.session.stopTimer();
      this.joinCodes.delete(entry.joinCode);
      this.sessions.delete(info.sessionId);
      console.log(`[SessionStore] Session removed (empty): ${info.sessionId}`);
      return {
        sessionId: info.sessionId,
        participantId: info.participantId,
        session: null,
      };
    }

    // Transfer host if the host left
    if (wasHost) {
      const nextHost = entry.session.participants[0];
      if (nextHost) {
        entry.session.transferHost(nextHost.id);
        console.log(
          `[SessionStore] Host transferred to: ${nextHost.name} (${nextHost.id})`
        );
      }
    }

    return {
      sessionId: info.sessionId,
      participantId: info.participantId,
      session: entry.session.toJSON(),
    };
  }

  /**
   * Handles a peer disconnecting (WebSocket close).
   * Unmaps the peer but keeps the participant in the session
   * so they can rejoin.
   */
  public disconnectPeer(peer: Peer): {
    sessionId: string;
    participantId: string;
    session?: IRetroSession;
  } | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) {
      this.peerMap.delete(peer);
      return null;
    }

    // Unmap peer but keep participant in session
    entry.connections.delete(info.participantId);
    entry.emptySince = entry.connections.size === 0 ? Date.now() : null;
    this.peerMap.delete(peer);

    let updatedSession: IRetroSession | undefined;

    // Host fallback: if host disconnects, transfer to an active peer first,
    // then to any remaining participant (so there's always a host if someone reconnects).
    if (entry.session.hostId === info.participantId) {
      const connectedFallback = entry.session.participants.find(
        (p) => p.id !== info.participantId && entry.connections.has(p.id)
      );
      const anyFallback = connectedFallback
        ?? entry.session.participants.find((p) => p.id !== info.participantId);

      if (anyFallback) {
        entry.session.transferHost(anyFallback.id);
        updatedSession = entry.session.toJSON();
        console.log(
          `[SessionStore] Host transferred after disconnect: ${anyFallback.name} (${anyFallback.id})`
        );
      }
    }

    console.log(
      `[SessionStore] Peer disconnected (kept participant): ${info.participantId}`
    );

    return {
      sessionId: info.sessionId,
      participantId: info.participantId,
      session: updatedSession,
    };
  }

  /**
   * Rejoins an existing session with a previously assigned participant ID.
   * Re-maps the new peer to the existing participant.
   */
  public rejoinSession(
    joinCode: string,
    participantId: string,
    peer: Peer
  ): {
    session: IRetroSession;
    joinCode: string;
    participant: IParticipant;
  } | null {
    const normalizedCode = joinCode.toUpperCase().trim();
    const sessionId = this.joinCodes.get(normalizedCode);
    if (!sessionId) return null;

    const entry = this.sessions.get(sessionId);
    if (!entry) return null;

    const participant = entry.session.getParticipantById(participantId);
    if (!participant) return null;

    // Prevent impersonation: if this participant is already actively connected,
    // reject rejoin instead of overwriting the connection.
    if (entry.connections.has(participantId)) {
      console.warn(
        `[SessionStore] Rejoin rejected (participant already connected): ${participantId}`
      );
      return null;
    }

    // If this peer is already mapped (e.g., stale mapping or protocol misuse),
    // clean up the previous session connection before remapping.
    const existingPeerInfo = this.peerMap.get(peer);
    if (existingPeerInfo) {
      const previousEntry = this.sessions.get(existingPeerInfo.sessionId);
      if (previousEntry) {
        previousEntry.connections.delete(existingPeerInfo.participantId);
        previousEntry.emptySince =
          previousEntry.connections.size === 0 ? Date.now() : null;
      }
      this.peerMap.delete(peer);
    }

    // Re-map the new peer to the existing participant
    entry.connections.set(participantId, peer);
    entry.emptySince = null;
    this.peerMap.set(peer, { sessionId, participantId });

    console.log(
      `[SessionStore] Participant rejoined: ${participant.name} -> ${sessionId}`
    );
    return {
      session: entry.session.toJSON(),
      joinCode: normalizedCode,
      participant: participant.toJSON(),
    };
  }

  /**
   * Changes the retro phase (validates sequential progression)
   */
  public changePhase(peer: Peer, phase: RetroPhase): IRetroSession | null {
    if (!isValidPhase(phase)) return null;
    const session = this.getSessionForPeer(peer);
    if (!session) return null;
    if (!this.isHost(peer)) return null;
    const success = session.changePhase(phase);
    return success ? session.toJSON() : null;
  }

  /**
   * Adds a card
   */
  public addCard(
    peer: Peer,
    column: RetroColumnType,
    content: string
  ): IRetroSession | null {
    if (!isValidColumnType(column)) return null;

    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    // Only allow adding cards in the gather-data phase
    if (entry.session.phase !== 'gather-data') return null;

    // Rate limit: prevent card spam per user
    const userCardCount = entry.session.cards.filter(
      (c) => c.authorId === info.participantId
    ).length;
    if (userCardCount >= MAX_CARDS_PER_USER) return null;

    // Validate and sanitize content
    const safeContent = stripHtml(content).trim().slice(0, MAX_CARD_CONTENT_LENGTH);
    if (!safeContent) return null;

    entry.session.addCard(column, safeContent, info.participantId);
    return entry.session.toJSON();
  }

  /**
   * Edits a card
   */
  public editCard(
    peer: Peer,
    cardId: string,
    content: string
  ): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const safeContent = stripHtml(content).trim().slice(0, MAX_CARD_CONTENT_LENGTH);
    if (!safeContent) return null;

    const success = entry.session.editCard(cardId, safeContent, info.participantId);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Deletes a card
   */
  public deleteCard(peer: Peer, cardId: string): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.deleteCard(cardId, info.participantId);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Votes for a card
   */
  public voteCard(peer: Peer, cardId: string): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.voteCard(cardId, info.participantId);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Removes a vote from a card
   */
  public unvoteCard(peer: Peer, cardId: string): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.unvoteCard(cardId, info.participantId);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Moves a card to a different column
   */
  public moveCard(
    peer: Peer,
    cardId: string,
    column: RetroColumnType
  ): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    if (!this.isHost(peer)) return null;

    const success = entry.session.moveCard(cardId, column);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Creates a card group
   */
  public createGroup(
    peer: Peer,
    title: string,
    column: RetroColumnType,
    cardIds: string[]
  ): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const safeTitle = stripHtml(title).trim().slice(0, MAX_GROUP_TITLE_LENGTH) || 'Group';
    const group = session.createGroup(safeTitle, column, cardIds);
    return group ? session.toJSON() : null;
  }

  /**
   * Adds a card to a group
   */
  public addCardToGroup(
    peer: Peer,
    groupId: string,
    cardId: string
  ): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const success = session.addCardToGroup(groupId, cardId);
    return success ? session.toJSON() : null;
  }

  /**
   * Removes a card from a group
   */
  public removeCardFromGroup(
    peer: Peer,
    groupId: string,
    cardId: string
  ): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const success = session.removeCardFromGroup(groupId, cardId);
    return success ? session.toJSON() : null;
  }

  /**
   * Renames a group
   */
  public renameGroup(
    peer: Peer,
    groupId: string,
    title: string
  ): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const safeTitle = stripHtml(title).trim().slice(0, MAX_GROUP_TITLE_LENGTH);
    if (!safeTitle) return null;
    const success = session.renameGroup(groupId, safeTitle);
    return success ? session.toJSON() : null;
  }

  /**
   * Moves a group to a different column
   */
  public moveGroup(
    peer: Peer,
    groupId: string,
    column: RetroColumnType
  ): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const success = session.moveGroup(groupId, column);
    return success ? session.toJSON() : null;
  }

  /**
   * Deletes a group
   */
  public deleteGroup(peer: Peer, groupId: string): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const success = session.deleteGroup(groupId);
    return success ? session.toJSON() : null;
  }

  /**
   * Votes for a group
   */
  public voteGroup(peer: Peer, groupId: string): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.voteGroup(groupId, info.participantId);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Removes a vote from a group
   */
  public unvoteGroup(peer: Peer, groupId: string): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.unvoteGroup(groupId, info.participantId);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Starts the timer
   */
  public startTimer(
    peer: Peer,
    onTick: (sessionId: string, remaining: number) => void,
    onFinished: (sessionId: string) => void
  ): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    entry.session.startTimer(
      (remaining) => onTick(info.sessionId, remaining),
      () => onFinished(info.sessionId)
    );
    return entry.session.toJSON();
  }

  /**
   * Stops the timer
   */
  public stopTimer(peer: Peer): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    session.stopTimer();
    return session.toJSON();
  }

  /**
   * Sets the timer duration.
   * Validates the duration is a finite number; the RetroSession class
   * handles clamping to the allowed range.
   */
  public setTimerDuration(peer: Peer, duration: number): IRetroSession | null {
    if (!this.isHost(peer)) return null;
    if (!Number.isFinite(duration)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    session.setTimerDuration(duration);
    return session.toJSON();
  }

  // ============================================
  // Action Items
  // ============================================

  /**
   * Adds an action item.
   * Rate-limited to MAX_ACTION_ITEMS_PER_SESSION per session.
   * Only allowed during decide-action or close-retro phases.
   */
  public addActionItem(
    peer: Peer,
    text: string,
    assignee?: string,
    dueDate?: string
  ): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    // Phase restriction: action items belong to decide-action or close-retro
    if (session.phase !== 'decide-action' && session.phase !== 'close-retro') {
      return null;
    }

    // Rate limit: prevent unbounded action items
    if (session.actionItems.length >= MAX_ACTION_ITEMS_PER_SESSION) return null;

    const safeText = stripHtml(text).trim().slice(0, MAX_ACTION_ITEM_TEXT_LENGTH);
    if (!safeText) return null;
    const safeAssignee = assignee ? stripHtml(assignee).trim().slice(0, MAX_PARTICIPANT_NAME_LENGTH) || null : null;
    const safeDueDate = this.sanitizeDueDate(dueDate);

    session.addActionItem(safeText, safeAssignee, safeDueDate);
    return session.toJSON();
  }

  /**
   * Edits an action item (host only, decide-action or close-retro phase)
   */
  public editActionItem(
    peer: Peer,
    actionId: string,
    text: string,
    assignee?: string,
    dueDate?: string
  ): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    if (session.phase !== 'decide-action' && session.phase !== 'close-retro') return null;

    const safeText = stripHtml(text).trim().slice(0, MAX_ACTION_ITEM_TEXT_LENGTH);
    if (!safeText) return null;
    const safeAssignee = assignee ? stripHtml(assignee).trim().slice(0, MAX_PARTICIPANT_NAME_LENGTH) || null : null;
    const safeDueDate = this.sanitizeDueDate(dueDate);

    const success = session.editActionItem(
      actionId,
      safeText,
      safeAssignee,
      safeDueDate
    );
    return success ? session.toJSON() : null;
  }

  /**
   * Deletes an action item (host only, decide-action or close-retro phase)
   */
  public deleteActionItem(peer: Peer, actionId: string): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    if (session.phase !== 'decide-action' && session.phase !== 'close-retro') return null;

    const success = session.deleteActionItem(actionId);
    return success ? session.toJSON() : null;
  }

  /**
   * Toggles an action item's done status (host only, decide-action or close-retro phase)
   */
  public toggleActionItem(peer: Peer, actionId: string): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    if (session.phase !== 'decide-action' && session.phase !== 'close-retro') return null;

    const success = session.toggleActionItem(actionId);
    return success ? session.toJSON() : null;
  }

  // ============================================
  // Check-In & Feedback
  // ============================================

  /**
   * Submits a check-in mood for a participant
   */
  public submitCheckIn(peer: Peer, mood: string): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.submitCheckIn(info.participantId, mood);
    return success ? entry.session.toJSON() : null;
  }

  /**
   * Submits a feedback rating for a participant
   */
  public submitFeedback(peer: Peer, rating: number): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    const success = entry.session.submitFeedback(info.participantId, rating);
    return success ? entry.session.toJSON() : null;
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Gets the session for a peer
   */
  private getSessionForPeer(peer: Peer): RetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;
    return this.sessions.get(info.sessionId)?.session ?? null;
  }

  /**
   * Sanitizes and validates an optional due-date string.
   * Returns a valid ISO date (YYYY-MM-DD) or null.
   * Throws INVALID_DUE_DATE or PAST_DUE_DATE when the input is invalid.
   *
   * A 1-day UTC grace window (via getYesterdayISODateUTC) is applied so that
   * users in UTC-behind timezones can submit their local "today" without a
   * false PAST_DUE_DATE rejection. Dates older than yesterday UTC are rejected.
   */
  private sanitizeDueDate(dueDate?: string): string | null {
    if (!dueDate) return null;
    const trimmed = dueDate.trim().slice(0, 10);
    if (!isValidISODate(trimmed)) {
      throw new Error('INVALID_DUE_DATE');
    }
    if (isPastISODate(trimmed, getYesterdayISODateUTC())) {
      throw new Error('PAST_DUE_DATE');
    }
    return trimmed;
  }

  /**
   * Checks if a peer is the host of their session
   */
  private isHost(peer: Peer): boolean {
    const info = this.peerMap.get(peer);
    if (!info) return false;
    const entry = this.sessions.get(info.sessionId);
    if (!entry) return false;
    return entry.session.hostId === info.participantId;
  }

  /**
   * Gets the session ID for a peer
   */
  public getSessionIdForPeer(peer: Peer): string | null {
    return this.peerMap.get(peer)?.sessionId ?? null;
  }

  /**
   * Gets all connections for a session
   */
  public getSessionConnections(sessionId: string): Map<string, Peer> | null {
    return this.sessions.get(sessionId)?.connections ?? null;
  }
}

/**
 * Singleton session store instance
 */
export const sessionStore = new SessionStore();

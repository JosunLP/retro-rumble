/**
 * Session Store for Retro Rumble
 *
 * Server-side singleton that manages all active retro sessions.
 * Maps join codes to sessions and peers to participants.
 */

import type { Peer } from 'crossws';
import type {, 

  IRetroSession,
  RetroColumnType,
  RetroPhase,
} from '../../app/types/retro';
import type { ICardGroup } from '../../app/types/retro';
import { JOIN_CODE_CHARS, JOIN_CODE_LENGTH } from '../../app/types/retro';
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
}

class SessionStore {
  private sessions: Map<string, SessionEntry> = new Map(); // sessionId -> entry
  private joinCodes: Map<string, string> = new Map(); // joinCode -> sessionId
  private peerMap: Map<Peer, PeerInfo> = new Map(); // peer -> info

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
    const participant = new Participant(participantName, true);
    const session = new RetroSession(sessionName, participant.id, {
      maxVotesPerUser: config?.maxVotesPerUser ?? 5,
      timerDuration: config?.timerDuration ?? 300,
      anonymousCards: true,
    });

    session.addParticipant(participant);

    const joinCode = this.generateJoinCode();
    const connections = new Map<string, Peer>();
    connections.set(participant.id, peer);

    const entry: SessionEntry = { session, joinCode, connections };
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

    const participant = new Participant(participantName, false);
    entry.session.addParticipant(participant);
    entry.connections.set(participant.id, peer);
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
   * Removes a participant when they leave or disconnect
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

    entry.session.removeParticipant(info.participantId);
    entry.connections.delete(info.participantId);
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

    return {
      sessionId: info.sessionId,
      participantId: info.participantId,
      session: entry.session.toJSON(),
    };
  }

  /**
   * Changes the retro phase
   */
  public changePhase(peer: Peer, phase: RetroPhase): IRetroSession | null {
    const session = this.getSessionForPeer(peer);
    if (!session) return null;
    if (!this.isHost(peer)) return null;
    session.changePhase(phase);
    return session.toJSON();
  }

  /**
   * Adds a card
   */
  public addCard(
    peer: Peer,
    column: RetroColumnType,
    content: string
  ): IRetroSession | null {
    const info = this.peerMap.get(peer);
    if (!info) return null;

    const entry = this.sessions.get(info.sessionId);
    if (!entry) return null;

    // Only allow adding cards in the writing phase
    if (entry.session.phase !== 'writing') return null;

    entry.session.addCard(column, content, info.participantId);
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

    const success = entry.session.editCard(cardId, content, info.participantId);
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
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const group = session.createGroup(title, column, cardIds);
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
    if (!this.isHost(peer)) return null;

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
    if (!this.isHost(peer)) return null;

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
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const success = session.renameGroup(groupId, title);
    return success ? session.toJSON() : null;
  }

  /**
   * Deletes a group
   */
  public deleteGroup(peer: Peer, groupId: string): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    const success = session.deleteGroup(groupId);
    return success ? session.toJSON() : null;
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
   * Sets the timer duration
   */
  public setTimerDuration(peer: Peer, duration: number): IRetroSession | null {
    if (!this.isHost(peer)) return null;

    const session = this.getSessionForPeer(peer);
    if (!session) return null;

    session.setTimerDuration(duration);
    return session.toJSON();
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

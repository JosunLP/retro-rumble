/**
 * Tests for SessionStore server utility
 *
 * Uses lightweight mock Peer objects (plain objects used as Map keys).
 * The Peer type from crossws is never called upon — it is only stored
 * as a Map key for session lookups.
 */
import { describe, expect, test } from 'bun:test';
import type { Peer } from 'crossws';

// We import the class directly for testing; the exported singleton is not used.
// Re-export the private class by importing the module and casting.
// Since SessionStore is not exported, we test via the exported `sessionStore` singleton
// which is reset between tests by importing fresh instances.
// For true isolation, we extract the class from the module scope using a workaround.

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock Peer object.
 * Only used as a Map key — no methods are called on it.
 */
function makePeer(): Peer {
  return {} as unknown as Peer;
}

// ─── Re-create a fresh SessionStore per test ──────────────────────────────────
// Since the store class is not exported, we test it indirectly through the
// exported singleton. We isolate tests by re-importing and using different
// session state rather than resetting global singletons.

// Import path must resolve relative to workspace root
const { sessionStore } = await import('../server/utils/sessionStore');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SessionStore', () => {
  describe('createSession()', () => {
    test('creates a session and returns session, joinCode, and participant', () => {
      const peer = makePeer();
      const result = sessionStore.createSession('My Retro', 'Alice', peer);
      expect(result.session.name).toBe('My Retro');
      expect(result.joinCode).toHaveLength(6);
      expect(result.participant.name).toBe('Alice');
      expect(result.participant.isHost).toBe(true);
    });

    test('throws when session name is empty', () => {
      const peer = makePeer();
      expect(() => sessionStore.createSession('', 'Bob', peer)).toThrow('SESSION_NAME_EMPTY');
    });

    test('throws when participant name is empty', () => {
      const peer = makePeer();
      expect(() => sessionStore.createSession('Retro', '   ', peer)).toThrow('SESSION_NAME_EMPTY');
    });

    test('trims session name to MAX_SESSION_NAME_LENGTH', () => {
      const peer = makePeer();
      const longName = 'A'.repeat(200);
      const result = sessionStore.createSession(longName, 'Host', peer);
      expect(result.session.name.length).toBeLessThanOrEqual(80);
    });

    test('join code uses only allowed characters', () => {
      const peer = makePeer();
      const { joinCode } = sessionStore.createSession('Test', 'Host', peer);
      // Must not contain O, 0, I, 1, l
      expect(joinCode).not.toMatch(/[O0I1l]/);
      expect(joinCode).toHaveLength(6);
    });
  });

  describe('joinSession()', () => {
    test('allows a second participant to join by code', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Retro X', 'Host', hostPeer);

      const memberPeer = makePeer();
      const result = sessionStore.joinSession(joinCode, 'Member', memberPeer);

      expect(result).not.toBeNull();
      expect(result!.participant.name).toBe('Member');
      expect(result!.participant.isHost).toBe(false);
    });

    test('returns null for unknown join code', () => {
      const peer = makePeer();
      expect(sessionStore.joinSession('XXXXXX', 'Nobody', peer)).toBeNull();
    });

    test('returns null when participant name is empty', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Retro Y', 'Host', hostPeer);
      const memberPeer = makePeer();
      expect(sessionStore.joinSession(joinCode, '  ', memberPeer)).toBeNull();
    });

    test('normalizes join code to uppercase', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Retro Z', 'Host', hostPeer);

      const memberPeer = makePeer();
      // Pass lowercase — store should normalize
      const result = sessionStore.joinSession(joinCode.toLowerCase(), 'Member', memberPeer);
      expect(result).not.toBeNull();
    });
  });

  describe('leaveSession()', () => {
    test('removes participant and returns updated session', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Leave Test', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);

      const result = sessionStore.leaveSession(memberPeer);
      expect(result).not.toBeNull();
      expect(result!.session).not.toBeNull();
      // Only host remains
      expect(result!.session!.participants).toHaveLength(1);
    });

    test('deletes session when last participant leaves', () => {
      const peer = makePeer();
      sessionStore.createSession('Solo Retro', 'Solo', peer);

      const result = sessionStore.leaveSession(peer);
      expect(result).not.toBeNull();
      expect(result!.session).toBeNull(); // session was deleted
    });

    test('returns null for unknown peer', () => {
      const unknown = makePeer();
      expect(sessionStore.leaveSession(unknown)).toBeNull();
    });

    test('transfers host when host leaves', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Host Transfer', 'OldHost', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'NewHost', memberPeer);

      const result = sessionStore.leaveSession(hostPeer);
      expect(result).not.toBeNull();
      expect(result!.session).not.toBeNull();
      // The remaining participant must now be host
      const remaining = result!.session!.participants[0]!;
      expect(remaining.isHost).toBe(true);
    });
  });

  describe('rejoinSession()', () => {
    test('allows a participant to rejoin with their existing ID', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Rejoin Test', 'Host', hostPeer);
      const memberPeer = makePeer();
      const joined = sessionStore.joinSession(joinCode, 'Member', memberPeer)!;

      // Simulate disconnect (peer object changes)
      sessionStore.disconnectPeer(memberPeer);

      const newPeer = makePeer();
      const result = sessionStore.rejoinSession(joinCode, joined.participant.id, newPeer);
      expect(result).not.toBeNull();
      expect(result!.participant.id).toBe(joined.participant.id);
    });

    test('returns null for unknown join code', () => {
      const peer = makePeer();
      expect(sessionStore.rejoinSession('ZZZZZZ', 'some-id', peer)).toBeNull();
    });

    test('returns null when participant no longer exists', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Ghost', 'Host', hostPeer);
      const newPeer = makePeer();
      expect(sessionStore.rejoinSession(joinCode, 'ghost-id', newPeer)).toBeNull();
    });

    test('rejects rejoin when participant is still connected', () => {
      const hostPeer = makePeer();
      const { joinCode, participant } = sessionStore.createSession('Dup', 'Host', hostPeer);
      // Try to rejoin while still connected — should be rejected
      const anotherPeer = makePeer();
      const result = sessionStore.rejoinSession(joinCode, participant.id, anotherPeer);
      expect(result).toBeNull();
    });
  });

  describe('addCard()', () => {
    test('returns null outside gather-data phase', () => {
      const peer = makePeer();
      // Default phase is set-the-stage, not gather-data
      sessionStore.createSession('Card Test', 'Host', peer);
      const result = sessionStore.addCard(peer, 'went-well', 'Good job');
      expect(result).toBeNull();
    });

    test('returns null for empty content', () => {
      const peer = makePeer();
      sessionStore.createSession('Empty Card', 'Host', peer);
      // Move to gather-data phase first
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'went-well', '   ');
      expect(result).toBeNull();
    });
  });

  describe('getSessionIdForPeer()', () => {
    test('returns session id for a connected peer', () => {
      const peer = makePeer();
      const { session } = sessionStore.createSession('ID Test', 'Host', peer);
      expect(sessionStore.getSessionIdForPeer(peer)).toBe(session.id);
    });

    test('returns null for an unknown peer', () => {
      expect(sessionStore.getSessionIdForPeer(makePeer())).toBeNull();
    });
  });

  describe('getSessionConnections()', () => {
    test('returns connections map for an active session', () => {
      const peer = makePeer();
      const { session } = sessionStore.createSession('Conn Test', 'Host', peer);
      const connections = sessionStore.getSessionConnections(session.id);
      expect(connections).not.toBeNull();
      expect(connections!.size).toBe(1);
    });

    test('returns null for an unknown session id', () => {
      expect(sessionStore.getSessionConnections('nonexistent-id')).toBeNull();
    });
  });

  describe('changePhase()', () => {
    test('host can change phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Test', 'Host', peer);
      const result = sessionStore.changePhase(peer, 'gather-data');
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('gather-data');
    });

    test('member cannot change phase', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Phase Guard', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      const result = sessionStore.changePhase(memberPeer, 'gather-data');
      expect(result).toBeNull();
    });

    test('rejects invalid phase value', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Invalid', 'Host', peer);
      // Cast to bypass TS — simulates malicious client payload
      const result = sessionStore.changePhase(peer, 'hacking' as never);
      expect(result).toBeNull();
    });
  });

  describe('addCard()', () => {
    test('rejects invalid column type', () => {
      const peer = makePeer();
      sessionStore.createSession('Col Invalid', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'bad-column' as never, 'Hello');
      expect(result).toBeNull();
    });

    test('strips HTML tags from card content', () => {
      const peer = makePeer();
      sessionStore.createSession('HTML Card', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'went-well', '<b>bold</b> text <script>alert("xss")</script>');
      expect(result).not.toBeNull();
      const card = result!.cards[result!.cards.length - 1];
      expect(card!.content).toBe('bold text alert("xss")');
    });
  });

  describe('createSession() HTML stripping', () => {
    test('strips HTML from session name', () => {
      const peer = makePeer();
      const { session } = sessionStore.createSession('<img>My Retro</img>', 'Host', peer);
      expect(session.name).toBe('My Retro');
    });

    test('strips HTML from participant name', () => {
      const peer = makePeer();
      const { participant } = sessionStore.createSession('Retro', '<b>Alice</b>', peer);
      expect(participant.name).toBe('Alice');
    });
  });

  describe('addActionItem()', () => {
    test('strips invalid due dates', () => {
      const peer = makePeer();
      sessionStore.createSession('Action Date', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      sessionStore.changePhase(peer, 'generate-insights');
      sessionStore.changePhase(peer, 'voting');
      sessionStore.changePhase(peer, 'decide-action');
      const result = sessionStore.addActionItem(peer, 'Fix bug', undefined, 'not-a-date');
      expect(result).not.toBeNull();
      // The action item should have a null dueDate since the input was invalid
      const action = result!.actionItems[result!.actionItems.length - 1];
      expect(action!.dueDate).toBeNull();
    });

    test('accepts valid due dates', () => {
      const peer = makePeer();
      sessionStore.createSession('Action Date OK', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      sessionStore.changePhase(peer, 'generate-insights');
      sessionStore.changePhase(peer, 'voting');
      sessionStore.changePhase(peer, 'decide-action');
      const result = sessionStore.addActionItem(peer, 'Ship feature', undefined, '2025-06-15');
      expect(result).not.toBeNull();
      const action = result!.actionItems[result!.actionItems.length - 1];
      expect(action!.dueDate).toBe('2025-06-15');
    });
  });

  describe('disconnectPeer() host fallback', () => {
    test('transfers host to a connected peer when host disconnects', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Fallback1', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);

      const result = sessionStore.disconnectPeer(hostPeer);
      expect(result).not.toBeNull();
      expect(result!.session).not.toBeUndefined();
      // Member should now be host
      const newHost = result!.session!.participants.find(p => p.isHost);
      expect(newHost).not.toBeUndefined();
      expect(newHost!.name).toBe('Member');
    });

    test('transfers host to disconnected peer when no one is connected', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Fallback2', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);

      // Member disconnects first
      sessionStore.disconnectPeer(memberPeer);
      // Now host disconnects — Member is still a participant but not connected
      const result = sessionStore.disconnectPeer(hostPeer);
      expect(result).not.toBeNull();
      expect(result!.session).not.toBeUndefined();
      // Member should be promoted to host even though disconnected
      const newHost = result!.session!.participants.find(p => p.isHost);
      expect(newHost).not.toBeUndefined();
      expect(newHost!.name).toBe('Member');
    });
  });

  describe('setTimerDuration()', () => {
    test('rejects non-finite duration', () => {
      const peer = makePeer();
      sessionStore.createSession('Timer NaN', 'Host', peer);
      expect(sessionStore.setTimerDuration(peer, NaN)).toBeNull();
      expect(sessionStore.setTimerDuration(peer, Infinity)).toBeNull();
    });

    test('clamps excessively large durations', () => {
      const peer = makePeer();
      sessionStore.createSession('Timer Clamp', 'Host', peer);
      const result = sessionStore.setTimerDuration(peer, 999999);
      expect(result).not.toBeNull();
      expect(result!.timerDuration).toBe(3600);
    });

    test('only host can set timer', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Timer Host', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      expect(sessionStore.setTimerDuration(memberPeer, 120)).toBeNull();
    });
  });

  describe('toggleActionItem()', () => {
    test('host can toggle action item done status', () => {
      const peer = makePeer();
      sessionStore.createSession('Toggle Test', 'Host', peer);
      const addResult = sessionStore.addActionItem(peer, 'Do something');
      expect(addResult).not.toBeNull();
      const actionId = addResult!.actionItems[0]!.id;
      const toggleResult = sessionStore.toggleActionItem(peer, actionId);
      expect(toggleResult).not.toBeNull();
      expect(toggleResult!.actionItems[0]!.done).toBe(true);
    });

    test('non-host cannot toggle action item', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Toggle Guard', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      sessionStore.addActionItem(hostPeer, 'Something');
      // memberPeer tries to toggle — should fail
      expect(sessionStore.toggleActionItem(memberPeer, 'any-id')).toBeNull();
    });
  });
});

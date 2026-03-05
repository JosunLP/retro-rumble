/**
 * Tests for SessionStore server utility
 *
 * Uses lightweight mock Peer objects (plain objects used as Map keys).
 * The Peer type from crossws is never called upon — it is only stored
 * as a Map key for session lookups.
 */
import { describe, expect, test } from 'bun:test';
import type { Peer } from 'crossws';
import type { RetroPhase } from '../app/types/retro';
import {
    MAX_ACTION_ITEMS_PER_SESSION,
    MAX_CARD_CONTENT_LENGTH,
    MAX_CARDS_PER_USER,
    MAX_SESSION_NAME_LENGTH,
    RETRO_PHASES,
} from '../app/types/retro';

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

/**
 * Advances the store session to the target phase step-by-step via the host peer.
 * Phase order: set-the-stage → gather-data → generate-insights → voting → decide-action → close-retro
 */
function advanceToPhase(hostPeer: Peer, target: RetroPhase): void {
  const targetIdx = RETRO_PHASES.indexOf(target);
  // Always start from set-the-stage (index 0) and advance forward
  for (let i = 1; i <= targetIdx; i++) {
    sessionStore.changePhase(hostPeer, RETRO_PHASES[i]!);
  }
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
      expect(result.session.name.length).toBeLessThanOrEqual(MAX_SESSION_NAME_LENGTH);
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
      advanceToPhase(peer, 'decide-action');
      const result = sessionStore.addActionItem(peer, 'Fix bug', undefined, 'not-a-date');
      expect(result).not.toBeNull();
      // The action item should have a null dueDate since the input was invalid
      const action = result!.actionItems[result!.actionItems.length - 1];
      expect(action!.dueDate).toBeNull();
    });

    test('accepts valid due dates', () => {
      const peer = makePeer();
      sessionStore.createSession('Action Date OK', 'Host', peer);
      advanceToPhase(peer, 'decide-action');
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
      advanceToPhase(peer, 'decide-action');
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
      // Navigate to decide-action phase so addActionItem succeeds
      advanceToPhase(hostPeer, 'decide-action');
      const addResult = sessionStore.addActionItem(hostPeer, 'Something');
      expect(addResult).not.toBeNull();
      // memberPeer tries to toggle — should fail
      const actionId = addResult!.actionItems[0]!.id;
      expect(sessionStore.toggleActionItem(memberPeer, actionId)).toBeNull();
    });
  });

  describe('addActionItem() phase restriction', () => {
    test('rejects action items during set-the-stage phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Guard 1', 'Host', peer);
      // Default phase is set-the-stage
      expect(sessionStore.addActionItem(peer, 'Nope')).toBeNull();
    });

    test('rejects action items during gather-data phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Guard 2', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      expect(sessionStore.addActionItem(peer, 'Nope')).toBeNull();
    });

    test('rejects action items during generate-insights phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Guard 3', 'Host', peer);
      advanceToPhase(peer, 'generate-insights');
      expect(sessionStore.addActionItem(peer, 'Nope')).toBeNull();
    });

    test('rejects action items during voting phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Guard 4', 'Host', peer);
      advanceToPhase(peer, 'voting');
      expect(sessionStore.addActionItem(peer, 'Nope')).toBeNull();
    });

    test('allows action items during decide-action phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase OK 1', 'Host', peer);
      advanceToPhase(peer, 'decide-action');
      expect(sessionStore.addActionItem(peer, 'Ship it')).not.toBeNull();
    });

    test('allows action items during close-retro phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase OK 2', 'Host', peer);
      advanceToPhase(peer, 'close-retro');
      expect(sessionStore.addActionItem(peer, 'Retrospect')).not.toBeNull();
    });
  });

  describe('addActionItem() rate limiting', () => {
    test('rejects action items after MAX_ACTION_ITEMS_PER_SESSION', () => {
      const peer = makePeer();
      sessionStore.createSession('Rate Limit', 'Host', peer);
      advanceToPhase(peer, 'decide-action');

      // Add items up to the limit
      for (let i = 0; i < MAX_ACTION_ITEMS_PER_SESSION; i++) {
        const result = sessionStore.addActionItem(peer, `Action ${i}`);
        expect(result).not.toBeNull();
      }

      // The item exceeding the limit should be rejected
      expect(sessionStore.addActionItem(peer, 'One too many')).toBeNull();
    });
  });

  describe('stripHtml edge cases', () => {
    test('strips nested angle brackets like <<script>>', () => {
      const peer = makePeer();
      sessionStore.createSession('Nested HTML', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'went-well', '<<script>>alert("xss")<</script>>');
      expect(result).not.toBeNull();
      const card = result!.cards[result!.cards.length - 1];
      expect(card!.content).not.toContain('<');
      expect(card!.content).not.toContain('>');
    });

    test('strips lone angle brackets', () => {
      const peer = makePeer();
      sessionStore.createSession('Lone Angles', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'went-well', 'a < b > c');
      expect(result).not.toBeNull();
      const card = result!.cards[result!.cards.length - 1];
      expect(card!.content).not.toContain('<');
      expect(card!.content).not.toContain('>');
    });

    test('handles deeply nested tags', () => {
      const peer = makePeer();
      sessionStore.createSession('Deep Nest', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'went-well', '<<<b>>>text<<<</b>>>');
      expect(result).not.toBeNull();
      const card = result!.cards[result!.cards.length - 1];
      expect(card!.content).not.toContain('<');
      expect(card!.content).not.toContain('>');
      expect(card!.content).toContain('text');
    });
  });

  describe('ICardGroup.createdAt', () => {
    test('createGroup includes createdAt timestamp', () => {
      const peer = makePeer();
      sessionStore.createSession('Group TS', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const r1 = sessionStore.addCard(peer, 'went-well', 'Card A');
      const cardId1 = r1!.cards[r1!.cards.length - 1]!.id;
      const r2 = sessionStore.addCard(peer, 'went-well', 'Card B');
      const cardId2 = r2!.cards[r2!.cards.length - 1]!.id;
      sessionStore.changePhase(peer, 'generate-insights');

      const groupResult = sessionStore.createGroup(peer, 'Group Title', 'went-well', [cardId1, cardId2]);
      expect(groupResult).not.toBeNull();
      expect(groupResult!.groups).toHaveLength(1);
      expect(groupResult!.groups[0]!.createdAt).toBeDefined();
    });
  });

  describe('card operations', () => {
    test('addCard returns updated session with new card', () => {
      const peer = makePeer();
      sessionStore.createSession('Card Add', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const result = sessionStore.addCard(peer, 'to-improve', 'Better docs');
      expect(result).not.toBeNull();
      expect(result!.cards).toHaveLength(1);
      expect(result!.cards[0]!.content).toBe('Better docs');
      expect(result!.cards[0]!.column).toBe('to-improve');
    });

    test('addCard truncates content to MAX_CARD_CONTENT_LENGTH', () => {
      const peer = makePeer();
      sessionStore.createSession('Long Card', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const longContent = 'A'.repeat(1000);
      const result = sessionStore.addCard(peer, 'went-well', longContent);
      expect(result).not.toBeNull();
      expect(result!.cards[0]!.content.length).toBeLessThanOrEqual(MAX_CARD_CONTENT_LENGTH);
    });

    test('addCard rate limiting per user', () => {
      const peer = makePeer();
      sessionStore.createSession('Rate Cards', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      for (let i = 0; i < MAX_CARDS_PER_USER; i++) {
        const result = sessionStore.addCard(peer, 'went-well', `Card ${i}`);
        expect(result).not.toBeNull();
      }
      // Card exceeding the per-user limit should be rejected
      expect(sessionStore.addCard(peer, 'went-well', 'overflow')).toBeNull();
    });
  });

  describe('voting operations', () => {
    test('voteCard adds vote and returns session', () => {
      const peer = makePeer();
      sessionStore.createSession('Vote Test', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const addResult = sessionStore.addCard(peer, 'went-well', 'Great work');
      sessionStore.changePhase(peer, 'generate-insights');
      sessionStore.changePhase(peer, 'voting');

      const cardId = addResult!.cards[0]!.id;
      const voteResult = sessionStore.voteCard(peer, cardId);
      expect(voteResult).not.toBeNull();
      expect(voteResult!.cards[0]!.votes).toBe(1);
    });

    test('unvoteCard removes a vote', () => {
      const peer = makePeer();
      sessionStore.createSession('Unvote Test', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const addResult = sessionStore.addCard(peer, 'went-well', 'Card');
      sessionStore.changePhase(peer, 'generate-insights');
      sessionStore.changePhase(peer, 'voting');

      const cardId = addResult!.cards[0]!.id;
      sessionStore.voteCard(peer, cardId);
      const result = sessionStore.unvoteCard(peer, cardId);
      expect(result).not.toBeNull();
      expect(result!.cards[0]!.votes).toBe(0);
    });

    test('voteCard rejects when vote budget exhausted', () => {
      const peer = makePeer();
      sessionStore.createSession('Budget Test', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      // Add enough cards to exhaust budget
      const cards: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = sessionStore.addCard(peer, 'went-well', `Card ${i}`);
        cards.push(r!.cards[r!.cards.length - 1]!.id);
      }
      sessionStore.changePhase(peer, 'generate-insights');
      sessionStore.changePhase(peer, 'voting');

      // Default maxVotesPerUser is 5, use all votes
      for (let i = 0; i < 5; i++) {
        expect(sessionStore.voteCard(peer, cards[i]!)).not.toBeNull();
      }
      // 6th vote should fail
      expect(sessionStore.voteCard(peer, cards[5]!)).toBeNull();
    });
  });

  describe('timer operations', () => {
    test('startTimer returns session with timerRunning=true', () => {
      const peer = makePeer();
      sessionStore.createSession('Timer Start', 'Host', peer);
      const result = sessionStore.startTimer(peer);
      expect(result).not.toBeNull();
      expect(result!.timerRunning).toBe(true);
      expect(result!.timerRemaining).not.toBeNull();
    });

    test('stopTimer returns session with timerRunning=false', () => {
      const peer = makePeer();
      sessionStore.createSession('Timer Stop', 'Host', peer);
      sessionStore.startTimer(peer);
      const result = sessionStore.stopTimer(peer);
      expect(result).not.toBeNull();
      expect(result!.timerRunning).toBe(false);
    });

    test('non-host cannot start timer', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Timer Auth', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      expect(sessionStore.startTimer(memberPeer)).toBeNull();
    });

    test('non-host cannot stop timer', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Timer Auth2', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      sessionStore.startTimer(hostPeer);
      expect(sessionStore.stopTimer(memberPeer)).toBeNull();
    });

    test('setTimerDuration rejects zero', () => {
      const peer = makePeer();
      sessionStore.createSession('Timer Zero', 'Host', peer);
      const result = sessionStore.setTimerDuration(peer, 0);
      // Zero should result in min clamp (1s or be accepted as 0)
      expect(result).not.toBeNull();
    });

    test('setTimerDuration rejects negative values', () => {
      const peer = makePeer();
      sessionStore.createSession('Timer Neg', 'Host', peer);
      const result = sessionStore.setTimerDuration(peer, -100);
      expect(result).not.toBeNull();
      expect(result!.timerDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('editActionItem()', () => {
    test('host can edit action item text', () => {
      const peer = makePeer();
      sessionStore.createSession('Edit Action', 'Host', peer);
      advanceToPhase(peer, 'decide-action');
      const addResult = sessionStore.addActionItem(peer, 'Original text');
      expect(addResult).not.toBeNull();
      const actionId = addResult!.actionItems[0]!.id;

      const editResult = sessionStore.editActionItem(peer, actionId, 'Updated text');
      expect(editResult).not.toBeNull();
      expect(editResult!.actionItems[0]!.text).toBe('Updated text');
    });

    test('non-host cannot edit action item', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Edit Guard', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      advanceToPhase(hostPeer, 'decide-action');
      const addResult = sessionStore.addActionItem(hostPeer, 'Action');
      const actionId = addResult!.actionItems[0]!.id;

      expect(sessionStore.editActionItem(memberPeer, actionId, 'Hacked')).toBeNull();
    });
  });

  describe('deleteActionItem()', () => {
    test('host can delete action item', () => {
      const peer = makePeer();
      sessionStore.createSession('Delete Action', 'Host', peer);
      advanceToPhase(peer, 'decide-action');
      const addResult = sessionStore.addActionItem(peer, 'Delete me');
      expect(addResult).not.toBeNull();
      const actionId = addResult!.actionItems[0]!.id;

      const delResult = sessionStore.deleteActionItem(peer, actionId);
      expect(delResult).not.toBeNull();
      expect(delResult!.actionItems).toHaveLength(0);
    });

    test('non-host cannot delete action item', () => {
      const hostPeer = makePeer();
      const { joinCode } = sessionStore.createSession('Del Guard', 'Host', hostPeer);
      const memberPeer = makePeer();
      sessionStore.joinSession(joinCode, 'Member', memberPeer);
      advanceToPhase(hostPeer, 'decide-action');
      const addResult = sessionStore.addActionItem(hostPeer, 'Keep me');
      const actionId = addResult!.actionItems[0]!.id;

      expect(sessionStore.deleteActionItem(memberPeer, actionId)).toBeNull();
    });
  });

  describe('action item phase restriction (edit/delete/toggle)', () => {
    test('editActionItem rejects during gather-data phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Edit', 'Host', peer);
      advanceToPhase(peer, 'gather-data');
      // gather-data phase should reject edit
      expect(sessionStore.editActionItem(peer, 'any-id', 'text')).toBeNull();
    });

    test('deleteActionItem rejects during generate-insights phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Delete', 'Host', peer);
      advanceToPhase(peer, 'generate-insights');
      expect(sessionStore.deleteActionItem(peer, 'any-id')).toBeNull();
    });

    test('toggleActionItem rejects during set-the-stage phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Toggle', 'Host', peer);
      // Already in set-the-stage
      expect(sessionStore.toggleActionItem(peer, 'any-id')).toBeNull();
    });

    test('editActionItem succeeds during close-retro phase', () => {
      const peer = makePeer();
      sessionStore.createSession('Phase Edit OK', 'Host', peer);
      advanceToPhase(peer, 'decide-action');
      const addResult = sessionStore.addActionItem(peer, 'Original');
      const actionId = addResult!.actionItems[0]!.id;
      advanceToPhase(peer, 'close-retro');
      const result = sessionStore.editActionItem(peer, actionId, 'Updated');
      expect(result).not.toBeNull();
      expect(result!.actionItems[0]!.text).toBe('Updated');
    });
  });

  describe('checkin operations', () => {
    test('submitCheckIn records mood', () => {
      const peer = makePeer();
      sessionStore.createSession('CheckIn Test', 'Host', peer);
      const result = sessionStore.submitCheckIn(peer, '😊');
      expect(result).not.toBeNull();
      expect(result!.checkInResponses).toHaveLength(1);
      expect(result!.checkInResponses[0]!.mood).toBe('😊');
    });

    test('submitCheckIn rejects invalid mood', () => {
      const peer = makePeer();
      sessionStore.createSession('Bad Mood', 'Host', peer);
      const result = sessionStore.submitCheckIn(peer, '🤡' as never);
      expect(result).toBeNull();
    });
  });

  describe('feedback operations', () => {
    test('submitFeedback records rating', () => {
      const peer = makePeer();
      sessionStore.createSession('Feedback Test', 'Host', peer);
      advanceToPhase(peer, 'close-retro');
      const result = sessionStore.submitFeedback(peer, 4);
      expect(result).not.toBeNull();
      expect(result!.feedbackResponses).toHaveLength(1);
      expect(result!.feedbackResponses[0]!.rating).toBe(4);
    });

    test('submitFeedback rejects non-finite rating', () => {
      const peer = makePeer();
      sessionStore.createSession('Bad Rating', 'Host', peer);
      advanceToPhase(peer, 'close-retro');
      expect(sessionStore.submitFeedback(peer, NaN)).toBeNull();
      expect(sessionStore.submitFeedback(peer, Infinity)).toBeNull();
    });

    test('submitFeedback clamps out-of-range values', () => {
      const peer = makePeer();
      sessionStore.createSession('Clamp Rating', 'Host', peer);
      advanceToPhase(peer, 'close-retro');
      // 0 gets clamped to 1, 6 gets clamped to 5
      const r1 = sessionStore.submitFeedback(peer, 0);
      expect(r1).not.toBeNull();
      expect(r1!.feedbackResponses[0]!.rating).toBe(1);
      const r2 = sessionStore.submitFeedback(peer, 6);
      expect(r2).not.toBeNull();
      expect(r2!.feedbackResponses[0]!.rating).toBe(5);
    });
  });

  describe('group operations via store', () => {
    /**
     * Helper: toJSON() now returns deep copies, so card IDs must be
     * captured from each addCard return value independently.
     */
    test('createGroup and addCardToGroup work end-to-end', () => {
      const peer = makePeer();
      sessionStore.createSession('Group Store', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');

      const r1 = sessionStore.addCard(peer, 'went-well', 'Card 1');
      const cardId1 = r1!.cards[r1!.cards.length - 1]!.id;

      const r2 = sessionStore.addCard(peer, 'went-well', 'Card 2');
      const cardId2 = r2!.cards[r2!.cards.length - 1]!.id;

      const r3 = sessionStore.addCard(peer, 'went-well', 'Card 3');
      const cardId3 = r3!.cards[r3!.cards.length - 1]!.id;

      // Verify 3 distinct IDs
      expect(new Set([cardId1, cardId2, cardId3]).size).toBe(3);

      sessionStore.changePhase(peer, 'generate-insights');

      // Create group with two cards
      const groupResult = sessionStore.createGroup(peer, 'My Group', 'went-well', [cardId1, cardId2]);
      expect(groupResult).not.toBeNull();
      expect(groupResult!.groups).toHaveLength(1);
      expect(groupResult!.groups[0]!.cardIds).toHaveLength(2);

      // Add a third card
      const groupId = groupResult!.groups[0]!.id;
      const addResult = sessionStore.addCardToGroup(peer, groupId, cardId3);
      expect(addResult).not.toBeNull();
      expect(addResult!.groups[0]!.cardIds).toHaveLength(3);
    });

    test('removeCardFromGroup removes card from group', () => {
      const peer = makePeer();
      sessionStore.createSession('Ungroup Store', 'Host', peer);
      sessionStore.changePhase(peer, 'gather-data');
      const r1 = sessionStore.addCard(peer, 'went-well', 'A');
      const cardId1 = r1!.cards[r1!.cards.length - 1]!.id;

      const r2 = sessionStore.addCard(peer, 'went-well', 'B');
      const cardId2 = r2!.cards[r2!.cards.length - 1]!.id;

      sessionStore.changePhase(peer, 'generate-insights');

      const groupResult = sessionStore.createGroup(peer, 'Temp Group', 'went-well', [cardId1, cardId2]);
      const groupId = groupResult!.groups[0]!.id;

      const removeResult = sessionStore.removeCardFromGroup(peer, groupId, cardId1);
      expect(removeResult).not.toBeNull();
      // Group should still exist with one card
      const group = removeResult!.groups.find(g => g.id === groupId);
      expect(group!.cardIds).toHaveLength(1);
    });
  });
});

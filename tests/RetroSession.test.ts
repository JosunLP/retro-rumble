/**
 * Tests for RetroSession utility class
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { RetroPhase } from '../app/types/retro';
import { RETRO_PHASES } from '../app/types/retro';
import { Participant } from '../app/utils/Participant';
import { RetroSession } from '../app/utils/RetroSession';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(): RetroSession {
  return new RetroSession('Sprint 1', 'host-id', { maxVotesPerUser: 3 });
}

/**
 * Advances the session to the target phase step-by-step.
 * Phase order: set-the-stage → gather-data → generate-insights → voting → decide-action → close-retro
 */
function advanceToPhase(session: RetroSession, target: RetroPhase): void {
  const currentIndex = RETRO_PHASES.indexOf(session.phase);
  const targetIndex = RETRO_PHASES.indexOf(target);
  if (targetIndex > currentIndex) {
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      session.changePhase(RETRO_PHASES[i]!);
    }
  } else if (targetIndex < currentIndex) {
    for (let i = currentIndex - 1; i >= targetIndex; i--) {
      session.changePhase(RETRO_PHASES[i]!);
    }
  }
}

function addHost(session: RetroSession): Participant {
  const host = new Participant('Host', true, 'host-id');
  session.addParticipant(host);
  return host;
}

function addMember(session: RetroSession, name = 'Member', id = 'member-id'): Participant {
  const p = new Participant(name, false, id);
  session.addParticipant(p);
  return p;
}

// ─── Constructor ───────────────────────────────────────────────────────────────

describe('RetroSession', () => {
  describe('constructor', () => {
    test('sets initial phase to set-the-stage', () => {
      expect(makeSession().phase).toBe('set-the-stage');
    });

    test('trims session name', () => {
      const s = new RetroSession('  My Retro  ', 'h');
      expect(s.name).toBe('My Retro');
    });

    test('starts with empty collections', () => {
      const s = makeSession();
      expect(s.participants).toHaveLength(0);
      expect(s.cards).toHaveLength(0);
      expect(s.groups).toHaveLength(0);
      expect(s.actionItems).toHaveLength(0);
    });

    test('respects config.maxVotesPerUser', () => {
      const s = new RetroSession('R', 'h', { maxVotesPerUser: 7 });
      expect(s.maxVotesPerUser).toBe(7);
    });
  });

  // ─── Participants ─────────────────────────────────────────────────────────

  describe('participant management', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
    });

    test('addParticipant returns true and adds participant', () => {
      const p = new Participant('Alice', false, 'a1');
      expect(session.addParticipant(p)).toBe(true);
      expect(session.participants).toHaveLength(1);
    });

    test('addParticipant rejects duplicate id', () => {
      const p = new Participant('Alice', false, 'dup');
      session.addParticipant(p);
      expect(session.addParticipant(p)).toBe(false);
      expect(session.participants).toHaveLength(1);
    });

    test('removeParticipant removes by id and returns true', () => {
      const p = new Participant('Bob', false, 'bob');
      session.addParticipant(p);
      expect(session.removeParticipant('bob')).toBe(true);
      expect(session.participants).toHaveLength(0);
    });

    test('removeParticipant returns false for unknown id', () => {
      expect(session.removeParticipant('ghost')).toBe(false);
    });

    test('getParticipantById retrieves correct participant', () => {
      const p = new Participant('Carol', false, 'carol');
      session.addParticipant(p);
      expect(session.getParticipantById('carol')).toBe(p);
    });

    test('transferHost changes hostId and flags', () => {
      const host = addHost(session);
      const member = addMember(session);
      expect(session.transferHost(member.id)).toBe(true);
      expect(session.hostId).toBe(member.id);
      expect(member.isHost).toBe(true);
      expect(host.isHost).toBe(false);
    });

    test('transferHost returns false for unknown id', () => {
      expect(session.transferHost('ghost')).toBe(false);
    });
  });

  // ─── Cards ────────────────────────────────────────────────────────────────

  describe('card management', () => {
    let session: RetroSession;
    let hostId: string;
    let memberId: string;

    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      hostId = 'host-id';
      memberId = 'member-id';
    });

    test('addCard creates a card in the correct column', () => {
      const card = session.addCard('went-well', 'Great teamwork', memberId);
      expect(card.column).toBe('went-well');
      expect(card.content).toBe('Great teamwork');
      expect(card.authorId).toBe(memberId);
    });

    test('addCard trims content', () => {
      const card = session.addCard('went-well', '  spaces  ', memberId);
      expect(card.content).toBe('spaces');
    });

    test('editCard allows author to edit own card', () => {
      const card = session.addCard('went-well', 'Original', memberId);
      expect(session.editCard(card.id, 'Edited', memberId)).toBe(true);
      expect(card.content).toBe('Edited');
    });

    test('editCard allows host to edit any card', () => {
      const card = session.addCard('went-well', 'Original', memberId);
      expect(session.editCard(card.id, 'By Host', hostId)).toBe(true);
    });

    test('editCard prevents non-author from editing', () => {
      const card = session.addCard('went-well', 'Mine', memberId);
      const other = new Participant('Other', false, 'other-id');
      session.addParticipant(other);
      expect(session.editCard(card.id, 'Hacked', 'other-id')).toBe(false);
    });

    test('deleteCard removes card and returns true', () => {
      const card = session.addCard('to-improve', 'Slow CI', memberId);
      expect(session.deleteCard(card.id, memberId)).toBe(true);
      expect(session.cards).toHaveLength(0);
    });

    test('deleteCard returns false for unknown card', () => {
      expect(session.deleteCard('ghost', memberId)).toBe(false);
    });

    test('getColumnCards filters by column', () => {
      session.addCard('went-well', 'A', memberId);
      session.addCard('to-improve', 'B', memberId);
      session.addCard('went-well', 'C', memberId);
      expect(session.getColumnCards('went-well')).toHaveLength(2);
      expect(session.getColumnCards('to-improve')).toHaveLength(1);
    });
  });

  // ─── Voting ───────────────────────────────────────────────────────────────

  describe('voting', () => {
    let session: RetroSession;

    beforeEach(() => {
      session = makeSession(); // maxVotesPerUser = 3
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'voting');
    });

    test('voteCard increments votes and voterIds', () => {
      const card = session.addCard('went-well', 'X', 'member-id');
      session.voteCard(card.id, 'member-id');
      expect(card.votes).toBe(1);
      expect(card.voterIds).toContain('member-id');
    });

    test('voteCard returns false outside voting phase', () => {
      advanceToPhase(session, 'decide-action');
      const card = session.addCard('went-well', 'X', 'member-id');
      expect(session.voteCard(card.id, 'member-id')).toBe(false);
    });

    test('voteCard enforces max votes per user', () => {
      const cards = [
        session.addCard('went-well', 'A', 'member-id'),
        session.addCard('went-well', 'B', 'member-id'),
        session.addCard('went-well', 'C', 'member-id'),
        session.addCard('went-well', 'D', 'member-id'),
      ];
      session.voteCard(cards[0]!.id, 'member-id');
      session.voteCard(cards[1]!.id, 'member-id');
      session.voteCard(cards[2]!.id, 'member-id');
      // 4th vote must be rejected
      expect(session.voteCard(cards[3]!.id, 'member-id')).toBe(false);
    });

    test('unvoteCard removes vote', () => {
      const card = session.addCard('went-well', 'X', 'member-id');
      session.voteCard(card.id, 'member-id');
      expect(session.unvoteCard(card.id, 'member-id')).toBe(true);
      expect(card.votes).toBe(0);
    });

    test('getRemainingVotes counts correctly', () => {
      const card = session.addCard('went-well', 'X', 'member-id');
      expect(session.getRemainingVotes('member-id')).toBe(3);
      session.voteCard(card.id, 'member-id');
      expect(session.getRemainingVotes('member-id')).toBe(2);
    });
  });

  // ─── Groups ───────────────────────────────────────────────────────────────

  describe('grouping', () => {
    let session: RetroSession;

    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'generate-insights');
    });

    test('createGroup requires at least 2 cards', () => {
      const card = session.addCard('went-well', 'Solo', 'member-id');
      expect(session.createGroup('Grp', 'went-well', [card.id])).toBeNull();
    });

    test('createGroup assigns groupId to cards', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('My Group', 'went-well', [c1.id, c2.id]);
      expect(group).not.toBeNull();
      expect(c1.groupId).toBe(group!.id);
      expect(c2.groupId).toBe(group!.id);
    });

    test('createGroup returns null outside grouping phase', () => {
      advanceToPhase(session, 'voting');
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      expect(session.createGroup('G', 'went-well', [c1.id, c2.id])).toBeNull();
    });

    test('deleteGroup ungroups cards', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      session.deleteGroup(group.id);
      expect(c1.groupId).toBeNull();
      expect(c2.groupId).toBeNull();
      expect(session.groups).toHaveLength(0);
    });
  });

  // ─── Action Items ─────────────────────────────────────────────────────────

  describe('action items', () => {
    let session: RetroSession;

    beforeEach(() => {
      session = makeSession();
    });

    test('addActionItem creates item with trimmed text', () => {
      const item = session.addActionItem('  Fix CI  ');
      expect(item.text).toBe('Fix CI');
      expect(item.done).toBe(false);
    });

    test('addActionItem stores optional assignee and dueDate', () => {
      const item = session.addActionItem('Deploy', 'Alice', '2025-12-31');
      expect(item.assignee).toBe('Alice');
      expect(item.dueDate).toBe('2025-12-31');
    });

    test('editActionItem updates text', () => {
      const item = session.addActionItem('Old text');
      expect(session.editActionItem(item.id, 'New text')).toBe(true);
      expect(item.text).toBe('New text');
    });

    test('editActionItem returns false for unknown id', () => {
      expect(session.editActionItem('ghost', 'X')).toBe(false);
    });

    test('deleteActionItem removes item', () => {
      const item = session.addActionItem('Remove me');
      expect(session.deleteActionItem(item.id)).toBe(true);
      expect(session.actionItems).toHaveLength(0);
    });

    test('toggleActionItem flips done flag', () => {
      const item = session.addActionItem('Toggle');
      expect(item.done).toBe(false);
      session.toggleActionItem(item.id);
      expect(item.done).toBe(true);
      session.toggleActionItem(item.id);
      expect(item.done).toBe(false);
    });
  });

  // ─── Check-In ─────────────────────────────────────────────────────────────

  describe('check-in', () => {
    let session: RetroSession;

    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      // Phase is already 'set-the-stage'
    });

    test('submitCheckIn stores mood for a known participant', () => {
      expect(session.submitCheckIn('member-id', '😊')).toBe(true);
      expect(session.checkInResponses).toHaveLength(1);
      expect(session.checkInResponses[0]!.mood).toBe('😊');
    });

    test('submitCheckIn rejects unknown participant', () => {
      expect(session.submitCheckIn('ghost', '😊')).toBe(false);
    });

    test('submitCheckIn rejects invalid mood', () => {
      expect(session.submitCheckIn('member-id', 'excited')).toBe(false);
    });

    test('submitCheckIn rejects when not in set-the-stage phase', () => {
      advanceToPhase(session, 'gather-data');
      expect(session.submitCheckIn('member-id', '😊')).toBe(false);
    });

    test('submitCheckIn updates existing response', () => {
      session.submitCheckIn('member-id', '😊');
      session.submitCheckIn('member-id', '😐');
      expect(session.checkInResponses).toHaveLength(1);
      expect(session.checkInResponses[0]!.mood).toBe('😐');
    });
  });

  // ─── Feedback ─────────────────────────────────────────────────────────────

  describe('feedback', () => {
    let session: RetroSession;

    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'close-retro');
    });

    test('submitFeedback stores clamped rating', () => {
      expect(session.submitFeedback('member-id', 4)).toBe(true);
      expect(session.feedbackResponses[0]!.rating).toBe(4);
    });

    test('submitFeedback clamps values below 1 to 1', () => {
      session.submitFeedback('member-id', -5);
      expect(session.feedbackResponses[0]!.rating).toBe(1);
    });

    test('submitFeedback clamps values above 5 to 5', () => {
      session.submitFeedback('member-id', 100);
      expect(session.feedbackResponses[0]!.rating).toBe(5);
    });

    test('submitFeedback rejects when not in close-retro phase', () => {
      advanceToPhase(session, 'gather-data');
      expect(session.submitFeedback('member-id', 3)).toBe(false);
    });
  });

  // ─── Serialization ────────────────────────────────────────────────────────

  describe('toJSON / fromJSON', () => {
    test('round-trips a session with cards and action items', () => {
      const original = makeSession();
      addHost(original);
      addMember(original);
      original.addCard('went-well', 'Nice sprint', 'member-id');
      original.addActionItem('Ship feature X', 'host', '2025-06-01');

      const json = original.toJSON();
      const restored = RetroSession.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.cards).toHaveLength(1);
      expect(restored.actionItems).toHaveLength(1);
      expect(restored.participants).toHaveLength(2);
    });
  });

  // ─── Phase Validation ────────────────────────────────────────────────────

  describe('phase validation', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
    });

    test('changePhase allows forward by one step', () => {
      expect(session.changePhase('gather-data')).toBe(true);
      expect(session.phase).toBe('gather-data');
    });

    test('changePhase allows backward by one step', () => {
      advanceToPhase(session, 'generate-insights');
      expect(session.changePhase('gather-data')).toBe(true);
      expect(session.phase).toBe('gather-data');
    });

    test('changePhase rejects skipping phases forward', () => {
      expect(session.changePhase('generate-insights')).toBe(false);
      expect(session.phase).toBe('set-the-stage');
    });

    test('changePhase rejects skipping phases backward', () => {
      advanceToPhase(session, 'voting');
      expect(session.changePhase('set-the-stage')).toBe(false);
      expect(session.phase).toBe('voting');
    });

    test('changePhase rejects same phase', () => {
      expect(session.changePhase('set-the-stage')).toBe(false);
    });

    test('changePhase stops timer on phase change', () => {
      advanceToPhase(session, 'gather-data');
      session.startTimer();
      expect(session.timerRunning).toBe(true);
      session.changePhase('generate-insights');
      expect(session.timerRunning).toBe(false);
    });
  });

  // ─── Move Card ────────────────────────────────────────────────────────────

  describe('moveCard', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
    });

    test('moves card to different column', () => {
      const card = session.addCard('went-well', 'Test', 'member-id');
      expect(session.moveCard(card.id, 'to-improve')).toBe(true);
      expect(card.column).toBe('to-improve');
    });

    test('returns false for unknown card', () => {
      expect(session.moveCard('ghost', 'to-improve')).toBe(false);
    });
  });

  // ─── Group Operations (extended) ─────────────────────────────────────────

  describe('group operations', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'generate-insights');
    });

    test('addCardToGroup adds card and sets groupId', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      expect(session.addCardToGroup(group.id, c3.id)).toBe(true);
      expect(c3.groupId).toBe(group.id);
      expect(group.cardIds).toContain(c3.id);
    });

    test('addCardToGroup rejects already-grouped card', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      // c1 is already in a group
      expect(session.addCardToGroup(group.id, c1.id)).toBe(false);
    });

    test('addCardToGroup rejects outside generate-insights phase', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'voting');
      expect(session.addCardToGroup(group.id, c3.id)).toBe(false);
    });

    test('removeCardFromGroup removes card and clears groupId', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id, c3.id])!;
      expect(session.removeCardFromGroup(group.id, c3.id)).toBe(true);
      expect(c3.groupId).toBeNull();
      expect(group.cardIds).not.toContain(c3.id);
    });

    test('removeCardFromGroup auto-deletes empty group', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      session.removeCardFromGroup(group.id, c1.id);
      session.removeCardFromGroup(group.id, c2.id);
      expect(session.groups).toHaveLength(0);
    });

    test('removeCardFromGroup rejects card not in group', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      expect(session.removeCardFromGroup(group.id, c3.id)).toBe(false);
    });

    test('renameGroup updates title', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('Old', 'went-well', [c1.id, c2.id])!;
      expect(session.renameGroup(group.id, '  New Title  ')).toBe(true);
      expect(group.title).toBe('New Title');
    });

    test('renameGroup returns false for unknown group', () => {
      expect(session.renameGroup('ghost', 'X')).toBe(false);
    });

    test('moveGroup changes column', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      expect(session.moveGroup(group.id, 'to-improve')).toBe(true);
      expect(group.column).toBe('to-improve');
    });

    test('moveGroup rejects outside generate-insights phase', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'voting');
      expect(session.moveGroup(group.id, 'to-improve')).toBe(false);
    });

    test('moveGroup returns false for unknown group', () => {
      expect(session.moveGroup('ghost', 'went-well')).toBe(false);
    });

    test('deleteGroup returns false for unknown group', () => {
      expect(session.deleteGroup('ghost')).toBe(false);
    });

    test('createGroup filters out already-grouped cards', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      session.createGroup('G1', 'went-well', [c1.id, c2.id]);
      // c1 is already grouped, so only c3 is valid — needs 2, returns null
      expect(session.createGroup('G2', 'went-well', [c1.id, c3.id])).toBeNull();
    });
  });

  // ─── Group Voting ─────────────────────────────────────────────────────────

  describe('group voting', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession(); // maxVotesPerUser = 3
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'generate-insights');
    });

    test('voteGroup increments votes and voterIds', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'voting');
      expect(session.voteGroup(group.id, 'member-id')).toBe(true);
      expect(group.votes).toBe(1);
      expect(group.voterIds).toContain('member-id');
    });

    test('voteGroup returns false outside voting phase', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      // Still in generate-insights phase
      expect(session.voteGroup(group.id, 'member-id')).toBe(false);
    });

    test('voteGroup returns false for unknown group', () => {
      advanceToPhase(session, 'voting');
      expect(session.voteGroup('ghost', 'member-id')).toBe(false);
    });

    test('unvoteGroup removes vote', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'voting');
      session.voteGroup(group.id, 'member-id');
      expect(session.unvoteGroup(group.id, 'member-id')).toBe(true);
      expect(group.votes).toBe(0);
    });

    test('unvoteGroup returns false if not voted', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'voting');
      expect(session.unvoteGroup(group.id, 'member-id')).toBe(false);
    });

    test('mixed card and group votes share the same vote budget', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'voting');
      // Use 2 votes on the card, 1 on the group = 3 total (max)
      session.voteCard(c3.id, 'member-id');
      session.voteCard(c3.id, 'member-id');
      session.voteGroup(group.id, 'member-id');
      expect(session.getRemainingVotes('member-id')).toBe(0);
      // Next vote should be rejected
      expect(session.voteCard(c3.id, 'member-id')).toBe(false);
      expect(session.voteGroup(group.id, 'member-id')).toBe(false);
    });
  });

  // ─── Timer ────────────────────────────────────────────────────────────────

  describe('timer', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
    });

    test('startTimer sets timerRunning and timerRemaining', () => {
      session.startTimer();
      expect(session.timerRunning).toBe(true);
      expect(session.timerRemaining).toBe(session.timerDuration);
      session.stopTimer(); // cleanup
    });

    test('stopTimer resets state', () => {
      session.startTimer();
      session.stopTimer();
      expect(session.timerRunning).toBe(false);
      expect(session.timerRemaining).toBeNull();
    });

    test('double stopTimer does not throw', () => {
      session.startTimer();
      session.stopTimer();
      expect(() => session.stopTimer()).not.toThrow();
    });

    test('setTimerDuration clamps to zero', () => {
      session.setTimerDuration(-10);
      expect(session.timerDuration).toBe(0);
    });

    test('setTimerDuration stores positive value', () => {
      session.setTimerDuration(120);
      expect(session.timerDuration).toBe(120);
    });

    test('startTimer restarts if already running', () => {
      session.setTimerDuration(60);
      session.startTimer();
      session.setTimerDuration(120);
      session.startTimer();
      expect(session.timerRemaining).toBe(120);
      session.stopTimer(); // cleanup
    });
  });

  // ─── Delete Card in Group ────────────────────────────────────────────────

  describe('card deletion cascading', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'generate-insights');
    });

    test('deleting a grouped card removes it from group', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id, c3.id])!;
      session.deleteCard(c1.id, 'member-id');
      expect(group.cardIds).not.toContain(c1.id);
      expect(group.cardIds).toHaveLength(2);
    });

    test('deleting all grouped cards removes the group', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      session.createGroup('G', 'went-well', [c1.id, c2.id]);
      session.deleteCard(c1.id, 'member-id');
      session.deleteCard(c2.id, 'member-id');
      expect(session.groups).toHaveLength(0);
    });
  });

  // ─── Sorted Cards ────────────────────────────────────────────────────────

  describe('getCardsSortedByVotes', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session, 'M2', 'm2');
      advanceToPhase(session, 'voting');
    });

    test('returns cards sorted by votes descending', () => {
      const c1 = session.addCard('went-well', 'A', 'host-id');
      const c2 = session.addCard('went-well', 'B', 'host-id');
      session.voteCard(c2.id, 'host-id');
      const sorted = session.getCardsSortedByVotes();
      expect(sorted[0]!.id).toBe(c2.id);
      expect(sorted[1]!.id).toBe(c1.id);
    });

    test('filters by column when specified', () => {
      session.addCard('went-well', 'A', 'host-id');
      session.addCard('to-improve', 'B', 'host-id');
      const sorted = session.getCardsSortedByVotes('went-well');
      expect(sorted).toHaveLength(1);
      expect(sorted[0]!.column).toBe('went-well');
    });
  });

  // ─── Multiple Participants Voting ─────────────────────────────────────────

  describe('multi-participant voting', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession(); // maxVotesPerUser = 3
      addHost(session);
      addMember(session, 'Alice', 'alice');
      addMember(session, 'Bob', 'bob');
      advanceToPhase(session, 'voting');
    });

    test('multiple users can vote on the same card', () => {
      const card = session.addCard('went-well', 'X', 'host-id');
      session.voteCard(card.id, 'alice');
      session.voteCard(card.id, 'bob');
      expect(card.votes).toBe(2);
    });

    test('one user can vote the same card multiple times up to budget', () => {
      const card = session.addCard('went-well', 'X', 'host-id');
      session.voteCard(card.id, 'alice');
      session.voteCard(card.id, 'alice');
      session.voteCard(card.id, 'alice');
      expect(card.votes).toBe(3);
      // 4th vote exceeds budget
      expect(session.voteCard(card.id, 'alice')).toBe(false);
    });

    test('unvoteCard only removes one vote instance', () => {
      const card = session.addCard('went-well', 'X', 'host-id');
      session.voteCard(card.id, 'alice');
      session.voteCard(card.id, 'alice');
      session.unvoteCard(card.id, 'alice');
      expect(card.votes).toBe(1);
    });
  });
});

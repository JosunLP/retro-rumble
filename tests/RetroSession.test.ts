/**
 * Tests for RetroSession utility class
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Participant } from '../app/utils/Participant';
import { RetroSession } from '../app/utils/RetroSession';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(): RetroSession {
  return new RetroSession('Sprint 1', 'host-id', { maxVotesPerUser: 3 });
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
      session.changePhase('voting');
    });

    test('voteCard increments votes and voterIds', () => {
      const card = session.addCard('went-well', 'X', 'member-id');
      session.voteCard(card.id, 'member-id');
      expect(card.votes).toBe(1);
      expect(card.voterIds).toContain('member-id');
    });

    test('voteCard returns false outside voting phase', () => {
      session.changePhase('set-the-stage');
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
      session.changePhase('generate-insights');
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
      session.changePhase('voting');
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
      session.changePhase('gather-data');
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
      session.changePhase('close-retro');
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
      session.changePhase('gather-data');
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
});

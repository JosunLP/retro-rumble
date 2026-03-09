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
 * Phase order: set-the-stage → gather-data → discuss-topics → cluster-cards → name-groups → voting → decide-action → close-retro
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
      advanceToPhase(session, 'gather-data');
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

    test('voteCard rejects new votes because voting is group-only', () => {
      const card = session.addCard('went-well', 'X', 'member-id');
      expect(session.voteCard(card.id, 'member-id')).toBe(false);
      expect(card.votes).toBe(0);
    });

    test('voteCard returns false outside voting phase', () => {
      advanceToPhase(session, 'decide-action');
      const card = session.addCard('went-well', 'X', 'member-id');
      expect(session.voteCard(card.id, 'member-id')).toBe(false);
    });

    test('group votes enforce max votes per user', () => {
      advanceToPhase(session, 'decide-action');
      advanceToPhase(session, 'voting');
      session.phase = 'cluster-cards';
      const cards = [
        session.addCard('went-well', 'A', 'member-id'),
        session.addCard('went-well', 'B', 'member-id'),
        session.addCard('went-well', 'C', 'member-id'),
        session.addCard('went-well', 'D', 'member-id'),
        session.addCard('went-well', 'E', 'member-id'),
        session.addCard('went-well', 'F', 'member-id'),
      ];
      const groups = [
        session.createGroup('G1', 'went-well', [cards[0]!.id, cards[1]!.id])!,
        session.createGroup('G2', 'went-well', [cards[2]!.id, cards[3]!.id])!,
        session.createGroup('G3', 'went-well', [cards[4]!.id, cards[5]!.id])!,
      ];
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      expect(session.voteGroup(groups[0]!.id, 'member-id')).toBe(true);
      expect(session.voteGroup(groups[1]!.id, 'member-id')).toBe(true);
      expect(session.voteGroup(groups[2]!.id, 'member-id')).toBe(true);
      expect(session.voteGroup(groups[0]!.id, 'member-id')).toBe(false);
    });

    test('unvoteCard can clean up legacy card votes', () => {
      const card = session.addCard('went-well', 'X', 'member-id');
      card.voterIds.push('member-id');
      card.votes = 1;
      expect(session.unvoteCard(card.id, 'member-id')).toBe(true);
      expect(card.votes).toBe(0);
    });

    test('getRemainingVotes counts only group votes', () => {
      session.phase = 'cluster-cards';
      const c1 = session.addCard('went-well', 'X', 'member-id');
      const c2 = session.addCard('went-well', 'Y', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      c1.voterIds.push('member-id');
      c1.votes = 1;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      expect(session.getRemainingVotes('member-id')).toBe(3);
      session.voteGroup(group.id, 'member-id');
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
      advanceToPhase(session, 'cluster-cards');
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

    test('toJSON returns deep copies (no shared references)', () => {
      const session = makeSession();
      addHost(session);
      advanceToPhase(session, 'gather-data');
      session.addCard('went-well', 'Card 1', 'host-id');

      const snap1 = session.toJSON();
      session.addCard('went-well', 'Card 2', 'host-id');
      const snap2 = session.toJSON();

      // snap1 must not reflect the second card added after it was captured
      expect(snap1.cards).toHaveLength(1);
      expect(snap2.cards).toHaveLength(2);
    });

    test('toJSON card mutation does not affect session internals', () => {
      const session = makeSession();
      addHost(session);
      advanceToPhase(session, 'gather-data');
      session.addCard('went-well', 'Original', 'host-id');

      const json = session.toJSON();
      // Mutate the returned object
      json.cards[0]!.content = 'HACKED';

      // Internal state must be unaffected
      const fresh = session.toJSON();
      expect(fresh.cards[0]!.content).toBe('Original');
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
      advanceToPhase(session, 'cluster-cards');
      expect(session.changePhase('discuss-topics')).toBe(true);
      expect(session.phase).toBe('discuss-topics');
    });

    test('changePhase rejects skipping phases forward', () => {
      expect(session.changePhase('cluster-cards')).toBe(false);
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
      session.changePhase('discuss-topics');
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
      advanceToPhase(session, 'cluster-cards');
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

    test('addCardToGroup rejects outside cluster-cards phase', () => {
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
      advanceToPhase(session, 'name-groups');
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

    test('moveGroup rejects outside cluster-cards phase', () => {
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
      advanceToPhase(session, 'cluster-cards');
    });

    test('voteGroup increments votes and voterIds', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      expect(session.voteGroup(group.id, 'member-id')).toBe(true);
      expect(group.votes).toBe(1);
      expect(group.voterIds).toContain('member-id');
    });

    test('voteGroup returns false outside voting phase', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      // Still in cluster-cards phase
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
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      session.voteGroup(group.id, 'member-id');
      expect(session.unvoteGroup(group.id, 'member-id')).toBe(true);
      expect(group.votes).toBe(0);
    });

    test('unvoteGroup returns false if not voted', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      expect(session.unvoteGroup(group.id, 'member-id')).toBe(false);
    });

    test('legacy card votes do not consume the group vote budget', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      c3.voterIds.push('member-id', 'member-id');
      c3.votes = 2;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      session.voteGroup(group.id, 'member-id');
      expect(session.getRemainingVotes('member-id')).toBe(2);
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
      advanceToPhase(session, 'cluster-cards');
    });

    test('deleting a grouped card removes it from group', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      const c3 = session.addCard('went-well', 'C', 'member-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id, c3.id])!;
      // Host can delete cards in any phase (moderation)
      session.deleteCard(c1.id, 'host-id');
      expect(group.cardIds).not.toContain(c1.id);
      expect(group.cardIds).toHaveLength(2);
    });

    test('deleting all grouped cards removes the group', () => {
      const c1 = session.addCard('went-well', 'A', 'member-id');
      const c2 = session.addCard('went-well', 'B', 'member-id');
      session.createGroup('G', 'went-well', [c1.id, c2.id]);
      // Host can delete cards in any phase (moderation)
      session.deleteCard(c1.id, 'host-id');
      session.deleteCard(c2.id, 'host-id');
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
      c2.voterIds.push('host-id');
      c2.votes = 1;
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

    test('multiple users can vote on the same group', () => {
      session.phase = 'cluster-cards';
      const c1 = session.addCard('went-well', 'X', 'host-id');
      const c2 = session.addCard('went-well', 'Y', 'host-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      session.voteGroup(group.id, 'alice');
      session.voteGroup(group.id, 'bob');
      expect(group.votes).toBe(2);
    });

    test('one user can vote the same group multiple times up to budget', () => {
      session.phase = 'cluster-cards';
      const c1 = session.addCard('went-well', 'X', 'host-id');
      const c2 = session.addCard('went-well', 'Y', 'host-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      session.voteGroup(group.id, 'alice');
      session.voteGroup(group.id, 'alice');
      session.voteGroup(group.id, 'alice');
      expect(group.votes).toBe(3);
      // 4th vote exceeds budget
      expect(session.voteGroup(group.id, 'alice')).toBe(false);
    });

    test('unvoteGroup only removes one vote instance', () => {
      session.phase = 'cluster-cards';
      const c1 = session.addCard('went-well', 'X', 'host-id');
      const c2 = session.addCard('went-well', 'Y', 'host-id');
      const group = session.createGroup('G', 'went-well', [c1.id, c2.id])!;
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      session.voteGroup(group.id, 'alice');
      session.voteGroup(group.id, 'alice');
      session.unvoteGroup(group.id, 'alice');
      expect(group.votes).toBe(1);
    });
  });

  // ─── Phase-Guarded Card Editing ───────────────────────────────────────────

  describe('phase-guarded card editing', () => {
    let session: RetroSession;

    beforeEach(() => {
      session = makeSession();
      addHost(session);
      addMember(session);
      advanceToPhase(session, 'gather-data');
    });

    test('non-host cannot edit card outside gather-data', () => {
      const card = session.addCard('went-well', 'Orig', 'member-id');
      advanceToPhase(session, 'cluster-cards');
      expect(session.editCard(card.id, 'Hacked', 'member-id')).toBe(false);
      expect(card.content).toBe('Orig');
    });

    test('host can edit card in any phase (moderation)', () => {
      const card = session.addCard('went-well', 'Orig', 'member-id');
      advanceToPhase(session, 'cluster-cards');
      expect(session.editCard(card.id, 'Moderated', 'host-id')).toBe(true);
      expect(card.content).toBe('Moderated');
    });

    test('non-host cannot delete card outside gather-data', () => {
      const card = session.addCard('went-well', 'To remove', 'member-id');
      advanceToPhase(session, 'cluster-cards');
      expect(session.deleteCard(card.id, 'member-id')).toBe(false);
      expect(session.cards).toHaveLength(1);
    });

    test('host can delete card in any phase (moderation)', () => {
      const card = session.addCard('went-well', 'Bad card', 'member-id');
      advanceToPhase(session, 'voting');
      expect(session.deleteCard(card.id, 'host-id')).toBe(true);
      expect(session.cards).toHaveLength(0);
    });
  });

  // ─── Timer Duration Clamping ──────────────────────────────────────────────

  describe('timer duration clamping', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
    });

    test('setTimerDuration clamps to MAX_TIMER_DURATION', () => {
      session.setTimerDuration(99999);
      expect(session.timerDuration).toBe(RetroSession.MAX_TIMER_DURATION);
    });

    test('setTimerDuration accepts value within range', () => {
      session.setTimerDuration(600);
      expect(session.timerDuration).toBe(600);
    });

    test('MAX_TIMER_DURATION is 3600', () => {
      expect(RetroSession.MAX_TIMER_DURATION).toBe(3600);
    });
  });

  // ─── Phase-Guarded Group Operations ───────────────────────────────────────

  describe('phase-guarded group operations', () => {
    let session: RetroSession;
    beforeEach(() => {
      session = makeSession();
      advanceToPhase(session, 'gather-data');
      session.addCard('went-well', 'Card A', 'host-id');
      session.addCard('went-well', 'Card B', 'host-id');
      advanceToPhase(session, 'cluster-cards');
    });

    test('renameGroup rejects outside name-groups', () => {
      const group = session.createGroup('Grp', 'went-well', session.cards.map(c => c.id))!;
      expect(session.renameGroup(group.id, 'New Title')).toBe(false);
      advanceToPhase(session, 'name-groups');
      advanceToPhase(session, 'voting');
      expect(session.renameGroup(group.id, 'New Title')).toBe(false);
    });

    test('renameGroup works during name-groups', () => {
      const group = session.createGroup('Grp', 'went-well', session.cards.map(c => c.id))!;
      advanceToPhase(session, 'name-groups');
      expect(session.renameGroup(group.id, 'New Title')).toBe(true);
      expect(session.groups[0]!.title).toBe('New Title');
    });

    test('deleteGroup rejects outside cluster-cards', () => {
      const group = session.createGroup('Grp', 'went-well', session.cards.map(c => c.id))!;
      advanceToPhase(session, 'name-groups');
      expect(session.deleteGroup(group.id)).toBe(false);
      expect(session.groups).toHaveLength(1);
    });

    test('deleteGroup works during cluster-cards', () => {
      const group = session.createGroup('Grp', 'went-well', session.cards.map(c => c.id))!;
      expect(session.deleteGroup(group.id)).toBe(true);
      expect(session.groups).toHaveLength(0);
    });
  });
});

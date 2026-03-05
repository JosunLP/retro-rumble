/**
 * Tests for Participant utility class
 */
import { describe, expect, test } from 'bun:test';
import { Participant } from '../app/utils/Participant';

describe('Participant', () => {
  describe('constructor', () => {
    test('creates a participant with trimmed name', () => {
      const p = new Participant('  Alice  ');
      expect(p.name).toBe('Alice');
    });

    test('sets isHost to false by default', () => {
      const p = new Participant('Bob');
      expect(p.isHost).toBe(false);
    });

    test('sets isHost to true when specified', () => {
      const p = new Participant('Carol', true);
      expect(p.isHost).toBe(true);
    });

    test('generates a unique id when none provided', () => {
      const a = new Participant('Alice');
      const b = new Participant('Alice');
      expect(a.id).not.toBe(b.id);
    });

    test('uses provided id when given', () => {
      const p = new Participant('Dave', false, 'fixed-id');
      expect(p.id).toBe('fixed-id');
    });

    test('sets joinedAt to a Date', () => {
      const p = new Participant('Eve');
      expect(p.joinedAt).toBeInstanceOf(Date);
    });
  });

  describe('toJSON()', () => {
    test('returns a plain object matching IParticipant', () => {
      const p = new Participant('Frank', true, 'abc123');
      const json = p.toJSON();
      expect(json).toEqual({
        id: 'abc123',
        name: 'Frank',
        isHost: true,
        joinedAt: p.joinedAt,
      });
    });

    test('returned object is not the same reference', () => {
      const p = new Participant('Grace');
      const json = p.toJSON();
      expect(json).not.toBe(p);
    });
  });

  describe('fromJSON()', () => {
    test('reconstructs a Participant from IParticipant data', () => {
      const data = {
        id: 'xyz',
        name: 'Heidi',
        isHost: false,
        joinedAt: new Date('2024-01-01'),
      };
      const p = Participant.fromJSON(data);
      expect(p).toBeInstanceOf(Participant);
      expect(p.id).toBe('xyz');
      expect(p.name).toBe('Heidi');
      expect(p.isHost).toBe(false);
    });

    test('round-trips through toJSON and fromJSON', () => {
      const original = new Participant('Ivan', true, 'round-trip-id');
      const roundTripped = Participant.fromJSON(original.toJSON());
      expect(roundTripped.id).toBe(original.id);
      expect(roundTripped.name).toBe(original.name);
      expect(roundTripped.isHost).toBe(original.isHost);
    });
  });
});

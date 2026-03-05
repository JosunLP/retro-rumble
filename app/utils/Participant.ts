/**
 * Participant Class
 *
 * Represents a participant in a Retro Rumble session.
 * Encapsulates the logic for participant actions.
 */

import type { IParticipant } from '../types';

export class Participant implements IParticipant {
  public readonly id: string;
  public name: string;
  public isHost: boolean;
  public readonly joinedAt: Date;

  constructor(name: string, isHost = false, id?: string) {
    this.id = id ?? crypto.randomUUID();
    this.name = name.trim();
    this.isHost = isHost;
    this.joinedAt = new Date();
  }

  /**
   * Serializes participant to JSON
   */
  public toJSON(): IParticipant {
    return {
      id: this.id,
      name: this.name,
      isHost: this.isHost,
      joinedAt: this.joinedAt,
    };
  }

  /**
   * Creates a Participant instance from JSON data.
   * Restores the original joinedAt timestamp instead of using the current time.
   */
  public static fromJSON(data: IParticipant): Participant {
    const participant = new Participant(data.name, data.isHost, data.id);
    // Override the joinedAt set by the constructor to restore the original timestamp
    (participant as { joinedAt: Date }).joinedAt = new Date(data.joinedAt);
    return participant;
  }
}

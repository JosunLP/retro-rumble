/**
 * TypeScript Type Definitions for Retro Rumble
 *
 * Central types for the entire application.
 * Follows the Interface-First approach for better type safety.
 */

// ============================================
// Constants
// ============================================

/**
 * Join code configuration
 * Uses characters that are not easily confused (no O/0, I/1/l)
 */
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Content length constraints
 */
export const MAX_CARD_CONTENT_LENGTH = 500;
export const MAX_PARTICIPANT_NAME_LENGTH = 50;
export const MAX_SESSION_NAME_LENGTH = 80;
export const MAX_GROUP_TITLE_LENGTH = 80;
export const MAX_ACTION_ITEM_TEXT_LENGTH = 500;
export const DEFAULT_MAX_VOTES_PER_USER = 5;
export const MIN_MAX_VOTES_PER_USER = 1;
export const MAX_MAX_VOTES_PER_USER = 99;

/**
 * Rate limiting: maximum cards a single participant can create per session
 */
export const MAX_CARDS_PER_USER = 50;

/**
 * Rate limiting: maximum action items per session
 */
export const MAX_ACTION_ITEMS_PER_SESSION = 50;

/**
 * Retro column types
 */
export const RETRO_COLUMNS = [
  'went-well',
  'to-improve',
  'action-items',
] as const;
export type RetroColumnType = (typeof RETRO_COLUMNS)[number];

/**
 * Retro session phases (Scrum Retro Flow)
 *
 * 1. set-the-stage    – Welcome, ice-breaker / check-in
 * 2. gather-data      – Anonymous cards in the retro columns
 * 3. discuss-topics   – Review and discuss collected topics before clustering
 * 4. cluster-cards    – Group related cards into clusters
 * 5. name-groups      – Name and refine created groups
 * 6. voting           – Vote on groups
 * 7. decide-action    – SMART action items, assign & prioritize
 * 8. close-retro      – Feedback, export, summary
 */
export const RETRO_PHASES = [
  'set-the-stage',
  'gather-data',
  'discuss-topics',
  'cluster-cards',
  'name-groups',
  'voting',
  'decide-action',
  'close-retro',
] as const;
export type RetroPhase = (typeof RETRO_PHASES)[number];

export const LEGACY_RETRO_PHASE_ALIASES = {
  'generate-insights': 'cluster-cards',
} as const;
export type LegacyRetroPhase = keyof typeof LEGACY_RETRO_PHASE_ALIASES;

/**
 * Available check-in mood emojis
 */
export const CHECK_IN_MOODS = [
  '😊',
  '😐',
  '😟',
  '🔥',
  '💪',
  '😴',
] as const;
export type CheckInMood = (typeof CHECK_IN_MOODS)[number];

// ============================================
// Validation Functions
// ============================================

/**
 * Validates a join code
 */
export function isValidJoinCode(code: string): boolean {
  if (code.length !== JOIN_CODE_LENGTH) return false;
  return code.split('').every((char) => JOIN_CODE_CHARS.includes(char));
}

/**
 * Formats a join code (uppercase, only allowed characters)
 */
export function formatJoinCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, JOIN_CODE_LENGTH);
}

/**
 * Validates a retro column type
 */
export function isValidColumnType(value: unknown): value is RetroColumnType {
  return (
    typeof value === 'string' &&
    (RETRO_COLUMNS as readonly string[]).includes(value)
  );
}

/**
 * Validates a check-in mood value
 */
export function isValidCheckInMood(value: unknown): value is CheckInMood {
  return (
    typeof value === 'string' &&
    (CHECK_IN_MOODS as readonly string[]).includes(value)
  );
}

/**
 * Validates a retro phase value
 */
export function isValidPhase(value: unknown): value is RetroPhase {
  return (
    typeof value === 'string' &&
    (
      (RETRO_PHASES as readonly string[]).includes(value) ||
      value in LEGACY_RETRO_PHASE_ALIASES
    )
  );
}

/**
 * Normalizes current and legacy retro phase values to the canonical phase list.
 */
export function normalizePhase(value: unknown): RetroPhase | null {
  if (typeof value !== 'string') return null;
  if ((RETRO_PHASES as readonly string[]).includes(value)) {
    return value as RetroPhase;
  }
  return LEGACY_RETRO_PHASE_ALIASES[
    value as LegacyRetroPhase
  ] ?? null;
}

/**
 * Validates an ISO date string (YYYY-MM-DD).
 * Returns true only if the string represents a real calendar date.
 */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Returns today's date in local time as YYYY-MM-DD.
 */
export function getTodayISODate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns true when a valid ISO date lies before today.
 */
export function isPastISODate(
  value: string,
  today: string = getTodayISODate()
): boolean {
  return isValidISODate(value) && value < today;
}

/**
 * Clamps the configurable vote budget to a controlled range.
 */
export function sanitizeMaxVotesPerUser(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_VOTES_PER_USER;
  return Math.max(
    MIN_MAX_VOTES_PER_USER,
    Math.min(MAX_MAX_VOTES_PER_USER, Math.round(value))
  );
}

/**
 * Counts total votes cast by a participant across cards and groups.
 * Works on plain data (IRetroSession) so both client composables and
 * server code can reuse this without needing a class instance.
 */
export function countVotesForParticipant(
  cards: Pick<IRetroCard, 'voterIds'>[],
  groups: Pick<ICardGroup, 'voterIds'>[],
  participantId: string
): number {
  const cardVotes = cards.reduce(
    (count, c) => count + c.voterIds.filter((id) => id === participantId).length,
    0
  );
  const groupVotes = groups.reduce(
    (count, g) => count + g.voterIds.filter((id) => id === participantId).length,
    0
  );
  return cardVotes + groupVotes;
}

/**
 * Counts only group votes for the current voting-budget rules.
 */
export function countGroupVotesForParticipant(
  groups: Pick<ICardGroup, 'voterIds'>[],
  participantId: string
): number {
  return groups.reduce(
    (count, g) => count + g.voterIds.filter((id) => id === participantId).length,
    0
  );
}

// ============================================
// Core Interfaces
// ============================================

/**
 * Represents a single retro card (anonymous note)
 */
export interface IRetroCard {
  /** Unique ID of the card */
  id: string;
  /** Column the card belongs to */
  column: RetroColumnType;
  /** Card content text */
  content: string;
  /** Anonymous author ID (only used internally, never displayed) */
  authorId: string;
  /** Number of votes this card has received */
  votes: number;
  /** IDs of participants who voted for this card */
  voterIds: string[];
  /** Group ID if card is grouped */
  groupId: string | null;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Represents a group of related retro cards
 */
export interface ICardGroup {
  /** Unique ID of the group */
  id: string;
  /** Group title */
  title: string;
  /** Column the group belongs to */
  column: RetroColumnType;
  /** IDs of cards in this group */
  cardIds: string[];
  /** Number of votes this group has received */
  votes: number;
  /** IDs of participants who voted for this group */
  voterIds: string[];
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Represents a participant in a retro session
 */
export interface IParticipant {
  /** Unique ID of the participant */
  id: string;
  /** Display name (can be anonymous alias) */
  name: string;
  /** Is the participant the session host? */
  isHost: boolean;
  /** Time of joining */
  joinedAt: Date;
}

/**
 * Represents a Retro Session
 */
/**
 * Represents an action item committed during the retro
 */
export interface IActionItem {
  /** Unique ID */
  id: string;
  /** Action description */
  text: string;
  /** Assigned participant name (optional) */
  assignee: string | null;
  /** Due date (optional, ISO string) */
  dueDate: string | null;
  /** Completed flag */
  done: boolean;
}

/**
 * Participant check-in response
 */
export interface ICheckInResponse {
  participantId: string;
  mood: CheckInMood;
}

/**
 * Participant feedback response (fist-to-five: 1–5)
 */
export interface IFeedbackResponse {
  participantId: string;
  rating: number;
}

export interface IRetroSession {
  /** Unique session ID */
  id: string;
  /** Session name / title */
  name: string;
  /** Current phase of the retro */
  phase: RetroPhase;
  /** ID of the session host */
  hostId: string;
  /** All participants */
  participants: IParticipant[];
  /** All retro cards */
  cards: IRetroCard[];
  /** Card groups */
  groups: ICardGroup[];
  /** Committed action items */
  actionItems: IActionItem[];
  /** Check-in mood responses (set-the-stage phase) */
  checkInResponses: ICheckInResponse[];
  /** Feedback ratings (close-retro phase, 1–5) */
  feedbackResponses: IFeedbackResponse[];
  /** Maximum votes per participant */
  maxVotesPerUser: number;
  /** Timer duration in seconds (0 = no timer) */
  timerDuration: number;
  /** Timer remaining in seconds (null = timer not running) */
  timerRemaining: number | null;
  /** Is the timer currently running? */
  timerRunning: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Configuration for a retro session
 */
export interface IRetroConfig {
  /** Maximum votes per participant */
  maxVotesPerUser: number;
  /** Default timer duration in seconds */
  timerDuration: number;
  /** Allow anonymous card submission */
  anonymousCards: boolean;
}

/**
 * Session state for client-side management
 */
export interface ISessionState {
  /** Current session */
  session: IRetroSession | null;
  /** Current participant */
  currentParticipant: IParticipant | null;
  /** Is the current user the host? */
  isHost: boolean;
  /** Is connected to server? */
  isConnected: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Extended session state including join code.
 * Used by the retro session composable for client-side state management.
 */
export interface IExtendedSessionState extends ISessionState {
  /** Join code for the current session */
  joinCode: string | null;
}

/**
 * Shared Column Configuration
 *
 * Centralizes column metadata (emoji, colors, icons, CSS classes) used
 * across multiple components. Eliminates duplication and ensures consistency.
 */

import type { RetroColumnType } from '../types';
import { RETRO_COLUMNS } from '../types';

/**
 * Column visual metadata
 */
export interface ColumnMeta {
  /** Language-independent emoji symbol */
  emoji: string;
  /** i18n key for the column label */
  labelKey: string;
  /** Heroicons icon name for the column */
  icon: string;
  /** Icon for empty-state display */
  emptyIcon: string;
  /** Tailwind classes for card backgrounds */
  cardClass: string;
  /** Tailwind class for group container borders */
  groupClass: string;
  /** Tailwind class for header text color */
  headerTextClass: string;
  /** Tailwind class for header background (e.g., PhaseIndicator) */
  headerBgClass: string;
  /** Tailwind class for header border */
  headerBorderClass: string;
  /** Tailwind class for section background */
  bgClass: string;
  /** Tailwind class for section border */
  borderClass: string;
}

/**
 * Centralized column metadata for all retro columns.
 *
 * Used by: ClusterCanvas, VotingBoard, RetroColumn, RetroSummary, useExport
 */
export const COLUMN_META: Record<RetroColumnType, ColumnMeta> = {
  'went-well': {
    emoji: '✅',
    labelKey: 'column.went-well',
    icon: 'heroicons:face-smile',
    emptyIcon: 'heroicons:sparkles',
    cardClass: 'bg-success-50 border-success-200',
    groupClass: 'border-success-200 bg-success-50/30',
    headerTextClass: 'text-success-700',
    headerBgClass: 'bg-success-50',
    headerBorderClass: 'border-success-200',
    bgClass: 'bg-success-50',
    borderClass: 'border-success-200',
  },
  'to-improve': {
    emoji: '⚠️',
    labelKey: 'column.to-improve',
    icon: 'heroicons:exclamation-triangle',
    emptyIcon: 'heroicons:light-bulb',
    cardClass: 'bg-warning-50 border-warning-200',
    groupClass: 'border-warning-200 bg-warning-50/30',
    headerTextClass: 'text-warning-700',
    headerBgClass: 'bg-warning-50',
    headerBorderClass: 'border-warning-200',
    bgClass: 'bg-warning-50',
    borderClass: 'border-warning-200',
  },
  'action-items': {
    emoji: '🎯',
    labelKey: 'column.action-items',
    icon: 'heroicons:rocket-launch',
    emptyIcon: 'heroicons:clipboard-document-check',
    cardClass: 'bg-primary-50 border-primary-200',
    groupClass: 'border-primary-200 bg-primary-50/30',
    headerTextClass: 'text-primary-700',
    headerBgClass: 'bg-primary-50',
    headerBorderClass: 'border-primary-200',
    bgClass: 'bg-primary-50',
    borderClass: 'border-primary-200',
  },
};

/**
 * Ordered list of all retro columns for iteration.
 * Derives from the canonical RETRO_COLUMNS constant (DRY).
 */
export const ORDERED_COLUMNS: readonly RetroColumnType[] = RETRO_COLUMNS;

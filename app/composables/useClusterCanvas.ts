/**
 * useClusterCanvas Composable
 *
 * Free-form 2D canvas for drag-based card clustering.
 * Cards from all columns appear on a single canvas.
 * Pointer-based drag & drop for grouping without column constraints.
 */

import { ref, type Ref } from 'vue';
import type { ICardGroup, IRetroCard, RetroColumnType } from '~/types';

// ---- Layout Constants ----
export const CARD_W = 192;
export const CARD_H = 72;
const GAP = 16;
const MARGIN = 28;
const SECTION_GAP = 56;
const GROUP_PAD = 14;
const GROUP_HEADER = 32;
const SECTION_HEADER = 40;

// ---- Types ----

export interface DragCtx {
  cardId: string;
  originGroupId: string | null;
  offsetX: number;
  offsetY: number;
}

export interface GroupDragCtx {
  groupId: string;
  /** Offset from the group-bounds top-left to the pointer */
  offsetX: number;
  offsetY: number;
  /** Relative card positions within the group at drag start */
  cardOffsets: Record<string, { dx: number; dy: number }>;
}

export interface DropResult {
  type: 'card' | 'group';
  id: string;
}

export interface GroupRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DragAction {
  action: 'create-group' | 'add-to-group' | 'remove-from-group' | 'none';
  cardId: string;
  targetId?: string;
  originGroupId?: string | null;
}

// ---- Composable ----

export function useClusterCanvas(containerRef: Ref<HTMLElement | null>) {
  const positions = ref<Record<string, { x: number; y: number }>>({});
  const dragging = ref<DragCtx | null>(null);
  const draggingGroup = ref<GroupDragCtx | null>(null);
  const dropTarget = ref<DropResult | null>(null);
  const boardSize = ref({ w: 1600, h: 900 });

  // ============================================
  // Layout
  // ============================================

  /**
   * Full auto-layout: positions all cards in organized column sections.
   * Groups are placed below ungrouped cards of their assigned column.
   */
  function autoLayout(cards: IRetroCard[], groups: ICardGroup[]) {
    const pos: Record<string, { x: number; y: number }> = {};
    const cols: RetroColumnType[] = ['went-well', 'to-improve', 'action-items'];
    let sectionX = MARGIN;
    let maxH = 0;

    for (const col of cols) {
      let y = MARGIN + SECTION_HEADER;

      // Ungrouped cards in this column
      const ungrouped = cards.filter((c) => c.column === col && !c.groupId);
      for (const card of ungrouped) {
        pos[card.id] = { x: sectionX, y };
        y += CARD_H + GAP;
      }

      if (ungrouped.length > 0) y += GAP;

      // Groups belonging to this column
      const colGroups = groups.filter((g) => g.column === col);
      for (const group of colGroups) {
        y += GROUP_HEADER;
        for (const cardId of group.cardIds) {
          pos[cardId] = { x: sectionX + GROUP_PAD, y };
          y += CARD_H + Math.round(GAP / 2);
        }
        y += GROUP_PAD + GAP;
      }

      maxH = Math.max(maxH, y);
      sectionX += CARD_W + GROUP_PAD * 2 + SECTION_GAP;
    }

    positions.value = pos;
    boardSize.value = {
      w: Math.max(sectionX + MARGIN, 700),
      h: Math.max(maxH + MARGIN * 3, 500),
    };
  }

  /**
   * Sync: assign positions to new cards, remove stale entries.
   * Does NOT move existing cards.
   */
  function syncPositions(cards: IRetroCard[]) {
    const pos = { ...positions.value };
    const currentIds = new Set(cards.map((c) => c.id));

    // Remove stale
    for (const id of Object.keys(pos)) {
      if (!currentIds.has(id)) delete pos[id];
    }

    // Add new at bottom
    let nextY = MARGIN + SECTION_HEADER;
    const existing = Object.values(pos);
    if (existing.length > 0) {
      nextY = Math.max(...existing.map((p) => p.y)) + CARD_H + GAP;
    }

    for (const card of cards) {
      if (!pos[card.id]) {
        pos[card.id] = { x: MARGIN, y: nextY };
        nextY += CARD_H + GAP;
      }
    }

    positions.value = pos;
  }

  // ============================================
  // Drag Handlers
  // ============================================

  /**
   * Start dragging a card.
   */
  function startDrag(
    cardId: string,
    ev: PointerEvent,
    originGroupId: string | null
  ) {
    const el = containerRef.value;
    if (!el) return;

    const pos = positions.value[cardId];
    if (!pos) return;

    const rect = el.getBoundingClientRect();
    dragging.value = {
      cardId,
      originGroupId,
      offsetX: ev.clientX - rect.left + el.scrollLeft - pos.x,
      offsetY: ev.clientY - rect.top + el.scrollTop - pos.y,
    };
  }

  /**
   * Update drag position and detect drop targets.
   */
  function moveDrag(
    ev: PointerEvent,
    cards: IRetroCard[],
    groups: ICardGroup[]
  ) {
    const d = dragging.value;
    const el = containerRef.value;
    if (!d || !el) return;

    const rect = el.getBoundingClientRect();
    const x = ev.clientX - rect.left + el.scrollLeft - d.offsetX;
    const y = ev.clientY - rect.top + el.scrollTop - d.offsetY;

    positions.value = { ...positions.value, [d.cardId]: { x, y } };
    dropTarget.value = hitTest(
      x + CARD_W / 2,
      y + CARD_H / 2,
      d.cardId,
      cards,
      groups
    );
  }

  /**
   * End drag and return the resulting action.
   */
  function endDrag(): DragAction | null {
    const d = dragging.value;
    if (!d) return null;

    const target = dropTarget.value;
    dragging.value = null;
    dropTarget.value = null;

    if (target?.type === 'card') {
      return {
        action: 'create-group',
        cardId: d.cardId,
        targetId: target.id,
        originGroupId: d.originGroupId,
      };
    }

    if (target?.type === 'group') {
      if (d.originGroupId === target.id) {
        return { action: 'none', cardId: d.cardId };
      }
      return {
        action: 'add-to-group',
        cardId: d.cardId,
        targetId: target.id,
        originGroupId: d.originGroupId,
      };
    }

    if (d.originGroupId) {
      return {
        action: 'remove-from-group',
        cardId: d.cardId,
        originGroupId: d.originGroupId,
      };
    }

    return { action: 'none', cardId: d.cardId };
  }

  // ============================================
  // Group Drag Handlers
  // ============================================

  /**
   * Start dragging an entire group by its header.
   */
  function startGroupDrag(
    groupId: string,
    ev: PointerEvent,
    group: ICardGroup
  ) {
    const el = containerRef.value;
    if (!el) return;

    const bounds = groupBounds(group);
    if (!bounds) return;

    const rect = el.getBoundingClientRect();
    const pointerX = ev.clientX - rect.left + el.scrollLeft;
    const pointerY = ev.clientY - rect.top + el.scrollTop;

    // Record each card's position relative to group bounds origin
    const cardOffsets: Record<string, { dx: number; dy: number }> = {};
    for (const cardId of group.cardIds) {
      const p = positions.value[cardId];
      if (p) {
        cardOffsets[cardId] = {
          dx: p.x - bounds.x,
          dy: p.y - bounds.y,
        };
      }
    }

    draggingGroup.value = {
      groupId,
      offsetX: pointerX - bounds.x,
      offsetY: pointerY - bounds.y,
      cardOffsets,
    };
  }

  /**
   * Update group drag position — moves all cards together.
   */
  function moveGroupDrag(ev: PointerEvent) {
    const dg = draggingGroup.value;
    const el = containerRef.value;
    if (!dg || !el) return;

    const rect = el.getBoundingClientRect();
    const newGroupX = ev.clientX - rect.left + el.scrollLeft - dg.offsetX;
    const newGroupY = ev.clientY - rect.top + el.scrollTop - dg.offsetY;

    const newPos = { ...positions.value };
    for (const [cardId, offset] of Object.entries(dg.cardOffsets)) {
      newPos[cardId] = {
        x: newGroupX + offset.dx,
        y: newGroupY + offset.dy,
      };
    }
    positions.value = newPos;
  }

  /**
   * End group drag.
   */
  function endGroupDrag() {
    draggingGroup.value = null;
  }

  // ============================================
  // Hit Testing
  // ============================================

  /**
   * Hit-test the canvas at the given canvas-space coordinates.
   * Returns the first card or group under the point (excluding excludeId).
   */
  function hitTest(
    x: number,
    y: number,
    excludeId: string,
    cards: IRetroCard[],
    groups: ICardGroup[]
  ): DropResult | null {
    // Cards first (higher priority)
    for (const card of cards) {
      if (card.id === excludeId) continue;
      const p = positions.value[card.id];
      if (!p) continue;
      if (x >= p.x && x <= p.x + CARD_W && y >= p.y && y <= p.y + CARD_H) {
        return card.groupId
          ? { type: 'group', id: card.groupId }
          : { type: 'card', id: card.id };
      }
    }

    // Group bounding boxes
    for (const group of groups) {
      const b = groupBounds(group);
      if (!b) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return { type: 'group', id: group.id };
      }
    }

    return null;
  }

  // ============================================
  // Group Bounds
  // ============================================

  /**
   * Compute the bounding rectangle around all cards in a group.
   * Includes padding for the group header and border.
   */
  function groupBounds(group: ICardGroup): GroupRect | null {
    const pts = group.cardIds
      .map((id) => positions.value[id])
      .filter(Boolean) as { x: number; y: number }[];

    if (pts.length === 0) return null;

    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x)) + CARD_W;
    const maxY = Math.max(...pts.map((p) => p.y)) + CARD_H;

    return {
      x: minX - GROUP_PAD,
      y: minY - GROUP_HEADER - GROUP_PAD,
      w: maxX - minX + GROUP_PAD * 2,
      h: maxY - minY + GROUP_HEADER + GROUP_PAD * 2,
    };
  }

  // ============================================
  // Column Section Headers (for auto-layout labels)
  // ============================================

  /**
   * Get the X positions of the column section headers.
   */
  function getSectionPositions(): { type: RetroColumnType; x: number }[] {
    const cols: RetroColumnType[] = ['went-well', 'to-improve', 'action-items'];
    return cols.map((col, idx) => ({
      type: col,
      x: MARGIN + idx * (CARD_W + GROUP_PAD * 2 + SECTION_GAP),
    }));
  }

  return {
    positions,
    dragging,
    draggingGroup,
    dropTarget,
    boardSize,
    autoLayout,
    syncPositions,
    startDrag,
    moveDrag,
    endDrag,
    startGroupDrag,
    moveGroupDrag,
    endGroupDrag,
    groupBounds,
    getSectionPositions,
  };
}

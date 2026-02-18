/**
 * useClusterCanvas Composable
 *
 * Manages pointer-based drag & drop for card clustering.
 * Uses DOM-based hit testing instead of absolute coordinate tracking.
 * Cards are rendered in a structured column layout — this composable
 * only tracks drag state and resolves drop targets.
 */

import { ref } from 'vue';

// ---- Layout Constants (exported for card sizing) ----
export const CARD_W = 192;
export const CARD_H = 72;

// ---- Types ----

export interface DragCtx {
  cardId: string;
  originGroupId: string | null;
  offsetX: number;
  offsetY: number;
}

export interface DropResult {
  type: 'card' | 'group';
  id: string;
}

export interface DragAction {
  action: 'create-group' | 'add-to-group' | 'remove-from-group' | 'none';
  cardId: string;
  targetId?: string;
  originGroupId?: string | null;
}

// ---- Composable ----

export function useClusterCanvas() {
  const dragging = ref<DragCtx | null>(null);
  const dropTarget = ref<DropResult | null>(null);
  const ghostPos = ref({ x: 0, y: 0 });

  /**
   * Start dragging a card.
   */
  function startDrag(
    cardId: string,
    ev: PointerEvent,
    originGroupId: string | null,
  ) {
    const el = ev.currentTarget as HTMLElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragging.value = {
      cardId,
      originGroupId,
      offsetX: ev.clientX - rect.left,
      offsetY: ev.clientY - rect.top,
    };
    ghostPos.value = { x: rect.left, y: rect.top };
  }

  /**
   * Update drag position and detect drop targets via DOM hit testing.
   */
  function moveDrag(ev: PointerEvent) {
    const d = dragging.value;
    if (!d) return;

    ghostPos.value = {
      x: ev.clientX - d.offsetX,
      y: ev.clientY - d.offsetY,
    };

    // DOM-based hit testing using data attributes
    const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
    let target: DropResult | null = null;

    for (const el of elements) {
      const htmlEl = el as HTMLElement;

      // Check for card drop target (skip the card being dragged)
      const dropCardId = htmlEl.dataset.dropCardId;
      if (dropCardId && dropCardId !== d.cardId) {
        const cardGroupId = htmlEl.dataset.cardGroupId;
        if (cardGroupId) {
          // Card is in a group → target the group
          target = { type: 'group', id: cardGroupId };
        } else {
          target = { type: 'card', id: dropCardId };
        }
        break;
      }

      // Check for group drop target
      const dropGroupId = htmlEl.dataset.dropGroupId;
      if (dropGroupId) {
        target = { type: 'group', id: dropGroupId };
        break;
      }
    }

    dropTarget.value = target;
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
      // If dropped back on own group, no action
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

    // Dragged out of a group → remove from group
    if (d.originGroupId) {
      return {
        action: 'remove-from-group',
        cardId: d.cardId,
        originGroupId: d.originGroupId,
      };
    }

    return { action: 'none', cardId: d.cardId };
  }

  /**
   * Check whether a card is the current drop target.
   */
  function isCardDropTarget(cardId: string): boolean {
    return dropTarget.value?.type === 'card' && dropTarget.value.id === cardId;
  }

  /**
   * Check whether a group is the current drop target.
   */
  function isGroupDropTarget(groupId: string): boolean {
    return (
      dropTarget.value?.type === 'group' && dropTarget.value.id === groupId
    );
  }

  return {
    dragging,
    dropTarget,
    ghostPos,
    startDrag,
    moveDrag,
    endDrag,
    isCardDropTarget,
    isGroupDropTarget,
  };
}

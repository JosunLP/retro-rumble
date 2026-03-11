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

interface PendingDragCtx extends DragCtx {
  startX: number;
  startY: number;
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
  const pendingDrag = ref<PendingDragCtx | null>(null);
  const dropTarget = ref<DropResult | null>(null);
  const ghostPos = ref({ x: 0, y: 0 });
  const scrollContainer = ref<HTMLElement | null>(null);

  const DRAG_START_DISTANCE = 6;
  const AUTO_SCROLL_EDGE = 48;
  const AUTO_SCROLL_STEP = 18;

  function registerScrollContainer(container: HTMLElement | null): void {
    scrollContainer.value = container;
  }

  function maybeStartDragging(ev: PointerEvent): void {
    const pending = pendingDrag.value;
    if (!pending || dragging.value) return;

    const distance = Math.hypot(
      ev.clientX - pending.startX,
      ev.clientY - pending.startY
    );

    if (distance < DRAG_START_DISTANCE) return;

    dragging.value = {
      cardId: pending.cardId,
      originGroupId: pending.originGroupId,
      offsetX: pending.offsetX,
      offsetY: pending.offsetY,
    };
    ghostPos.value = {
      x: ev.clientX - pending.offsetX,
      y: ev.clientY - pending.offsetY,
    };
  }

  function autoScrollContainer(ev: PointerEvent): void {
    const container = scrollContainer.value;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (ev.clientY < rect.top + AUTO_SCROLL_EDGE) {
      container.scrollTop -= AUTO_SCROLL_STEP;
    } else if (ev.clientY > rect.bottom - AUTO_SCROLL_EDGE) {
      container.scrollTop += AUTO_SCROLL_STEP;
    }

    if (ev.clientX < rect.left + AUTO_SCROLL_EDGE) {
      container.scrollLeft -= AUTO_SCROLL_STEP;
    } else if (ev.clientX > rect.right - AUTO_SCROLL_EDGE) {
      container.scrollLeft += AUTO_SCROLL_STEP;
    }
  }

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
    pendingDrag.value = {
      cardId,
      originGroupId,
      startX: ev.clientX,
      startY: ev.clientY,
      offsetX: ev.clientX - rect.left,
      offsetY: ev.clientY - rect.top,
    };
    dragging.value = null;
    dropTarget.value = null;
    ghostPos.value = { x: rect.left, y: rect.top };
  }

  /**
   * Update drag position and detect drop targets via DOM hit testing.
   */
  function moveDrag(ev: PointerEvent) {
    maybeStartDragging(ev);

    const d = dragging.value;
    if (!d) return;

    ghostPos.value = {
      x: ev.clientX - d.offsetX,
      y: ev.clientY - d.offsetY,
    };
    autoScrollContainer(ev);

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
    pendingDrag.value = null;
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
    registerScrollContainer,
  };
}

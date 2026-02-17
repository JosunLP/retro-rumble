/**
 * useDragDrop Composable
 *
 * Manages HTML5 native Drag & Drop state for the retro grouping phase.
 * Tracks which card is being dragged, which drop target is active,
 * and provides helper methods for event handling.
 */

/**
 * Drag data transferred between drag source and drop target
 */
export interface DragData {
  /** ID of the card being dragged */
  cardId: string;
  /** ID of the source group (null if ungrouped) */
  sourceGroupId: string | null;
  /** Column the card belongs to */
  column: string;
}

/**
 * Drop target types for visual feedback
 */
export type DropTargetType = 'card' | 'group' | 'ungrouped-zone';

/**
 * Active drop target for highlight rendering
 */
export interface ActiveDropTarget {
  type: DropTargetType;
  id: string;
}

const DRAG_DATA_TYPE = 'application/retro-card';

/**
 * Composable for drag & drop card grouping
 *
 * @example
 * ```ts
 * const { draggedCard, activeTarget, startDrag, onDragOver, onDrop } = useDragDrop()
 * ```
 */
export function useDragDrop() {
  /** Currently dragged card ID */
  const draggedCardId = ref<string | null>(null);

  /** Current drag data */
  const dragData = ref<DragData | null>(null);

  /** Currently highlighted drop target */
  const activeTarget = ref<ActiveDropTarget | null>(null);

  /** Whether a drag operation is in progress */
  const isDragging = computed(() => draggedCardId.value !== null);

  /**
   * Starts a drag operation on a card
   */
  function startDrag(
    event: DragEvent,
    cardId: string,
    column: string,
    sourceGroupId: string | null = null
  ): void {
    if (!event.dataTransfer) return;

    const data: DragData = { cardId, sourceGroupId, column };

    event.dataTransfer.setData(DRAG_DATA_TYPE, JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';

    draggedCardId.value = cardId;
    dragData.value = data;
  }

  /**
   * Ends a drag operation (cleanup)
   */
  function endDrag(): void {
    draggedCardId.value = null;
    dragData.value = null;
    activeTarget.value = null;
  }

  /**
   * Handles dragover — sets the active drop target for highlighting
   */
  function onDragOver(
    event: DragEvent,
    targetType: DropTargetType,
    targetId: string,
    targetColumn?: string
  ): void {
    if (!event.dataTransfer) return;

    // Only accept our custom drag data
    if (!event.dataTransfer.types.includes(DRAG_DATA_TYPE)) return;

    // Prevent dropping a card onto itself
    if (targetType === 'card' && targetId === draggedCardId.value) return;

    // Prevent cross-column drops (same column only)
    if (
      targetColumn &&
      dragData.value &&
      dragData.value.column !== targetColumn
    )
      return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    activeTarget.value = { type: targetType, id: targetId };
  }

  /**
   * Handles dragleave — clears the active target when leaving
   */
  function onDragLeave(event: DragEvent, targetId: string): void {
    // Only clear if we're leaving the target we were highlighting
    if (activeTarget.value?.id === targetId) {
      // Check if we're leaving to a child element (don't clear)
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      const currentTarget = event.currentTarget as HTMLElement | null;
      if (
        currentTarget &&
        relatedTarget &&
        currentTarget.contains(relatedTarget)
      ) {
        return;
      }
      activeTarget.value = null;
    }
  }

  /**
   * Extracts drag data from a drop event
   */
  function getDropData(event: DragEvent): DragData | null {
    if (!event.dataTransfer) return null;

    try {
      const raw = event.dataTransfer.getData(DRAG_DATA_TYPE);
      if (!raw) return null;
      return JSON.parse(raw) as DragData;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a drop target is currently active/highlighted
   */
  function isDropTarget(targetType: DropTargetType, targetId: string): boolean {
    return (
      activeTarget.value?.type === targetType &&
      activeTarget.value?.id === targetId
    );
  }

  /**
   * Checks if a card is the one currently being dragged
   */
  function isBeingDragged(cardId: string): boolean {
    return draggedCardId.value === cardId;
  }

  return {
    // State
    draggedCardId: readonly(draggedCardId),
    dragData: readonly(dragData),
    activeTarget: readonly(activeTarget),
    isDragging,

    // Methods
    startDrag,
    endDrag,
    onDragOver,
    onDragLeave,
    getDropData,
    isDropTarget,
    isBeingDragged,
  };
}

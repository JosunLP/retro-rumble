<script setup lang="ts">
/**
 * GroupingBoard Component
 *
 * Interactive drag & drop clustering board for the grouping phase.
 * Cards can be dragged onto each other to form groups, dragged
 * into existing groups, or removed from groups.
 *
 * Layout per column:
 * - Ungrouped cards (drag sources + drop targets for new groups)
 * - Existing card clusters (drop targets + drag sources)
 */

import type {
  ICardGroup,
  IRetroCard,
  IRetroSession,
  RetroColumnType,
} from '~/types';
import { RETRO_COLUMNS } from '~/types';

const { t } = useI18n();

interface Props {
  /** The retro session */
  session: IRetroSession;
  /** Is the current user the host? */
  isHost: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  createGroup: [title: string, column: RetroColumnType, cardIds: string[]];
  addCardToGroup: [groupId: string, cardId: string];
  removeCardFromGroup: [groupId: string, cardId: string];
  renameGroup: [groupId: string, title: string];
  deleteGroup: [groupId: string];
}>();

/**
 * Drag & drop composable
 */
const {
  draggedCardId,
  isDragging,
  startDrag,
  endDrag,
  onDragOver,
  onDragLeave,
  getDropData,
  isDropTarget,
  isBeingDragged,
} = useDragDrop();

/**
 * Column configuration
 */
const columnConfig: Record<
  RetroColumnType,
  { icon: string; headerClass: string }
> = {
  'went-well': {
    icon: 'heroicons:face-smile',
    headerClass: 'text-success-700 bg-success-50 border-success-200',
  },
  'to-improve': {
    icon: 'heroicons:exclamation-triangle',
    headerClass: 'text-warning-700 bg-warning-50 border-warning-200',
  },
  'action-items': {
    icon: 'heroicons:rocket-launch',
    headerClass: 'text-primary-700 bg-primary-50 border-primary-200',
  },
};

/**
 * Gets ungrouped cards for a column
 */
function getUngroupedCards(column: RetroColumnType): IRetroCard[] {
  return props.session.cards.filter((c) => c.column === column && !c.groupId);
}

/**
 * Gets groups for a column
 */
function getColumnGroups(column: RetroColumnType): ICardGroup[] {
  return props.session.groups.filter((g) => g.column === column);
}

/**
 * Gets the cards for a specific group
 */
function getGroupCards(group: ICardGroup): IRetroCard[] {
  return group.cardIds
    .map((id) => props.session.cards.find((c) => c.id === id))
    .filter((c): c is IRetroCard => !!c);
}

/**
 * Gets total card count for a column (grouped + ungrouped)
 */
function getColumnCardCount(column: RetroColumnType): number {
  return props.session.cards.filter((c) => c.column === column).length;
}

// ============================================
// Drag & Drop Handlers
// ============================================

/**
 * Start dragging an ungrouped card
 */
function handleCardDragStart(
  event: DragEvent,
  cardId: string,
  column: RetroColumnType
): void {
  startDrag(event, cardId, column, null);
}

/**
 * Start dragging a card that's in a group
 */
function handleGroupedCardDragStart(
  event: DragEvent,
  cardId: string,
  groupId: string
): void {
  const card = props.session.cards.find((c) => c.id === cardId);
  if (!card) return;
  startDrag(event, cardId, card.column, groupId);
}

/**
 * Handles dropping a card onto another ungrouped card → creates new group
 */
function handleCardDrop(
  event: DragEvent,
  targetCardId: string,
  column: RetroColumnType
): void {
  event.preventDefault();

  const data = getDropData(event);
  if (!data || data.cardId === targetCardId) return;
  if (data.column !== column) return;

  // If dragged card is in a group, remove it first
  if (data.sourceGroupId) {
    emit('removeCardFromGroup', data.sourceGroupId, data.cardId);
    // Create group after a small delay so server processes the removal
    setTimeout(() => {
      emit('createGroup', t('grouping.newGroupTitle'), column, [
        targetCardId,
        data.cardId,
      ]);
    }, 100);
  } else {
    emit('createGroup', t('grouping.newGroupTitle'), column, [
      targetCardId,
      data.cardId,
    ]);
  }

  endDrag();
}

/**
 * Handles dropping a card onto a group cluster → adds to group
 */
function handleGroupDrop(
  event: DragEvent,
  groupId: string,
  column: RetroColumnType
): void {
  event.preventDefault();

  const data = getDropData(event);
  if (!data) return;
  if (data.column !== column) return;

  // If already in this group, do nothing
  const group = props.session.groups.find((g) => g.id === groupId);
  if (group?.cardIds.includes(data.cardId)) {
    endDrag();
    return;
  }

  // If coming from another group, remove first
  if (data.sourceGroupId && data.sourceGroupId !== groupId) {
    emit('removeCardFromGroup', data.sourceGroupId, data.cardId);
    setTimeout(() => {
      emit('addCardToGroup', groupId, data.cardId);
    }, 100);
  } else if (!data.sourceGroupId) {
    emit('addCardToGroup', groupId, data.cardId);
  }

  endDrag();
}

/**
 * Handles dropping a card onto the ungrouped zone → ungroups it
 */
function handleUngroupedDrop(event: DragEvent, column: RetroColumnType): void {
  event.preventDefault();

  const data = getDropData(event);
  if (!data) return;
  if (data.column !== column) return;

  // Only meaningful if the card was in a group
  if (data.sourceGroupId) {
    emit('removeCardFromGroup', data.sourceGroupId, data.cardId);
  }

  endDrag();
}

/**
 * Card column-specific styling
 */
function getCardStyle(column: RetroColumnType): string {
  const styles: Record<RetroColumnType, string> = {
    'went-well': 'bg-success-50 border-success-200',
    'to-improve': 'bg-warning-50 border-warning-200',
    'action-items': 'bg-primary-50 border-primary-200',
  };
  return styles[column];
}

function getCardHighlightStyle(column: RetroColumnType): string {
  const styles: Record<RetroColumnType, string> = {
    'went-well':
      'ring-2 ring-success-400 border-success-400 shadow-lg shadow-success-100',
    'to-improve':
      'ring-2 ring-warning-400 border-warning-400 shadow-lg shadow-warning-100',
    'action-items':
      'ring-2 ring-primary-400 border-primary-400 shadow-lg shadow-primary-100',
  };
  return styles[column];
}
</script>

<template>
  <div class="space-y-4">
    <!-- Grouping Instructions -->
    <div
      class="flex items-center gap-3 px-4 py-3 bg-accent-50 border border-accent-200 rounded-xl text-sm text-accent-700"
    >
      <Icon name="heroicons:information-circle" class="w-5 h-5 flex-shrink-0" />
      <p>
        {{
          isHost
            ? t('grouping.instructionsHost')
            : t('grouping.instructionsParticipant')
        }}
      </p>
    </div>

    <!-- Columns Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="column in RETRO_COLUMNS" :key="column" class="flex flex-col">
        <!-- Column Header -->
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-t-xl border font-semibold"
          :class="columnConfig[column].headerClass"
        >
          <Icon :name="columnConfig[column].icon" class="w-5 h-5" />
          <span>{{ t(`column.${column}`) }}</span>
          <span class="ml-auto text-sm font-normal opacity-75">
            {{ getColumnCardCount(column) }}
          </span>
        </div>

        <!-- Column Body -->
        <div
          class="flex-1 p-3 space-y-4 bg-white/50 border-x border-b border-secondary-200 rounded-b-xl overflow-y-auto max-h-[70vh] scrollbar-thin"
        >
          <!-- Ungrouped Cards Section -->
          <div
            class="space-y-2 min-h-[60px] rounded-lg p-2 transition-all duration-200"
            :class="[
              isDragging
                ? 'border-2 border-dashed border-secondary-300 bg-secondary-50/50'
                : 'border-2 border-transparent',
              isDropTarget('ungrouped-zone', column)
                ? 'border-accent-400 bg-accent-50/50'
                : '',
            ]"
            @dragover="onDragOver($event, 'ungrouped-zone', column, column)"
            @dragleave="onDragLeave($event, column)"
            @drop="handleUngroupedDrop($event, column)"
          >
            <!-- Section label when dragging -->
            <div
              v-if="isDragging"
              class="text-xs text-secondary-400 font-medium uppercase tracking-wide mb-1"
            >
              {{ t('grouping.ungrouped') }}
            </div>

            <TransitionGroup name="list">
              <div
                v-for="card in getUngroupedCards(column)"
                :key="card.id"
                class="ungrouped-card p-3 rounded-lg border transition-all duration-200"
                :class="[
                  getCardStyle(column),
                  isBeingDragged(card.id)
                    ? 'opacity-30 scale-95'
                    : 'hover:shadow-md',
                  isDropTarget('card', card.id)
                    ? getCardHighlightStyle(column)
                    : '',
                  isHost ? 'cursor-grab active:cursor-grabbing' : '',
                ]"
                :draggable="isHost"
                @dragstart="handleCardDragStart($event, card.id, column)"
                @dragend="endDrag"
                @dragover="onDragOver($event, 'card', card.id, column)"
                @dragleave="onDragLeave($event, card.id)"
                @drop.stop="handleCardDrop($event, card.id, column)"
              >
                <p
                  class="text-sm text-secondary-800 whitespace-pre-wrap break-words"
                >
                  {{ card.content }}
                </p>

                <!-- Vote badge -->
                <div
                  v-if="card.votes > 0"
                  class="mt-1.5 flex items-center gap-1 text-xs text-secondary-500"
                >
                  <Icon
                    name="heroicons:hand-thumb-up-solid"
                    class="w-3.5 h-3.5"
                  />
                  <span>{{ card.votes }}</span>
                </div>
              </div>
            </TransitionGroup>

            <!-- Empty state -->
            <div
              v-if="
                getUngroupedCards(column).length === 0 &&
                getColumnGroups(column).length === 0
              "
              class="text-center py-6 text-secondary-400"
            >
              <Icon
                name="heroicons:inbox"
                class="w-8 h-8 mx-auto mb-1 opacity-50"
              />
              <p class="text-xs">{{ t('column.empty') }}</p>
            </div>
          </div>

          <!-- Groups / Clusters Section -->
          <div v-if="getColumnGroups(column).length > 0" class="space-y-3">
            <div
              class="text-xs text-secondary-400 font-medium uppercase tracking-wide"
            >
              {{ t('grouping.clusters') }} ({{
                getColumnGroups(column).length
              }})
            </div>

            <TransitionGroup name="list">
              <CardCluster
                v-for="group in getColumnGroups(column)"
                :key="group.id"
                :group="group"
                :cards="getGroupCards(group)"
                :column="column"
                :is-host="isHost"
                :is-drop-target="isDropTarget('group', group.id)"
                :dragged-card-id="draggedCardId"
                @rename-group="(gId, title) => emit('renameGroup', gId, title)"
                @delete-group="(gId) => emit('deleteGroup', gId)"
                @remove-card="
                  (gId, cId) => emit('removeCardFromGroup', gId, cId)
                "
                @drag-start="
                  (e, cId, gId) => handleGroupedCardDragStart(e, cId, gId)
                "
                @drag-over="(e) => onDragOver(e, 'group', group.id, column)"
                @drag-leave="(e) => onDragLeave(e, group.id)"
                @drop="(e) => handleGroupDrop(e, group.id, column)"
              />
            </TransitionGroup>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

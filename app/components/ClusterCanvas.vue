<script setup lang="ts">
/**
 * ClusterCanvas Component
 *
 * Free-form 2D canvas for card clustering during the grouping phase.
 * Cards from all columns are displayed on a single scrollable workspace.
 * Host can drag cards to create/modify groups across columns.
 */

import { CARD_H, CARD_W } from '~/composables/useClusterCanvas';
import type { IRetroCard, IRetroSession, RetroColumnType } from '~/types';

const { t } = useI18n();

const props = defineProps<{
  session: IRetroSession;
  isHost: boolean;
  currentUserId: string;
}>();

const emit = defineEmits<{
  createGroup: [title: string, column: RetroColumnType, cardIds: string[]];
  addCardToGroup: [groupId: string, cardId: string];
  removeCardFromGroup: [groupId: string, cardId: string];
  renameGroup: [groupId: string, title: string];
  deleteGroup: [groupId: string];
}>();

// ---- Canvas Composable ----
const canvasRef = ref<HTMLElement | null>(null);
const {
  positions,
  dragging,
  draggingGroup,
  dropTarget,
  boardSize,
  autoLayout,
  syncPositions,
  ensureMinBoardSize,
  startDrag,
  moveDrag,
  endDrag,
  startGroupDrag,
  moveGroupDrag,
  endGroupDrag,
  groupBounds,
  groupCenter,
  getSectionPositions,
} = useClusterCanvas(canvasRef);

// ---- Maximize State ----
const isMaximized = ref(false);

function toggleMaximize() {
  isMaximized.value = !isMaximized.value;
}

// Close maximized view on Escape
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isMaximized.value) {
    isMaximized.value = false;
  }
}
onMounted(() => document.addEventListener('keydown', handleKeydown));
onUnmounted(() => document.removeEventListener('keydown', handleKeydown));

// Resize observer to keep boardSize in sync with container
let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    ensureMinBoardSize();
  });
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
});
onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

// When toggling maximize, wait for DOM update then recalculate board size
watch(isMaximized, () => {
  nextTick(() => ensureMinBoardSize());
});

// ---- Computed ----
const cards = computed(() => props.session.cards);
const groups = computed(() => props.session.groups);

const columnMeta: Record<RetroColumnType, { emoji: string; cardClass: string }> = {
  'went-well': {
    emoji: '✅',
    cardClass: 'bg-success-50 border-success-200 dark:bg-success-950/30 dark:border-success-800',
  },
  'to-improve': {
    emoji: '⚠️',
    cardClass: 'bg-warning-50 border-warning-200 dark:bg-warning-950/30 dark:border-warning-800',
  },
  'action-items': {
    emoji: '🎯',
    cardClass: 'bg-primary-50 border-primary-200 dark:bg-primary-950/30 dark:border-primary-800',
  },
};

const sectionHeaders = computed(() =>
  getSectionPositions().map((s) => ({
    ...s,
    emoji: columnMeta[s.type].emoji,
    label: t(`column.${s.type}`),
  }))
);

// ---- Lifecycle ----
onMounted(() => {
  autoLayout(cards.value, groups.value);
});

// Re-layout when group structure changes
const groupKey = computed(() =>
  groups.value.map((g) => `${g.id}:${g.cardIds.join(',')}`).join('|')
);
watch(groupKey, () => {
  autoLayout(cards.value, groups.value);
});

// Sync positions when cards are added/removed
const cardIdKey = computed(() =>
  cards.value
    .map((c) => c.id)
    .sort()
    .join(',')
);
watch(cardIdKey, () => {
  syncPositions(cards.value);
});

// ---- Pointer Event Handlers ----
function handlePointerDown(card: IRetroCard, ev: PointerEvent) {
  ev.preventDefault();

  startDrag(card.id, ev, card.groupId);

  const onMove = (e: PointerEvent) => {
    e.preventDefault();
    moveDrag(e, cards.value, groups.value);
  };
  const onUp = () => {
    handleDragEnd();
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function handleDragEnd() {
  const result = endDrag();
  if (!result || result.action === 'none') return;

  switch (result.action) {
    case 'create-group': {
      if (!result.targetId) return;
      const targetCard = cards.value.find((c) => c.id === result.targetId);
      if (!targetCard) return;

      // Remove from origin group first if necessary
      if (result.originGroupId) {
        emit('removeCardFromGroup', result.originGroupId, result.cardId);
      }

      // If target is already in a group, add to that group instead
      if (targetCard.groupId) {
        emit('addCardToGroup', targetCard.groupId, result.cardId);
      } else {
        emit('createGroup', t('grouping.newGroupTitle'), targetCard.column, [
          result.targetId,
          result.cardId,
        ]);
      }
      break;
    }

    case 'add-to-group': {
      if (!result.targetId) return;
      // Remove from origin group first if necessary
      if (result.originGroupId) {
        emit('removeCardFromGroup', result.originGroupId, result.cardId);
      }
      emit('addCardToGroup', result.targetId, result.cardId);
      break;
    }

    case 'remove-from-group': {
      if (!result.originGroupId) return;
      emit('removeCardFromGroup', result.originGroupId, result.cardId);
      break;
    }
  }
}

// ---- Group Pointer Drag ----
function handleGroupPointerDown(
  group: (typeof props.session.groups)[number],
  ev: PointerEvent
) {
  ev.preventDefault();
  ev.stopPropagation();

  startGroupDrag(group.id, ev, group);

  const onMove = (e: PointerEvent) => {
    e.preventDefault();
    moveGroupDrag(e);
  };
  const onUp = () => {
    endGroupDrag();
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ---- Group Actions ----
function handleRenameGroup(groupId: string, ev: Event) {
  const input = ev.target as HTMLInputElement;
  const title = input.value.trim();
  if (title) {
    emit('renameGroup', groupId, title);
  }
}

function handleDeleteGroup(groupId: string) {
  emit('deleteGroup', groupId);
}

function resetLayout() {
  autoLayout(cards.value, groups.value);
}

// ---- Style Helpers ----
function cardStyle(card: IRetroCard) {
  const pos = positions.value[card.id];
  if (!pos) return { display: 'none' } as Record<string, string>;
  const isDraggingCard = dragging.value?.cardId === card.id;
  const isInDraggedGroup =
    draggingGroup.value && card.groupId === draggingGroup.value.groupId;
  return {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    width: `${CARD_W}px`,
    zIndex: isDraggingCard ? '50' : isInDraggedGroup ? '40' : '1',
  };
}

function groupStyle(group: (typeof props.session.groups)[number]) {
  const b = groupBounds(group);
  if (!b) return { display: 'none' } as Record<string, string>;
  return {
    transform: `translate(${b.x}px, ${b.y}px)`,
    width: `${b.w}px`,
    height: `${b.h}px`,
    zIndex: draggingGroup.value?.groupId === group.id ? '39' : '0',
  };
}

function groupLabelStyle(group: (typeof props.session.groups)[number]) {
  const center = groupCenter(group);
  if (!center) return { display: 'none' } as Record<string, string>;
  return {
    left: `${center.x}px`,
    top: `${center.y}px`,
    transform: 'translate(-50%, -50%)',
    zIndex: draggingGroup.value?.groupId === group.id ? '45' : '10',
  };
}

function isCardDropTarget(cardId: string): boolean {
  return dropTarget.value?.type === 'card' && dropTarget.value.id === cardId;
}

function isGroupDropTarget(groupId: string): boolean {
  return dropTarget.value?.type === 'group' && dropTarget.value.id === groupId;
}
</script>

<template>
  <Teleport to="body" :disabled="!isMaximized">
    <div
      class="flex flex-col overflow-hidden bg-white dark:bg-secondary-800 transition-all duration-300"
      :class="[
        isMaximized
          ? 'fixed inset-0 z-[100] rounded-none'
          : 'rounded-xl shadow-sm border border-secondary-200 dark:border-secondary-700',
      ]"
    >
      <!-- Toolbar -->
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-secondary-50 dark:bg-secondary-800 border-b border-secondary-200 dark:border-secondary-700"
      >
        <div
          class="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400"
        >
          <Icon
            name="heroicons:information-circle"
            class="w-4 h-4 flex-shrink-0"
          />
          <span>{{
            t('grouping.instructionsHost')
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-600 transition-colors"
            @click="resetLayout"
          >
            <Icon name="heroicons:arrow-path" class="w-3.5 h-3.5" />
            {{ t('grouping.resetLayout') }}
          </button>
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-600 transition-colors"
            :title="
              isMaximized ? t('grouping.restore') : t('grouping.maximize')
            "
            @click="toggleMaximize"
          >
            <Icon
              :name="
                isMaximized
                  ? 'heroicons:arrows-pointing-in'
                  : 'heroicons:arrows-pointing-out'
              "
              class="w-3.5 h-3.5"
            />
            {{ isMaximized ? t('grouping.restore') : t('grouping.maximize') }}
          </button>
        </div>
      </div>

      <!-- Canvas viewport -->
      <div
        ref="canvasRef"
        class="cluster-canvas-bg relative flex-1 overflow-auto"
        :style="
          isMaximized ? 'min-height: 0' : 'min-height: 500px; max-height: 75vh'
        "
      >
        <div
          class="relative"
          :style="{
            width: boardSize.w + 'px',
            height: boardSize.h + 'px',
            minWidth: '100%',
            minHeight: '100%',
          }"
        >
          <!-- Column section headers -->
          <div
            v-for="header in sectionHeaders"
            :key="header.type"
            class="absolute top-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary-400 dark:text-secondary-500 select-none pointer-events-none"
            :style="{ left: header.x + 'px' }"
          >
            <span>{{ header.emoji }}</span>
            <span>{{ header.label }}</span>
          </div>

          <!-- SVG connector lines -->
          <svg
            class="absolute inset-0 pointer-events-none"
            :width="boardSize.w"
            :height="boardSize.h"
            style="overflow: visible"
          >
            <template v-for="group in groups" :key="'svg-' + group.id">
              <line
                v-for="cardId in group.cardIds"
                :key="'line-' + cardId"
                :x1="groupCenter(group)?.x ?? 0"
                :y1="groupCenter(group)?.y ?? 0"
                :x2="(positions[cardId]?.x ?? 0) + CARD_W / 2"
                :y2="(positions[cardId]?.y ?? 0) + CARD_H / 2"
                stroke-width="1.5"
                stroke-dasharray="6 4"
                class="stroke-secondary-300/50 dark:stroke-secondary-600/50"
              />
            </template>
          </svg>

          <!-- Group cluster backgrounds -->
          <div
            v-for="group in groups"
            :key="'gb-' + group.id"
            class="canvas-element absolute rounded-3xl border select-none"
            :class="[
              draggingGroup?.groupId === group.id
                ? 'canvas-element--dragging border-primary-300 bg-primary-50/60 dark:bg-primary-900/30 shadow-lg'
                : isGroupDropTarget(group.id)
                  ? 'border-primary-300 bg-primary-50/50 dark:bg-primary-900/20 shadow-md'
                  : 'border-secondary-200 dark:border-secondary-700 bg-white/50 dark:bg-secondary-800/50 shadow-sm',
            ]"
            :style="groupStyle(group)"
          />

          <!-- Cards -->
          <div
            v-for="card in cards"
            :key="card.id"
            class="canvas-card absolute p-3 rounded-lg border select-none"
            :class="[
              columnMeta[card.column].cardClass,
              dragging?.cardId === card.id
                ? 'canvas-card--dragging shadow-xl ring-2 ring-primary-400 scale-[1.03] cursor-grabbing'
                : draggingGroup && card.groupId === draggingGroup.groupId
                  ? 'canvas-card--dragging shadow-sm'
                  : isCardDropTarget(card.id)
                    ? 'shadow-md ring-2 ring-primary-400 scale-105'
                    : 'shadow-sm cursor-grab hover:shadow-md active:cursor-grabbing',
            ]"
            :style="cardStyle(card)"
            @pointerdown="handlePointerDown(card, $event)"
          >
            <p
              class="text-sm text-secondary-800 dark:text-secondary-200 line-clamp-3 break-words whitespace-pre-wrap"
              v-text="card.content"
            />
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-secondary-200/50">
              <span class="text-[10px] text-secondary-400">
                {{ columnMeta[card.column].emoji }}
              </span>
              <span
                v-if="card.votes > 0"
                class="flex items-center gap-1 text-xs text-secondary-500"
              >
                <Icon name="heroicons:hand-thumb-up-solid" class="w-3.5 h-3.5" />
                {{ card.votes }}
              </span>
            </div>
          </div>

          <!-- Group center labels (cluster cores) -->
          <div
            v-for="group in groups"
            :key="'gl-' + group.id"
            class="absolute select-none"
            :style="groupLabelStyle(group)"
          >
            <div
              class="flex items-center gap-2 bg-white dark:bg-secondary-800 rounded-xl shadow-md border border-secondary-200 dark:border-secondary-700 px-3 py-2 cursor-grab active:cursor-grabbing whitespace-nowrap"
              @pointerdown="handleGroupPointerDown(group, $event)"
            >
              <Icon name="heroicons:squares-2x2" class="w-4 h-4 text-primary-500 flex-shrink-0" />
              <input
                :value="group.title"
                class="text-sm font-semibold bg-transparent border-none outline-none text-secondary-700 dark:text-secondary-300 placeholder-secondary-400 min-w-0 w-24"
                :placeholder="t('grouping.clickToRename')"
                @pointerdown.stop
                @blur="handleRenameGroup(group.id, $event)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
              <span class="text-xs tabular-nums text-secondary-400 font-medium">
                {{ group.cardIds.length }}
              </span>
              <button
                class="p-0.5 rounded text-secondary-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/30 transition-colors"
                :title="t('grouping.deleteGroup')"
                @pointerdown.stop
                @click="handleDeleteGroup(group.id)"
              >
                <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Non-scoped: canvas background grid (needs parent dark class access) */
.cluster-canvas-bg {
  background-color: #f8fafc;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 24px 24px;
}

.dark .cluster-canvas-bg {
  background-color: #0f172a;
  background-image:
    linear-gradient(rgba(71, 85, 105, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(71, 85, 105, 0.15) 1px, transparent 1px);
  background-size: 24px 24px;
}
</style>

<style scoped>
/* Smooth repositioning animation for cards and groups */
.canvas-card,
.canvas-element {
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s ease,
    opacity 0.15s ease;
}

/* Disable transform transition during active drag */
.canvas-card--dragging,
.canvas-element--dragging {
  transition:
    box-shadow 0.2s ease,
    opacity 0.15s ease !important;
}
</style>

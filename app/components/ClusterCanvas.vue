<script setup lang="ts">
/**
 * ClusterCanvas Component
 *
 * Column-based card clustering for the generate-insights phase.
 * Cards are organized in three columns with groups rendered as
 * bordered containers. Pointer-based drag & drop for grouping.
 */

import { CARD_W } from '~/composables/useClusterCanvas';
import type { IRetroCard, IRetroSession, RetroColumnType } from '~/types';
import { RETRO_COLUMNS } from '~/types';

const { t } = useI18n();

const props = defineProps<{
  session: IRetroSession;
  currentUserId: string;
}>();

const emit = defineEmits<{
  createGroup: [title: string, column: RetroColumnType, cardIds: string[]];
  addCardToGroup: [groupId: string, cardId: string];
  removeCardFromGroup: [groupId: string, cardId: string];
  renameGroup: [groupId: string, title: string];
  moveGroup: [groupId: string, column: RetroColumnType];
  deleteGroup: [groupId: string];
}>();

// ---- Canvas Composable ----
const {
  dragging,
  ghostPos,
  startDrag,
  moveDrag,
  endDrag,
  isCardDropTarget,
  isGroupDropTarget,
} = useClusterCanvas();

// ---- Maximize State ----
const isMaximized = ref(false);

function toggleMaximize() {
  isMaximized.value = !isMaximized.value;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isMaximized.value) {
    isMaximized.value = false;
  }
}
onMounted(() => document.addEventListener('keydown', handleKeydown));
onUnmounted(() => document.removeEventListener('keydown', handleKeydown));

// ---- Computed ----
const cards = computed(() => props.session.cards);
const groups = computed(() => props.session.groups);

const columnMeta: Record<
  RetroColumnType,
  { emoji: string; cardClass: string; groupClass: string }
> = {
  'went-well': {
    emoji: '✅',
    cardClass: 'bg-success-50 border-success-200',
    groupClass: 'border-success-200 bg-success-50/30',
  },
  'to-improve': {
    emoji: '⚠️',
    cardClass: 'bg-warning-50 border-warning-200',
    groupClass: 'border-warning-200 bg-warning-50/30',
  },
  'action-items': {
    emoji: '🎯',
    cardClass: 'bg-primary-50 border-primary-200',
    groupClass: 'border-primary-200 bg-primary-50/30',
  },
};

/** Get ungrouped cards for a column */
function getUngroupedCards(column: RetroColumnType): IRetroCard[] {
  return cards.value.filter((c) => c.column === column && !c.groupId);
}

/** Get groups for a column */
function getColumnGroups(column: RetroColumnType) {
  return groups.value.filter((g) => g.column === column);
}

/** Find a card by ID */
function getCard(cardId: string): IRetroCard | undefined {
  return cards.value.find((c) => c.id === cardId);
}

/** The card currently being dragged (for ghost rendering) */
const draggedCard = computed(() => {
  if (!dragging.value) return null;
  return cards.value.find((c) => c.id === dragging.value!.cardId) ?? null;
});

// ---- Pointer Event Handlers ----
function handlePointerDown(card: IRetroCard, ev: PointerEvent) {
  ev.preventDefault();
  startDrag(card.id, ev, card.groupId);

  const onMove = (e: PointerEvent) => {
    e.preventDefault();
    moveDrag(e);
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

      if (result.originGroupId) {
        emit('removeCardFromGroup', result.originGroupId, result.cardId);
      }

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
</script>

<template>
  <Teleport to="body" :disabled="!isMaximized">
    <div
      class="flex flex-col overflow-hidden bg-white transition-all duration-300"
      :class="[
        isMaximized
          ? 'fixed inset-0 z-[100] rounded-none'
          : 'rounded-xl shadow-sm border border-secondary-200',
      ]"
    >
      <!-- Toolbar -->
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-white border-b border-secondary-200"
      >
        <div class="flex items-center gap-2 text-sm text-secondary-600">
          <Icon
            name="heroicons:information-circle"
            class="w-4 h-4 flex-shrink-0"
          />
          <span>{{ t('grouping.instructionsHost') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors"
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

      <!-- Column Layout -->
      <div
        class="flex-1 overflow-auto p-4"
        :style="isMaximized ? 'min-height: 0' : 'min-height: 400px; max-height: 75vh'"
      >
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          <!-- Column -->
          <div
            v-for="col in RETRO_COLUMNS"
            :key="col"
            class="flex flex-col gap-3"
          >
            <!-- Column Header -->
            <div class="flex items-center gap-2 px-1 pb-2 border-b border-secondary-200">
              <span class="text-base">{{ columnMeta[col].emoji }}</span>
              <span class="text-sm font-semibold text-secondary-700 uppercase tracking-wider">
                {{ t(`column.${col}`) }}
              </span>
              <span class="ml-auto text-xs text-secondary-400 tabular-nums">
                {{
                  getUngroupedCards(col).length +
                  getColumnGroups(col).reduce((n, g) => n + g.cardIds.length, 0)
                }}
              </span>
            </div>

            <!-- Groups -->
            <div
              v-for="group in getColumnGroups(col)"
              :key="group.id"
              class="rounded-xl border-2 p-3 transition-all duration-200"
              :class="[
                isGroupDropTarget(group.id)
                  ? 'border-primary-400 bg-primary-50/50 shadow-md scale-[1.01]'
                  : columnMeta[col].groupClass,
              ]"
              :data-drop-group-id="group.id"
            >
              <!-- Group Header -->
              <div class="flex items-center gap-2 mb-2 pb-2 border-b border-secondary-200/60">
                <Icon
                  name="heroicons:squares-2x2"
                  class="w-4 h-4 text-primary-500 flex-shrink-0"
                />
                <input
                  :value="group.title"
                  class="text-sm font-semibold bg-transparent border-none outline-none text-secondary-700 placeholder-secondary-400 min-w-0 flex-1"
                  :placeholder="t('grouping.clickToRename')"
                  @blur="handleRenameGroup(group.id, $event)"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                >
                <span class="text-xs tabular-nums text-secondary-400 font-medium">
                  {{ group.cardIds.length }}
                </span>
                <!-- Move group buttons -->
                <div class="flex items-center gap-0.5">
                  <button
                    v-for="targetCol in RETRO_COLUMNS.filter((c) => c !== col)"
                    :key="targetCol"
                    class="p-0.5 rounded text-secondary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    :title="t('grouping.moveToColumn', { column: t(`column.${targetCol}`) })"
                    @click="emit('moveGroup', group.id, targetCol)"
                  >
                    <span class="text-xs leading-none">{{ columnMeta[targetCol].emoji }}</span>
                  </button>
                </div>
                <button
                  class="p-0.5 rounded text-secondary-400 hover:text-error-500 hover:bg-error-50 transition-colors"
                  :title="t('grouping.deleteGroup')"
                  @click="handleDeleteGroup(group.id)"
                >
                  <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Grouped Cards -->
              <div class="space-y-2">
                <div
                  v-for="cardId in group.cardIds"
                  :key="cardId"
                  class="p-2.5 rounded-lg border select-none transition-all duration-200"
                  :class="[
                    columnMeta[getCard(cardId)?.column ?? col].cardClass,
                    dragging?.cardId === cardId
                      ? 'opacity-40 scale-95'
                      : 'cursor-grab hover:shadow-md active:cursor-grabbing',
                  ]"
                  :data-drop-card-id="cardId"
                  :data-card-group-id="group.id"
                  @pointerdown="getCard(cardId) && handlePointerDown(getCard(cardId)!, $event)"
                >
                  <p
                    class="text-sm text-secondary-800 line-clamp-3 break-words whitespace-pre-wrap"
                    v-text="getCard(cardId)?.content"
                  />
                </div>
              </div>
            </div>

            <!-- Ungrouped Cards -->
            <div
              v-for="card in getUngroupedCards(col)"
              :key="card.id"
              class="p-3 rounded-lg border select-none transition-all duration-200"
              :class="[
                columnMeta[col].cardClass,
                dragging?.cardId === card.id
                  ? 'opacity-40 scale-95'
                  : isCardDropTarget(card.id)
                    ? 'ring-2 ring-primary-400 shadow-md scale-[1.02]'
                    : 'cursor-grab hover:shadow-md active:cursor-grabbing',
              ]"
              :data-drop-card-id="card.id"
              @pointerdown="handlePointerDown(card, $event)"
            >
              <p
                class="text-sm text-secondary-800 line-clamp-3 break-words whitespace-pre-wrap"
                v-text="card.content"
              />
              <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-secondary-200/50">
                <span class="text-[10px] text-secondary-400">
                  {{ columnMeta[col].emoji }}
                </span>
                <span
                  v-if="card.votes > 0"
                  class="flex items-center gap-1 text-xs text-secondary-500"
                >
                  <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3" />
                  {{ card.votes }}
                </span>
              </div>
            </div>

            <!-- Empty column hint -->
            <div
              v-if="getUngroupedCards(col).length === 0 && getColumnGroups(col).length === 0"
              class="flex items-center justify-center py-8 text-sm text-secondary-400 italic"
            >
              {{ t('grouping.emptyColumn') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Floating drag ghost -->
  <Teleport to="body">
    <div
      v-if="dragging && draggedCard"
      class="fixed pointer-events-none z-[200] opacity-90"
      :style="{
        left: ghostPos.x + 'px',
        top: ghostPos.y + 'px',
        width: CARD_W + 'px',
      }"
    >
      <div
        class="p-3 rounded-lg border shadow-xl rotate-2"
        :class="columnMeta[draggedCard.column].cardClass"
      >
        <p
          class="text-sm text-secondary-800 line-clamp-3 break-words whitespace-pre-wrap"
          v-text="draggedCard.content"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Smooth transitions for cards and groups */
.cluster-card-enter-active,
.cluster-card-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.cluster-card-enter-from,
.cluster-card-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

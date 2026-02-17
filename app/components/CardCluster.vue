<script setup lang="ts">
/**
 * CardCluster Component
 *
 * Visualizes a group of related retro cards as a cluster.
 * Cards can be dragged out of the cluster, and new cards
 * can be dropped into it. The title is editable by the host.
 */

import type { ICardGroup, IRetroCard, RetroColumnType } from '~/types';

const { t } = useI18n();

interface Props {
  /** The group data */
  group: ICardGroup;
  /** Cards belonging to this group */
  cards: IRetroCard[];
  /** Column type for styling */
  column: RetroColumnType;
  /** Is the current user the host? */
  isHost: boolean;
  /** Is this cluster a drop target right now? */
  isDropTarget: boolean;
  /** ID of the card currently being dragged (to dim it) */
  draggedCardId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  renameGroup: [groupId: string, title: string];
  deleteGroup: [groupId: string];
  removeCard: [groupId: string, cardId: string];
  dragStart: [event: DragEvent, cardId: string, groupId: string];
  dragOver: [event: DragEvent];
  dragLeave: [event: DragEvent];
  drop: [event: DragEvent];
}>();

/** Editing the group title */
const isEditingTitle = ref(false);
const editTitle = ref('');

function startEditTitle(): void {
  if (!props.isHost) return;
  editTitle.value = props.group.title;
  isEditingTitle.value = true;
  nextTick(() => {
    const input = document.querySelector(
      `[data-group-title="${props.group.id}"]`
    ) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
}

function saveTitle(): void {
  const trimmed = editTitle.value.trim();
  if (trimmed && trimmed !== props.group.title) {
    emit('renameGroup', props.group.id, trimmed);
  }
  isEditingTitle.value = false;
}

function cancelEditTitle(): void {
  isEditingTitle.value = false;
}

/**
 * Column-specific cluster styles
 */
const clusterStyle = computed(() => {
  const styles: Record<RetroColumnType, string> = {
    'went-well': 'border-success-300 bg-success-50/80',
    'to-improve': 'border-warning-300 bg-warning-50/80',
    'action-items': 'border-primary-300 bg-primary-50/80',
  };
  return styles[props.column];
});

const clusterHeaderStyle = computed(() => {
  const styles: Record<RetroColumnType, string> = {
    'went-well': 'text-success-700',
    'to-improve': 'text-warning-700',
    'action-items': 'text-primary-700',
  };
  return styles[props.column];
});
</script>

<template>
  <div
    class="card-cluster rounded-xl border-2 border-dashed p-3 transition-all duration-200"
    :class="[
      clusterStyle,
      isDropTarget
        ? 'ring-2 ring-accent-400 border-accent-400 scale-[1.02] shadow-lg'
        : 'hover:shadow-md',
    ]"
    @dragover="emit('dragOver', $event)"
    @dragleave="emit('dragLeave', $event)"
    @drop="emit('drop', $event)"
  >
    <!-- Cluster Header -->
    <div class="flex items-center gap-2 mb-2">
      <Icon
        name="heroicons:squares-2x2"
        class="w-4 h-4"
        :class="clusterHeaderStyle"
      />

      <!-- Title Display / Edit -->
      <template v-if="isEditingTitle">
        <input
          v-model="editTitle"
          :data-group-title="group.id"
          type="text"
          class="flex-1 px-2 py-0.5 text-sm font-semibold border border-secondary-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          @keydown.enter="saveTitle"
          @keydown.escape="cancelEditTitle"
          @blur="saveTitle"
        />
      </template>
      <template v-else>
        <span
          class="flex-1 text-sm font-semibold truncate"
          :class="[
            clusterHeaderStyle,
            isHost ? 'cursor-pointer hover:underline' : '',
          ]"
          :title="isHost ? t('grouping.clickToRename') : group.title"
          @click="startEditTitle"
        >
          {{ group.title }}
        </span>
      </template>

      <!-- Card Count Badge -->
      <span
        class="text-xs px-1.5 py-0.5 rounded-full bg-white/80 text-secondary-600 font-medium"
      >
        {{ cards.length }}
      </span>

      <!-- Delete Group Button (host only) -->
      <button
        v-if="isHost"
        type="button"
        class="p-1 text-secondary-400 hover:text-error-600 transition-colors"
        :title="t('grouping.deleteGroup')"
        @click="emit('deleteGroup', group.id)"
      >
        <Icon name="heroicons:x-mark" class="w-4 h-4" />
      </button>
    </div>

    <!-- Grouped Cards -->
    <div class="flex flex-wrap gap-2">
      <div
        v-for="card in cards"
        :key="card.id"
        class="cluster-card group relative flex-1 min-w-[140px] max-w-full p-2.5 rounded-lg border text-sm transition-all duration-200"
        :class="[
          card.column === 'went-well'
            ? 'bg-success-100/80 border-success-200'
            : card.column === 'to-improve'
              ? 'bg-warning-100/80 border-warning-200'
              : 'bg-primary-100/80 border-primary-200',
          draggedCardId === card.id ? 'opacity-30 scale-95' : 'hover:shadow-sm',
          isHost ? 'cursor-grab active:cursor-grabbing' : '',
        ]"
        :draggable="isHost"
        @dragstart="emit('dragStart', $event, card.id, group.id)"
      >
        <p
          class="text-secondary-800 whitespace-pre-wrap break-words text-xs leading-relaxed"
        >
          {{ card.content }}
        </p>

        <!-- Remove from group button (host only, visible on hover) -->
        <button
          v-if="isHost"
          type="button"
          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-secondary-300 text-secondary-400 hover:text-error-600 hover:border-error-300 shadow-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
          :title="t('grouping.removeFromGroup')"
          @click.stop="emit('removeCard', group.id, card.id)"
        >
          <Icon name="heroicons:minus" class="w-3 h-3" />
        </button>

        <!-- Vote badge -->
        <div
          v-if="card.votes > 0"
          class="mt-1 flex items-center gap-0.5 text-xs text-secondary-500"
        >
          <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3" />
          <span>{{ card.votes }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

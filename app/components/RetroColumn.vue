<script setup lang="ts">
/**
 * RetroColumn Component
 *
 * Displays a column of the retro board (went well, to improve, action items).
 */

import type { IRetroCard, RetroColumnType, RetroPhase } from '~/types';

const { t } = useI18n();

interface Props {
  /** Column type */
  column: RetroColumnType;
  /** Cards in this column */
  cards: IRetroCard[];
  /** Current retro phase */
  phase: RetroPhase;
  /** Current participant ID */
  currentUserId: string;
  /** Is the current user the host? */
  isHost: boolean;
  /** Remaining votes for the user */
  remainingVotes: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  addCard: [column: RetroColumnType, content: string];
  editCard: [cardId: string, content: string];
  deleteCard: [cardId: string];
  voteCard: [cardId: string];
  unvoteCard: [cardId: string];
}>();

const newCardContent = ref('');

/**
 * Column configuration
 */
const columnConfig: Record<
  RetroColumnType,
  {
    icon: string;
    headerClass: string;
    emptyIcon: string;
  }
> = {
  'went-well': {
    icon: 'heroicons:face-smile',
    headerClass: 'text-success-700 bg-success-50 border-success-200',
    emptyIcon: 'heroicons:sparkles',
  },
  'to-improve': {
    icon: 'heroicons:exclamation-triangle',
    headerClass: 'text-warning-700 bg-warning-50 border-warning-200',
    emptyIcon: 'heroicons:light-bulb',
  },
  'action-items': {
    icon: 'heroicons:rocket-launch',
    headerClass: 'text-primary-700 bg-primary-50 border-primary-200',
    emptyIcon: 'heroicons:clipboard-document-check',
  },
};

const config = computed(() => columnConfig[props.column]);

/**
 * Sort cards: by votes in decide-action / generate-insights phase, by creation time otherwise
 */
const sortedCards = computed(() => {
  const cards = [...props.cards];
  if (props.phase === 'decide-action' || props.phase === 'generate-insights') {
    return cards.sort((a, b) => b.votes - a.votes);
  }
  return cards.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
});

/**
 * Adds a new card
 */
function addCard(): void {
  if (!newCardContent.value.trim()) return;
  emit('addCard', props.column, newCardContent.value.trim());
  newCardContent.value = '';
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Column Header -->
    <div
      class="flex items-center gap-2 px-4 py-3 rounded-t-xl border font-semibold"
      :class="config.headerClass"
    >
      <Icon :name="config.icon" class="w-5 h-5" />
      <span>{{ t(`column.${column}`) }}</span>
      <span class="ml-auto text-sm font-normal opacity-75">
        {{ cards.length }}
      </span>
    </div>

    <!-- Cards List -->
    <div
      class="flex-1 p-3 space-y-2 bg-white/50 border-x border-secondary-200 overflow-y-auto max-h-[60vh] scrollbar-thin"
    >
      <TransitionGroup name="list">
        <RetroCard
          v-for="card in sortedCards"
          :key="card.id"
          :card="card"
          :phase="phase"
          :is-author="card.authorId === currentUserId"
          :is-host="isHost"
          :has-voted="card.voterIds.includes(currentUserId)"
          :can-vote="remainingVotes > 0"
          @vote="(cardId: string) => emit('voteCard', cardId)"
          @unvote="(cardId: string) => emit('unvoteCard', cardId)"
          @edit="
            (cardId: string, content: string) =>
              emit('editCard', cardId, content)
          "
          @delete="(cardId: string) => emit('deleteCard', cardId)"
        />
      </TransitionGroup>

      <!-- Empty State -->
      <div
        v-if="cards.length === 0"
        class="text-center py-8 text-secondary-400"
      >
        <Icon
          :name="config.emptyIcon"
          class="w-10 h-10 mx-auto mb-2 opacity-50"
        />
        <p class="text-sm">{{ t('column.empty') }}</p>
      </div>
    </div>

    <!-- Add Card Input (gather-data phase only) -->
    <div
      v-if="phase === 'gather-data'"
      class="p-3 border border-t-0 border-secondary-200 rounded-b-xl bg-white"
    >
      <div class="flex gap-2">
        <textarea
          v-model="newCardContent"
          class="input text-sm resize-none"
          :placeholder="t('card.placeholder')"
          rows="2"
          @keydown.enter.ctrl="addCard"
        />
        <button
          type="button"
          class="btn btn-sm btn-primary self-end"
          :disabled="!newCardContent.trim()"
          @click="addCard"
        >
          <Icon name="heroicons:plus" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Bottom border when not in gather-data phase -->
    <div
      v-else
      class="border border-t-0 border-secondary-200 rounded-b-xl h-2 bg-white"
    />
  </div>
</template>

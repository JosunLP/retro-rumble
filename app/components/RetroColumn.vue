<script setup lang="ts">
/**
 * RetroColumn Component
 *
 * Displays a column of the retro board (went well, to improve, action items).
 */

import type { IRetroCard, RetroColumnType, RetroPhase } from '~/types';
import { MAX_CARD_CONTENT_LENGTH } from '~/types';
import { COLUMN_META } from '~/utils/columnConfig';

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
 * Column configuration from shared metadata
 */
const columnConfig = COLUMN_META;

const config = computed(() => columnConfig[props.column]);

/**
 * Sort cards: by votes in voting / decide-action phase, by creation time otherwise
 */
const sortedCards = computed(() => {
  const cards = [...props.cards];
  if (props.phase === 'decide-action' || props.phase === 'voting') {
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

/** Remaining characters for new card input */
const newCardCharsRemaining = computed(
  () => MAX_CARD_CONTENT_LENGTH - newCardContent.value.length
);
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Column Header -->
    <div
      class="flex items-center gap-2 px-4 py-3 rounded-t-xl border font-semibold"
      :class="[config.headerTextClass, config.headerBgClass, config.headerBorderClass]"
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
        <div class="flex-1 relative">
          <textarea
            v-model="newCardContent"
            class="input text-sm resize-none w-full"
            :placeholder="t('card.placeholder')"
            :maxlength="MAX_CARD_CONTENT_LENGTH"
            :aria-label="t(`column.${column}`) + ' — ' + t('card.placeholder')"
            :aria-describedby="`char-counter-${column}`"
            rows="2"
            @keydown.enter.ctrl="addCard"
          />
          <span
            :id="`char-counter-${column}`"
            class="absolute bottom-1 right-2 text-xs tabular-nums leading-none"
            :class="newCardCharsRemaining <= 50 ? 'text-warning-500' : 'text-secondary-300'"
            role="status"
            aria-live="polite"
          >
            {{ newCardCharsRemaining }}
          </span>
        </div>
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

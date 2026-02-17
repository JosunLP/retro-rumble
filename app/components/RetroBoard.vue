<script setup lang="ts">
/**
 * RetroBoard Component
 *
 * Main board displaying all three retro columns.
 */

import type { IRetroCard, IRetroSession, RetroColumnType } from '~/types';
import { RETRO_COLUMNS } from '~/types';

interface Props {
  /** The retro session */
  session: IRetroSession;
  /** Current participant ID */
  currentUserId: string;
  /** Is the current user the host? */
  isHost: boolean;
  /** Remaining votes */
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

/**
 * Gets cards for a specific column
 */
function getColumnCards(column: RetroColumnType): IRetroCard[] {
  return props.session.cards.filter((c) => c.column === column);
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <RetroColumn
      v-for="column in RETRO_COLUMNS"
      :key="column"
      :column="column"
      :cards="getColumnCards(column)"
      :phase="session.phase"
      :current-user-id="currentUserId"
      :is-host="isHost"
      :remaining-votes="remainingVotes"
      @add-card="
        (columnType: string, content: string) =>
          emit('addCard', columnType, content)
      "
      @edit-card="
        (cardId: string, content: string) => emit('editCard', cardId, content)
      "
      @delete-card="(cardId: string) => emit('deleteCard', cardId)"
      @vote-card="(cardId: string) => emit('voteCard', cardId)"
      @unvote-card="(cardId: string) => emit('unvoteCard', cardId)"
    />
  </div>
</template>

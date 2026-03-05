<script setup lang="ts">
/**
 * RetroCard Component
 *
 * Displays a single retro card with voting and edit capabilities.
 * Cards are anonymous — no author information is shown.
 */

import DOMPurify from 'dompurify';
import type { IRetroCard, RetroColumnType, RetroPhase } from '~/types';
import { MAX_CARD_CONTENT_LENGTH } from '~/types';

const { t } = useI18n();

/**
 * Sanitizes user-generated content to prevent XSS attacks.
 * Returns plain text only — all HTML tags are stripped.
 */
function sanitize(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

interface Props {
  /** The retro card data */
  card: IRetroCard;
  /** Current retro phase */
  phase: RetroPhase;
  /** Is the current user the author? */
  isAuthor: boolean;
  /** Is the current user the host? */
  isHost: boolean;
  /** Has the current user voted for this card? */
  hasVoted: boolean;
  /** Can the user still vote? (remaining votes > 0) */
  canVote: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  vote: [cardId: string];
  unvote: [cardId: string];
  edit: [cardId: string, content: string];
  delete: [cardId: string];
}>();

const isEditing = ref(false);
const editContent = ref('');

function startEdit(): void {
  editContent.value = props.card.content;
  isEditing.value = true;
}

function saveEdit(): void {
  if (editContent.value.trim()) {
    emit('edit', props.card.id, editContent.value.trim());
  }
  isEditing.value = false;
}

function cancelEdit(): void {
  isEditing.value = false;
}

/** Remaining characters in edit mode */
const editCharsRemaining = computed(
  () => MAX_CARD_CONTENT_LENGTH - editContent.value.length
);

/**
 * Column-specific card styles
 */
const cardClass = computed(() => {
  const classes: Record<RetroColumnType, string> = {
    'went-well': 'retro-card-well',
    'to-improve': 'retro-card-improve',
    'action-items': 'retro-card-action',
  };
  return classes[props.card.column];
});
</script>

<template>
  <div :class="cardClass">
    <!-- Edit Mode -->
    <div v-if="isEditing" class="space-y-2">
      <div class="relative">
        <textarea
          v-model="editContent"
          class="input text-sm resize-none w-full"
          rows="3"
          :maxlength="MAX_CARD_CONTENT_LENGTH"
          :aria-label="t('card.edit')"
          @keydown.enter.ctrl="saveEdit"
          @keydown.escape="cancelEdit"
        />
        <span
          class="absolute bottom-1 right-2 text-xs tabular-nums leading-none"
          :class="editCharsRemaining <= 50 ? 'text-warning-500' : 'text-secondary-300'"
        >
          {{ editCharsRemaining }}
        </span>
      </div>
      <div class="flex gap-2 justify-end">
        <button
          type="button"
          class="btn btn-sm btn-secondary"
          @click="cancelEdit"
        >
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-sm btn-primary" @click="saveEdit">
          {{ t('common.save') }}
        </button>
      </div>
    </div>

    <!-- Display Mode -->
    <div v-else>
      <p class="text-sm text-secondary-800 whitespace-pre-wrap break-words">
        {{ sanitize(card.content) }}
      </p>

      <div
        class="flex items-center justify-between mt-2 pt-2 border-t border-secondary-200/50"
      >
        <!-- Vote Button (voting phase only) -->
        <div v-if="phase === 'voting'" class="flex items-center gap-1">
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors"
            :class="
              hasVoted
                ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                : canVote
                  ? 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
                  : 'bg-secondary-50 text-secondary-400 cursor-not-allowed'
            "
            :disabled="!hasVoted && !canVote"
            :aria-label="hasVoted ? t('voting.unvoteCard') : t('voting.voteCard')"
            @click="hasVoted ? emit('unvote', card.id) : emit('vote', card.id)"
          >
            <Icon
              :name="
                hasVoted
                  ? 'heroicons:hand-thumb-up-solid'
                  : 'heroicons:hand-thumb-up'
              "
              class="w-3.5 h-3.5"
            />
            <span>{{ card.votes }}</span>
          </button>
        </div>

        <!-- Vote Count (non-voting phases with votes) -->
        <div
          v-else-if="card.votes > 0"
          class="flex items-center gap-1 text-xs text-secondary-500"
        >
          <Icon name="heroicons:hand-thumb-up-solid" class="w-3.5 h-3.5" />
          <span>{{ card.votes }}</span>
        </div>
        <div v-else />

        <!-- Card Actions -->
        <div class="flex items-center gap-1">
          <button
            v-if="(isAuthor || isHost) && phase === 'gather-data'"
            type="button"
            class="p-1 text-secondary-400 hover:text-primary-600 transition-colors"
            :aria-label="t('card.edit')"
            :title="t('card.edit')"
            @click="startEdit"
          >
            <Icon name="heroicons:pencil" class="w-3.5 h-3.5" />
          </button>
          <button
            v-if="(isAuthor || isHost) && phase === 'gather-data'"
            type="button"
            class="p-1 text-secondary-400 hover:text-error-600 transition-colors"
            :aria-label="t('card.delete')"
            :title="t('card.delete')"
            @click="emit('delete', card.id)"
          >
            <Icon name="heroicons:trash" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

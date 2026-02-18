<script setup lang="ts">
/**
 * VotingBoard Component
 *
 * Dedicated voting phase UI. Displays all cards and groups
 * organized by column, allowing participants to vote on both
 * individual cards and groups.
 */

import type { ICardGroup, IRetroCard, IRetroSession, RetroColumnType } from '~/types';
import { RETRO_COLUMNS } from '~/types';

const { t } = useI18n();

const props = defineProps<{
  session: IRetroSession;
  remainingVotes: number;
  currentUserId: string;
}>();

const emit = defineEmits<{
  voteCard: [cardId: string];
  unvoteCard: [cardId: string];
  voteGroup: [groupId: string];
  unvoteGroup: [groupId: string];
}>();

// ---- Column Metadata ----
const columnMeta: Record<
  RetroColumnType,
  { emoji: string; label: string; cardClass: string; headerClass: string }
> = {
  'went-well': {
    emoji: '✅',
    label: 'column.went-well',
    cardClass:
      'bg-success-50 border-success-200 dark:bg-success-950/30 dark:border-success-800',
    headerClass: 'text-success-700 dark:text-success-400',
  },
  'to-improve': {
    emoji: '⚠️',
    label: 'column.to-improve',
    cardClass:
      'bg-warning-50 border-warning-200 dark:bg-warning-950/30 dark:border-warning-800',
    headerClass: 'text-warning-700 dark:text-warning-400',
  },
  'action-items': {
    emoji: '🎯',
    label: 'column.action-items',
    cardClass:
      'bg-primary-50 border-primary-200 dark:bg-primary-950/30 dark:border-primary-800',
    headerClass: 'text-primary-700 dark:text-primary-400',
  },
};

// ---- Helpers ----
function getUngroupedCards(column: RetroColumnType): IRetroCard[] {
  return props.session.cards
    .filter((c) => c.column === column && !c.groupId)
    .sort((a, b) => b.votes - a.votes);
}

function getGroupsForColumn(column: RetroColumnType): ICardGroup[] {
  return props.session.groups
    .filter((g) => g.column === column)
    .sort((a, b) => b.votes - a.votes);
}

function getGroupCards(group: ICardGroup): IRetroCard[] {
  return group.cardIds
    .map((id) => props.session.cards.find((c) => c.id === id))
    .filter((c): c is IRetroCard => !!c)
    .sort((a, b) => b.votes - a.votes);
}

function hasVotedCard(card: IRetroCard): boolean {
  return card.voterIds.includes(props.currentUserId);
}

function hasVotedGroup(group: ICardGroup): boolean {
  return group.voterIds.includes(props.currentUserId);
}

function canVote(): boolean {
  return props.remainingVotes > 0;
}

function handleVoteCard(cardId: string) {
  const card = props.session.cards.find((c) => c.id === cardId);
  if (!card) return;
  if (hasVotedCard(card)) {
    emit('unvoteCard', cardId);
  } else {
    emit('voteCard', cardId);
  }
}

function handleVoteGroup(groupId: string) {
  const group = props.session.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (hasVotedGroup(group)) {
    emit('unvoteGroup', groupId);
  } else {
    emit('voteGroup', groupId);
  }
}

function hasContent(column: RetroColumnType): boolean {
  return (
    getUngroupedCards(column).length > 0 ||
    getGroupsForColumn(column).length > 0
  );
}
</script>

<template>
  <div class="space-y-4">
    <!-- Voting Header -->
    <div class="card-container">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon
            name="heroicons:hand-thumb-up"
            class="w-5 h-5 text-primary-600"
          />
          <h3 class="text-lg font-semibold text-secondary-800 dark:text-secondary-200">
            {{ t('voting.title') }}
          </h3>
        </div>
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border"
          :class="
            remainingVotes > 0
              ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800'
              : 'bg-secondary-50 text-secondary-500 border-secondary-200 dark:bg-secondary-800 dark:text-secondary-400 dark:border-secondary-700'
          "
        >
          <Icon name="heroicons:hand-thumb-up" class="w-4 h-4" />
          {{ remainingVotes }} {{ t('voting.remaining') }}
        </div>
      </div>
      <p class="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
        {{ t('voting.instructions') }}
      </p>
    </div>

    <!-- Columns -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="column in RETRO_COLUMNS" :key="column" class="space-y-3">
        <!-- Column Header -->
        <div class="flex items-center gap-2 px-1">
          <span class="text-lg">{{ columnMeta[column].emoji }}</span>
          <h4
            class="text-sm font-semibold uppercase tracking-wider"
            :class="columnMeta[column].headerClass"
          >
            {{ t(columnMeta[column].label) }}
          </h4>
        </div>

        <!-- Groups in Column -->
        <div
          v-for="group in getGroupsForColumn(column)"
          :key="group.id"
          class="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 shadow-sm overflow-hidden"
        >
          <!-- Group Header with Vote -->
          <div
            class="flex items-center justify-between px-4 py-3 bg-secondary-50 dark:bg-secondary-800/80 border-b border-secondary-200 dark:border-secondary-700"
          >
            <div class="flex items-center gap-2">
              <Icon
                name="heroicons:squares-2x2"
                class="w-4 h-4 text-primary-500"
              />
              <span
                class="text-sm font-semibold text-secondary-700 dark:text-secondary-300"
              >
                {{ group.title }}
              </span>
              <span class="text-xs text-secondary-400">
                ({{ group.cardIds.length }}
                {{ t('summary.cards').toLowerCase() }})
              </span>
            </div>
            <button
              class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              :class="
                hasVotedGroup(group)
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300'
                  : canVote()
                    ? 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200 dark:bg-secondary-800 dark:text-secondary-400'
                    : 'bg-secondary-50 text-secondary-400 cursor-not-allowed dark:bg-secondary-900'
              "
              :disabled="!hasVotedGroup(group) && !canVote()"
              @click="handleVoteGroup(group.id)"
            >
              <Icon
                :name="
                  hasVotedGroup(group)
                    ? 'heroicons:hand-thumb-up-solid'
                    : 'heroicons:hand-thumb-up'
                "
                class="w-3.5 h-3.5"
              />
              <span>{{ group.votes }}</span>
            </button>
          </div>

          <!-- Group Cards -->
          <div class="p-3 space-y-2">
            <div
              v-for="card in getGroupCards(group)"
              :key="card.id"
              class="p-3 rounded-lg border"
              :class="columnMeta[card.column].cardClass"
            >
              <p
                class="text-sm text-secondary-800 dark:text-secondary-200 whitespace-pre-wrap break-words"
                v-text="card.content"
              />
              <div
                class="flex items-center justify-between mt-2 pt-2 border-t border-secondary-200/50"
              >
                <span class="text-[10px] text-secondary-400">
                  {{ columnMeta[card.column].emoji }}
                </span>
                <button
                  class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors"
                  :class="
                    hasVotedCard(card)
                      ? 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300'
                      : canVote()
                        ? 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200 dark:bg-secondary-800 dark:text-secondary-400'
                        : 'bg-secondary-50 text-secondary-400 cursor-not-allowed dark:bg-secondary-900'
                  "
                  :disabled="!hasVotedCard(card) && !canVote()"
                  @click="handleVoteCard(card.id)"
                >
                  <Icon
                    :name="
                      hasVotedCard(card)
                        ? 'heroicons:hand-thumb-up-solid'
                        : 'heroicons:hand-thumb-up'
                    "
                    class="w-3.5 h-3.5"
                  />
                  <span>{{ card.votes }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Ungrouped Cards -->
        <div
          v-for="card in getUngroupedCards(column)"
          :key="card.id"
          class="p-3 rounded-lg border"
          :class="columnMeta[column].cardClass"
        >
          <p
            class="text-sm text-secondary-800 dark:text-secondary-200 whitespace-pre-wrap break-words"
            v-text="card.content"
          />
          <div
            class="flex items-center justify-between mt-2 pt-2 border-t border-secondary-200/50"
          >
            <span class="text-[10px] text-secondary-400">
              {{ columnMeta[column].emoji }}
            </span>
            <button
              class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors"
              :class="
                hasVotedCard(card)
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300'
                  : canVote()
                    ? 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200 dark:bg-secondary-800 dark:text-secondary-400'
                    : 'bg-secondary-50 text-secondary-400 cursor-not-allowed dark:bg-secondary-900'
              "
              :disabled="!hasVotedCard(card) && !canVote()"
              @click="handleVoteCard(card.id)"
            >
              <Icon
                :name="
                  hasVotedCard(card)
                    ? 'heroicons:hand-thumb-up-solid'
                    : 'heroicons:hand-thumb-up'
                "
                class="w-3.5 h-3.5"
              />
              <span>{{ card.votes }}</span>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="!hasContent(column)"
          class="text-center py-8 text-sm text-secondary-400"
        >
          {{ t('column.empty') }}
        </div>
      </div>
    </div>
  </div>
</template>

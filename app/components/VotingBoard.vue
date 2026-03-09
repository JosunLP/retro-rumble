<script setup lang="ts">
/**
 * VotingBoard Component
 *
 * Dedicated voting phase UI. Displays all groups organized by column,
 * allows voting only on groups, and shows aggregate + per-user votes.
 */

import type { ICardGroup, IRetroCard, IRetroSession, RetroColumnType } from '~/types';
import { RETRO_COLUMNS } from '~/types';
import { COLUMN_META } from '~/utils/columnConfig';
import { sortCardsForVoting, sortGroupsForVoting } from '~/utils/retroSorting';

const { t } = useI18n();

const props = defineProps<{
  session: IRetroSession;
  remainingVotes: number;
  currentUserId: string;
}>();

const emit = defineEmits<{
  voteGroup: [groupId: string];
  unvoteGroup: [groupId: string];
}>();

// ---- Column Metadata ----
const columnMeta = COLUMN_META;

// ---- Helpers ----
function getUngroupedCards(column: RetroColumnType): IRetroCard[] {
  return sortCardsForVoting(
    props.session.cards.filter((c) => c.column === column && !c.groupId)
  );
}

function getGroupsForColumn(column: RetroColumnType): ICardGroup[] {
  return sortGroupsForVoting(props.session.groups.filter((g) => g.column === column));
}

function getGroupCards(group: ICardGroup): IRetroCard[] {
  return sortCardsForVoting(
    group.cardIds
      .map((id) => props.session.cards.find((c) => c.id === id))
      .filter((c): c is IRetroCard => !!c)
  );
}

function userGroupVotes(group: ICardGroup): number {
  return group.voterIds.filter((id) => id === props.currentUserId).length;
}

function groupVoteBreakdown(group: ICardGroup) {
  const voteCounts = new Map<string, number>();

  for (const voterId of group.voterIds) {
    voteCounts.set(voterId, (voteCounts.get(voterId) ?? 0) + 1);
  }

  return props.session.participants
    .map((participant) => ({
      participantId: participant.id,
      name: participant.name,
      count: voteCounts.get(participant.id) ?? 0,
      isCurrentUser: participant.id === props.currentUserId,
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

/** Whether the user can still cast a vote */
const canVote = computed(() => props.remainingVotes > 0);

function handleVoteGroup(groupId: string) {
  emit('voteGroup', groupId);
}

function handleUnvoteGroup(groupId: string) {
  emit('unvoteGroup', groupId);
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
          <h3 class="text-lg font-semibold text-secondary-800">
            {{ t('voting.title') }}
          </h3>
        </div>
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border"
          :class="
            remainingVotes > 0
              ? 'bg-primary-50 text-primary-700 border-primary-200'
              : 'bg-secondary-50 text-secondary-500 border-secondary-200'
          "
        >
          <Icon name="heroicons:hand-thumb-up" class="w-4 h-4" />
          {{ remainingVotes }} {{ t('voting.remaining') }}
        </div>
      </div>
      <p class="mt-2 text-sm text-secondary-500">
        {{ t('voting.instructions') }}
      </p>
      <p class="mt-1 text-xs text-secondary-400">
        {{ t('voting.groupOnlyHint') }}
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
            :class="columnMeta[column].headerTextClass"
          >
            {{ t(columnMeta[column].labelKey) }}
          </h4>
        </div>

        <!-- Groups in Column -->
        <div
          v-for="group in getGroupsForColumn(column)"
          :key="group.id"
          class="rounded-xl border border-secondary-200 bg-white shadow-sm overflow-hidden"
        >
          <!-- Group Header with Vote -->
          <div
            class="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200"
          >
            <div class="flex items-center gap-2">
              <Icon
                name="heroicons:squares-2x2"
                class="w-4 h-4 text-primary-500"
              />
              <span
                class="text-sm font-semibold text-secondary-700"
              >
                {{ group.title }}
              </span>
              <span class="text-xs text-secondary-400">
                {{ t('voting.groupCardCount', { count: group.cardIds.length }) }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="p-1 rounded-full transition-colors text-secondary-400 hover:text-error-500 hover:bg-error-50"
                :aria-label="t('voting.unvoteGroup')"
                :class="{ 'opacity-0 pointer-events-none': userGroupVotes(group) === 0 }"
                :disabled="userGroupVotes(group) === 0"
                @click="handleUnvoteGroup(group.id)"
              >
                <Icon name="heroicons:minus-circle" class="w-4 h-4" />
              </button>
              <span
                class="min-w-[2rem] text-center text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
                :class="
                  userGroupVotes(group) > 0
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-secondary-100 text-secondary-500'
                "
              >
                <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3 inline -mt-0.5" />
                {{ group.votes }}
              </span>
              <button
                class="p-1 rounded-full transition-colors"
                :aria-label="t('voting.voteGroup')"
                :class="
                  canVote
                    ? 'text-primary-600 hover:text-primary-700 hover:bg-primary-50'
                    : 'text-secondary-300 cursor-not-allowed'
                "
                :disabled="!canVote"
                @click="handleVoteGroup(group.id)"
              >
                <Icon name="heroicons:plus-circle" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Group Cards -->
          <div class="p-3 space-y-2">
            <div
              v-if="groupVoteBreakdown(group).length > 0"
              class="flex flex-wrap gap-1.5 pb-1"
            >
              <span
                v-for="vote in groupVoteBreakdown(group)"
                :key="vote.participantId"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="vote.isCurrentUser ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-600'"
              >
                {{ vote.name }}
                <span class="tabular-nums">×{{ vote.count }}</span>
              </span>
            </div>
            <div
              v-for="card in getGroupCards(group)"
              :key="card.id"
              class="p-3 rounded-lg border"
              :class="columnMeta[card.column].cardClass"
            >
              <p
                class="text-sm text-secondary-800 whitespace-pre-wrap break-words"
                v-text="card.content"
              />
              <div
                class="flex items-center justify-between mt-2 pt-2 border-t border-secondary-200/50"
              >
                <span class="text-[10px] text-secondary-400">
                  {{ columnMeta[card.column].emoji }}
                </span>
                <span
                  v-if="card.votes > 0"
                  class="min-w-[1.75rem] text-center text-xs font-semibold tabular-nums px-1 py-0.5 rounded-full bg-secondary-100 text-secondary-600"
                >
                  <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3 inline -mt-0.5" />
                  {{ card.votes }}
                </span>
                <span v-else class="text-[10px] text-secondary-400">
                  {{ t('voting.notVotable') }}
                </span>
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
            class="text-sm text-secondary-800 whitespace-pre-wrap break-words"
            v-text="card.content"
          />
          <div
            class="flex items-center justify-between mt-2 pt-2 border-t border-secondary-200/50"
          >
            <span class="text-[10px] text-secondary-400">
              {{ columnMeta[column].emoji }}
            </span>
              <span
                class="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-medium text-secondary-600"
              >
                <Icon name="heroicons:lock-closed" class="w-3 h-3" />
                {{ t('voting.notVotable') }}
                <span v-if="card.votes > 0" class="tabular-nums">({{ card.votes }})</span>
              </span>
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

<script setup lang="ts">
/**
 * VotingBoard Component
 *
 * Dedicated voting phase UI. Displays all clustered groups in a
 * responsive wrapped layout, allows voting only on groups, and shows
 * aggregate + per-user votes.
 */

import type { ICardGroup, IRetroSession } from '~/types';
import { COLUMN_META } from '~/utils/columnConfig';
import { getUngroupedCards, resolveCardGroups } from '~/utils/postClusterBoard';
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

function userGroupVotes(group: ICardGroup): number {
  return group.voterIds.filter((id) => id === props.currentUserId).length;
}

const groupVoteBreakdowns = computed(() => {
  const participantMap = new Map(
    props.session.participants.map((p) => [p.id, p.name])
  );

  return new Map(
    props.session.groups.map((group) => {
      const voteCounts = new Map<string, number>();

      for (const voterId of group.voterIds) {
        voteCounts.set(voterId, (voteCounts.get(voterId) ?? 0) + 1);
      }

      const breakdown = Array.from(voteCounts.entries()).map(([voterId, count]) => ({
        participantId: voterId,
        name: participantMap.get(voterId) ?? t('checkin.unknownParticipant'),
        count,
        isCurrentUser: voterId === props.currentUserId,
      }));

      return [
        group.id,
        breakdown.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
      ];
    })
  );
});

function getGroupVoteBreakdown(groupId: string) {
  return groupVoteBreakdowns.value.get(groupId) ?? [];
}

/** Whether the user can still cast a vote */
const canVote = computed(() => props.remainingVotes > 0);
const groups = computed(() => resolveCardGroups(props.session.groups, props.session.cards, {
  sortGroups: sortGroupsForVoting,
  sortCards: sortCardsForVoting,
}));
const ungroupedCards = computed(() => getUngroupedCards(props.session.cards, sortCardsForVoting));
const hasContent = computed(() => groups.value.length > 0 || ungroupedCards.value.length > 0);

function handleVoteGroup(groupId: string) {
  emit('voteGroup', groupId);
}

function handleUnvoteGroup(groupId: string) {
  emit('unvoteGroup', groupId);
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

    <TransitionGroup
      v-if="hasContent"
      name="list"
      tag="div"
      class="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4"
    >
      <div
        v-for="{ group, cards } in groups"
        :key="`group:${group.id}`"
        class="rounded-xl border border-secondary-200 bg-white shadow-sm overflow-hidden"
      >
          <!-- Group Header with Vote -->
          <div
            class="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200"
          >
            <div class="min-w-0 space-y-2">
              <span
                class="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-secondary-600"
              >
                <span>{{ columnMeta[group.column].emoji }}</span>
                {{ t(columnMeta[group.column].labelKey) }}
              </span>
              <div class="flex items-center gap-2 min-w-0">
                <Icon
                  name="heroicons:squares-2x2"
                  class="w-4 h-4 text-primary-500 flex-shrink-0"
                />
                <span class="text-sm font-semibold text-secondary-700 truncate">
                {{ group.title }}
                </span>
                <span class="text-xs text-secondary-400">
                  {{ t('voting.groupCardCount', { count: cards.length }) }}
                </span>
              </div>
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
              v-if="getGroupVoteBreakdown(group.id).length > 0"
              class="flex flex-wrap gap-1.5 pb-1"
            >
              <span
                v-for="vote in getGroupVoteBreakdown(group.id)"
                :key="vote.participantId"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="vote.isCurrentUser ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-600'"
              >
                {{ vote.name }}
                <span class="tabular-nums">×{{ vote.count }}</span>
              </span>
            </div>
            <div
              v-for="card in cards"
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

      <div
        v-for="card in ungroupedCards"
        :key="`card:${card.id}`"
        class="rounded-xl border p-4 shadow-sm"
        :class="columnMeta[card.column].cardClass"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <span
            class="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-secondary-600"
          >
            <span>{{ columnMeta[card.column].emoji }}</span>
            {{ t(columnMeta[card.column].labelKey) }}
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-medium text-secondary-600"
          >
            <Icon name="heroicons:lock-closed" class="w-3 h-3" />
            {{ t('voting.notVotable') }}
            <span v-if="card.votes > 0" class="tabular-nums">({{ card.votes }})</span>
          </span>
        </div>
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
        </div>
      </div>
    </TransitionGroup>

    <div
      v-else
      class="text-center py-8 text-sm text-secondary-400"
    >
      {{ t('column.empty') }}
    </div>
  </div>
</template>

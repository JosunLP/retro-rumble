<script setup lang="ts">
/**
 * RetroSummary Component
 *
 * Displays the full summary of a retro session in the summary phase.
 * Shows results organized by column with groups, vote counts,
 * and an interactive action items section.
 */

import type {
    IActionItem,
    ICardGroup,
    IRetroCard,
    IRetroSession,
    RetroColumnType,
} from '~/types';
import { getTodayISODateUTC, isPastISODate } from '~/types';
import { COLUMN_META, ORDERED_COLUMNS } from '~/utils/columnConfig';
import { sortByCreatedAt, sortByVotesThenCreatedAt } from '~/utils/retroSorting';

const { t } = useI18n();

interface Props {
  session: IRetroSession;
  isHost: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  addActionItem: [text: string, assignee?: string, dueDate?: string];
  editActionItem: [id: string, text: string, assignee?: string, dueDate?: string];
  deleteActionItem: [id: string];
  toggleActionItem: [id: string];
}>();

// New action item form
const newActionText = ref('');
const newActionAssignee = ref('');
const newActionDueDate = ref('');
const editingActionId = ref<string | null>(null);
const editActionText = ref('');
const editActionAssignee = ref('');
const editActionDueDate = ref('');
const actionError = ref<string | null>(null);

const columns = ORDERED_COLUMNS;

const columnConfig = COLUMN_META;
const minDueDate = computed(() => getTodayISODateUTC());

function cardsForColumn(col: RetroColumnType): IRetroCard[] {
  return sortByVotesThenCreatedAt(props.session.cards.filter((c) => c.column === col));
}

function ungroupedCards(col: RetroColumnType): IRetroCard[] {
  return cardsForColumn(col).filter((c) => !c.groupId);
}

function groupsForColumn(col: RetroColumnType): ICardGroup[] {
  return sortByCreatedAt(props.session.groups.filter((g) => g.column === col));
}

function cardsInGroup(group: ICardGroup): IRetroCard[] {
  return sortByVotesThenCreatedAt(
    group.cardIds
      .map((id) => props.session.cards.find((c) => c.id === id))
      .filter((c): c is IRetroCard => !!c)
  );
}

function totalVotesForColumn(col: RetroColumnType): number {
  const cardVotes = cardsForColumn(col).reduce((sum, c) => sum + c.votes, 0);
  const groupVotes = props.session.groups
    .filter((g) => g.column === col)
    .reduce((sum, g) => sum + g.votes, 0);
  return cardVotes + groupVotes;
}

// Statistics
const totalCards = computed(() => props.session.cards.length);
const totalVotes = computed(() =>
  props.session.cards.reduce((sum, c) => sum + c.votes, 0) +
  props.session.groups.reduce((sum, g) => sum + g.votes, 0)
);
const totalGroups = computed(() => props.session.groups.length);
const completedActions = computed(
  () => props.session.actionItems.filter((a) => a.done).length
);

function validateDueDate(dueDate?: string): boolean {
  if (!dueDate) {
    actionError.value = null;
    return true;
  }

  if (isPastISODate(dueDate, getTodayISODateUTC())) {
    actionError.value = t('summary.errors.pastDueDate');
    return false;
  }

  actionError.value = null;
  return true;
}

// Action item CRUD
function handleAddAction(): void {
  const text = newActionText.value.trim();
  if (!text) return;
  const assignee = newActionAssignee.value.trim() || undefined;
  const dueDate = newActionDueDate.value.trim() || undefined;
  if (!validateDueDate(dueDate)) return;
  emit('addActionItem', text, assignee, dueDate);
  newActionText.value = '';
  newActionAssignee.value = '';
  newActionDueDate.value = '';
}

function startEditAction(action: IActionItem): void {
  editingActionId.value = action.id;
  editActionText.value = action.text;
  editActionAssignee.value = action.assignee ?? '';
  editActionDueDate.value = action.dueDate ?? '';
}

function saveEditAction(): void {
  if (!editingActionId.value) return;
  const text = editActionText.value.trim();
  if (!text) return;
  const assignee = editActionAssignee.value.trim() || undefined;
  const dueDate = editActionDueDate.value.trim() || undefined;
  if (!validateDueDate(dueDate)) return;
  emit('editActionItem', editingActionId.value, text, assignee, dueDate);
  editingActionId.value = null;
}

function cancelEditAction(): void {
  editingActionId.value = null;
  actionError.value = null;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Statistics Banner -->
    <div class="card-container bg-gradient-to-r from-primary-50 to-accent-50">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-primary-700">
            {{ totalCards }}
          </div>
          <div class="text-xs text-secondary-500">
            {{ t('summary.totalCards') }}
          </div>
        </div>
        <div>
          <div class="text-2xl font-bold text-primary-700">
            {{ totalVotes }}
          </div>
          <div class="text-xs text-secondary-500">
            {{ t('summary.totalVotes') }}
          </div>
        </div>
        <div>
          <div class="text-2xl font-bold text-primary-700">
            {{ totalGroups }}
          </div>
          <div class="text-xs text-secondary-500">
            {{ t('summary.totalGroups') }}
          </div>
        </div>
        <div>
          <div class="text-2xl font-bold text-primary-700">
            {{ completedActions }}/{{ session.actionItems.length }}
          </div>
          <div class="text-xs text-secondary-500">
            {{ t('summary.actionsDone') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Column Summaries -->
    <div class="grid md:grid-cols-3 gap-4">
      <div
        v-for="col in columns"
        :key="col"
        class="rounded-xl border p-4"
        :class="[columnConfig[col].bgClass, columnConfig[col].borderClass]"
      >
        <!-- Column header -->
        <div class="flex items-center gap-2 mb-3">
          <Icon
            :name="columnConfig[col].icon"
            class="w-5 h-5"
            :class="columnConfig[col].headerTextClass"
          />
          <h3 class="font-bold" :class="columnConfig[col].headerTextClass">
            {{ t(`column.${col}`) }}
          </h3>
          <span class="ml-auto text-xs text-secondary-500">
            {{ cardsForColumn(col).length }} {{ t('summary.cards') }} ·
            {{ totalVotesForColumn(col) }} {{ t('summary.votes') }}
          </span>
        </div>

        <!-- Groups -->
        <div v-for="group in groupsForColumn(col)" :key="group.id" class="mb-3">
          <div
            class="text-xs font-semibold text-secondary-600 mb-1 flex items-center gap-1"
          >
            <Icon name="heroicons:folder" class="w-3.5 h-3.5" />
            {{ group.title }}
            <span
              v-if="group.votes > 0"
              class="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 bg-primary-100 rounded-full px-1.5 py-0.5 ml-auto"
            >
              <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3" />
              {{ group.votes }}
            </span>
          </div>
          <div
            class="space-y-1.5 pl-3 border-l-2"
            :class="columnConfig[col].borderClass"
          >
            <div
              v-for="card in cardsInGroup(group)"
              :key="card.id"
              class="flex items-start gap-2 text-sm text-secondary-700 bg-white/60 rounded-lg px-2.5 py-1.5"
            >
              <span class="flex-1">{{ card.content }}</span>
              <span
                v-if="card.votes > 0"
                class="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 bg-primary-100 rounded-full px-1.5 py-0.5"
              >
                <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3" />
                {{ card.votes }}
              </span>
            </div>
          </div>
        </div>

        <!-- Ungrouped cards -->
        <div class="space-y-1.5">
          <div
            v-for="card in ungroupedCards(col)"
            :key="card.id"
            class="flex items-start gap-2 text-sm text-secondary-700 bg-white/60 rounded-lg px-2.5 py-1.5"
          >
            <span class="flex-1">{{ card.content }}</span>
            <span
              v-if="card.votes > 0"
              class="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 bg-primary-100 rounded-full px-1.5 py-0.5"
            >
              <Icon name="heroicons:hand-thumb-up-solid" class="w-3 h-3" />
              {{ card.votes }}
            </span>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="cardsForColumn(col).length === 0"
          class="text-sm text-secondary-400 italic text-center py-4"
        >
          {{ t('column.empty') }}
        </div>
      </div>
    </div>

    <!-- Action Items Section -->
    <div class="card-container">
      <div class="flex items-center gap-2 mb-4">
        <Icon
          name="heroicons:clipboard-document-check"
          class="w-5 h-5 text-primary-600"
        />
        <h3 class="text-lg font-bold text-secondary-800">
          {{ t('summary.actionItems') }}
        </h3>
      </div>

      <!-- Existing action items -->
      <div
        v-if="actionError"
        class="mb-4 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700"
      >
        {{ actionError }}
      </div>

      <div v-if="session.actionItems.length > 0" class="space-y-2 mb-4">
        <div
          v-for="action in session.actionItems"
          :key="action.id"
          class="flex items-center gap-3 p-3 rounded-lg border transition-all"
          :class="
            action.done
              ? 'bg-success-50 border-success-200'
              : 'bg-white border-secondary-200'
          "
        >
          <!-- Editing mode -->
          <template v-if="editingActionId === action.id">
            <input
              v-model="editActionText"
              type="text"
              class="input flex-1 text-sm"
              :aria-label="t('summary.actionPlaceholder')"
              @keydown.enter="saveEditAction"
              @keydown.escape="cancelEditAction"
            >
            <input
              v-model="editActionAssignee"
              type="text"
              class="input w-28 text-sm"
              :placeholder="t('summary.assigneePlaceholder')"
              :aria-label="t('summary.assigneePlaceholder')"
              @keydown.enter="saveEditAction"
              @keydown.escape="cancelEditAction"
            >
            <input
              v-model="editActionDueDate"
              type="date"
              class="input w-36 text-sm"
              :min="minDueDate"
              @keydown.enter="saveEditAction"
              @keydown.escape="cancelEditAction"
            >
            <button
              type="button"
              class="btn btn-sm btn-primary"
              @click="saveEditAction"
            >
              <Icon name="heroicons:check" class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              @click="cancelEditAction"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4" />
            </button>
          </template>

          <!-- Display mode -->
          <template v-else>
            <button
              v-if="isHost"
              type="button"
              class="flex-shrink-0"
              :aria-label="t('summary.toggleDone')"
              @click="$emit('toggleActionItem', action.id)"
            >
              <Icon
                :name="
                  action.done
                    ? 'heroicons:check-circle-solid'
                    : 'heroicons:stop'
                "
                class="w-5 h-5"
                :class="action.done ? 'text-success-500' : 'text-secondary-300'"
              />
            </button>
            <Icon
              v-else
              :name="
                action.done ? 'heroicons:check-circle-solid' : 'heroicons:stop'
              "
              class="w-5 h-5 flex-shrink-0"
              :class="action.done ? 'text-success-500' : 'text-secondary-300'"
            />

            <span
              class="flex-1 text-sm"
              :class="
                action.done
                  ? 'line-through text-secondary-400'
                  : 'text-secondary-700'
              "
            >
              {{ action.text }}
            </span>

            <span
              v-if="action.assignee"
              class="text-xs text-primary-600 bg-primary-100 rounded-full px-2 py-0.5"
            >
              {{ action.assignee }}
            </span>

            <span v-if="action.dueDate" class="text-xs text-secondary-500">
              {{ action.dueDate }}
            </span>

            <div v-if="isHost" class="flex gap-1">
              <button
                type="button"
                class="text-secondary-400 hover:text-primary-600"
                :aria-label="t('action.edit')"
                @click="startEditAction(action)"
              >
                <Icon name="heroicons:pencil-square" class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="text-secondary-400 hover:text-error-600"
                :aria-label="t('action.delete')"
                @click="$emit('deleteActionItem', action.id)"
              >
                <Icon name="heroicons:trash" class="w-4 h-4" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <div
        v-else
        class="text-sm text-secondary-400 italic text-center py-4 mb-4"
      >
        {{ t('summary.noActions') }}
      </div>

      <!-- Add action item form (host only) -->
      <div v-if="isHost" class="flex flex-wrap gap-2">
        <input
          v-model="newActionText"
          type="text"
          class="input flex-1 min-w-0 text-sm"
          :placeholder="t('summary.actionPlaceholder')"
          @keydown.enter="handleAddAction"
        >
        <input
          v-model="newActionAssignee"
          type="text"
          class="input w-28 text-sm"
          :placeholder="t('summary.assigneePlaceholder')"
          @keydown.enter="handleAddAction"
        >
        <input
          v-model="newActionDueDate"
          type="date"
          class="input w-36 text-sm"
          :min="minDueDate"
          :title="t('summary.dueDate')"
          @keydown.enter="handleAddAction"
        >
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="!newActionText.trim()"
          @click="handleAddAction"
        >
          <Icon name="heroicons:plus" class="w-4 h-4 mr-1" />
          {{ t('summary.addAction') }}
        </button>
      </div>
    </div>
  </div>
</template>

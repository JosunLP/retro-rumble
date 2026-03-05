<script setup lang="ts">
/**
 * CheckInWidget Component
 *
 * Ice-breaker / mood check-in for the "Set the Stage" phase.
 * Participants pick an emoji that describes how they feel.
 * Results are shown in real-time as others respond.
 */

import type { CheckInMood, ICheckInResponse, IParticipant } from '~/types';
import { CHECK_IN_MOODS } from '~/types';

const { t } = useI18n();

interface Props {
  /** All check-in responses so far */
  checkInResponses: ICheckInResponse[];
  /** All session participants */
  participants: IParticipant[];
  /** Current participant ID */
  currentUserId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [mood: CheckInMood];
}>();

const selectedMood = computed(() => {
  return props.checkInResponses.find(
    (r) => r.participantId === props.currentUserId
  )?.mood ?? null;
});

const responseCount = computed(() => props.checkInResponses.length);
const totalParticipants = computed(() => props.participants.length);

function selectMood(mood: CheckInMood): void {
  emit('submit', mood);
}

/**
 * Maps each mood to its i18n translation key.
 * Uses satisfies Record<CheckInMood, string> so the compiler errors
 * if CHECK_IN_MOODS gains a new entry without a matching label here.
 */
const MOOD_TRANSLATION_KEYS = {
  '😊': 'checkin.moodLabels.happy',
  '😐': 'checkin.moodLabels.neutral',
  '😟': 'checkin.moodLabels.worried',
  '🔥': 'checkin.moodLabels.energized',
  '💪': 'checkin.moodLabels.confident',
  '😴': 'checkin.moodLabels.tired',
} as const satisfies Record<CheckInMood, string>;

function getMoodLabel(mood: CheckInMood): string {
  return t(MOOD_TRANSLATION_KEYS[mood]);
}

/**
 * Returns the participant name for a check-in response
 */
function getParticipantName(participantId: string): string {
  return (
    props.participants.find((p) => p.id === participantId)?.name ??
    t('checkin.unknownParticipant')
  );
}
</script>

<template>
  <div class="card-container">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <Icon name="heroicons:hand-raised" class="w-6 h-6 text-primary-600" />
      <h3 class="text-lg font-bold text-secondary-800">
        {{ t('checkin.title') }}
      </h3>
    </div>

    <p class="text-sm text-secondary-600 mb-6">
      {{ t('checkin.question') }}
    </p>

    <!-- Mood Selector -->
    <div class="flex justify-center gap-4 mb-6">
      <button
        v-for="mood in CHECK_IN_MOODS"
        :key="mood"
        type="button"
        :aria-label="getMoodLabel(mood)"
        :aria-pressed="selectedMood === mood"
        :title="getMoodLabel(mood)"
        class="text-4xl p-3 rounded-xl transition-all hover:scale-110"
        :class="
          selectedMood === mood
            ? 'bg-primary-100 ring-2 ring-primary-500 scale-110'
            : 'bg-secondary-50 hover:bg-secondary-100'
        "
        @click="selectMood(mood)"
      >
        {{ mood }}
      </button>
    </div>

    <!-- Responses -->
    <div class="border-t border-secondary-200 pt-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-secondary-600">
          {{ t('checkin.responses') }}
        </span>
        <span class="text-xs text-secondary-400">
          {{ responseCount }}/{{ totalParticipants }}
        </span>
      </div>

      <div v-if="checkInResponses.length > 0" class="flex flex-wrap gap-3">
        <div
          v-for="response in checkInResponses"
          :key="response.participantId"
          class="flex items-center gap-2 bg-secondary-50 rounded-full px-3 py-1.5"
        >
          <span class="text-lg">{{ response.mood }}</span>
          <span class="text-xs text-secondary-600">
            {{ getParticipantName(response.participantId) }}
          </span>
        </div>
      </div>

      <p
        v-else
        class="text-sm text-secondary-400 text-center py-4"
      >
        {{ t('checkin.waiting') }}
      </p>
    </div>
  </div>
</template>

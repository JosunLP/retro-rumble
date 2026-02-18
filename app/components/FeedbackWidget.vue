<script setup lang="ts">
/**
 * FeedbackWidget Component
 *
 * "Fist-to-Five" retro feedback for the "Close the Retro" phase.
 * Participants rate the retro from 1 (not great) to 5 (excellent).
 */

import type { IFeedbackResponse, IParticipant } from '~/types';

const { t } = useI18n();

interface Props {
  /** All feedback responses so far */
  feedbackResponses: IFeedbackResponse[];
  /** All session participants */
  participants: IParticipant[];
  /** Current participant ID */
  currentUserId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [rating: number];
}>();

const selectedRating = computed(() => {
  return (
    props.feedbackResponses.find(
      (r) => r.participantId === props.currentUserId
    )?.rating ?? null
  );
});

const averageRating = computed(() => {
  if (props.feedbackResponses.length === 0) return 0;
  const sum = props.feedbackResponses.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / props.feedbackResponses.length) * 10) / 10;
});

const responseCount = computed(() => props.feedbackResponses.length);
const totalParticipants = computed(() => props.participants.length);

const ratingLabels = computed(() => [
  t('feedback.rating1'),
  t('feedback.rating2'),
  t('feedback.rating3'),
  t('feedback.rating4'),
  t('feedback.rating5'),
]);

const ratingEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

function submitRating(rating: number): void {
  emit('submit', rating);
}
</script>

<template>
  <div class="card-container">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <Icon
        name="heroicons:chat-bubble-bottom-center-text"
        class="w-6 h-6 text-primary-600"
      />
      <h3 class="text-lg font-bold text-secondary-800">
        {{ t('feedback.title') }}
      </h3>
    </div>

    <p class="text-sm text-secondary-600 mb-6">
      {{ t('feedback.question') }}
    </p>

    <!-- Rating Selector (Fist to Five) -->
    <div class="flex justify-center gap-3 mb-6">
      <button
        v-for="rating in 5"
        :key="rating"
        type="button"
        class="flex flex-col items-center gap-1 p-3 rounded-xl transition-all hover:scale-105"
        :class="
          selectedRating === rating
            ? 'bg-primary-100 ring-2 ring-primary-500 scale-105'
            : 'bg-secondary-50 hover:bg-secondary-100'
        "
        @click="submitRating(rating)"
      >
        <span class="text-2xl">{{ ratingEmojis[rating - 1] }}</span>
        <span class="text-xs text-secondary-500">
          {{ ratingLabels[rating - 1] }}
        </span>
      </button>
    </div>

    <!-- Aggregate Results -->
    <div class="border-t border-secondary-200 pt-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-secondary-600">
          {{ t('feedback.results') }}
        </span>
        <span class="text-xs text-secondary-400">
          {{ responseCount }}/{{ totalParticipants }}
        </span>
      </div>

      <div
        v-if="feedbackResponses.length > 0"
        class="flex items-center justify-center gap-4"
      >
        <div class="text-center">
          <div class="text-3xl font-bold text-primary-700">
            {{ averageRating }}
          </div>
          <div class="text-xs text-secondary-500">
            {{ t('feedback.average') }}
          </div>
        </div>
        <!-- Distribution bars -->
        <div class="flex gap-1 items-end h-16">
          <div
            v-for="rating in 5"
            :key="rating"
            class="w-6 rounded-t bg-primary-400 transition-all"
            :style="{
              height:
                feedbackResponses.filter((r) => r.rating === rating).length > 0
                  ? `${(feedbackResponses.filter((r) => r.rating === rating).length / feedbackResponses.length) * 100}%`
                  : '4px',
            }"
            :title="`${rating}: ${feedbackResponses.filter((r) => r.rating === rating).length}`"
          />
        </div>
      </div>

      <p v-else class="text-sm text-secondary-400 text-center py-4">
        {{ t('feedback.waiting') }}
      </p>
    </div>
  </div>
</template>

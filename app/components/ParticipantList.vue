<script setup lang="ts">
/**
 * ParticipantList Component
 *
 * Displays all participants in the session.
 */

import type { IParticipant } from '~/types';

const { t } = useI18n();

interface Props {
  /** List of participants */
  participants: IParticipant[];
  /** ID of the current user */
  currentUserId?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="card-container">
    <h3 class="font-semibold text-secondary-800 mb-3 flex items-center gap-2">
      <Icon name="heroicons:users" class="w-5 h-5 text-primary-600" />
      {{ t('participants.title') }}
    </h3>

    <ul class="space-y-2">
      <li
        v-for="participant in participants"
        :key="participant.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded-lg"
        :class="participant.id === currentUserId ? 'bg-primary-50' : ''"
      >
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
          :class="participant.isHost ? 'bg-accent-500' : 'bg-primary-500'"
        >
          {{ participant.name.charAt(0).toUpperCase() }}
        </div>
        <span class="text-sm text-secondary-700 truncate flex-1">
          {{ participant.name }}
        </span>
        <Icon
          v-if="participant.isHost"
          name="heroicons:star-solid"
          class="w-4 h-4 text-accent-500"
          :title="t('participants.host')"
        />
        <span
          v-if="participant.id === currentUserId"
          class="text-xs text-primary-600"
        >
          {{ t('participants.you') }}
        </span>
      </li>
    </ul>
  </div>
</template>

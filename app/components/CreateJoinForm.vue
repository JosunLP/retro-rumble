<script setup lang="ts">
/**
 * CreateJoinForm Component
 *
 * Form for creating a new retro session or joining an existing one.
 */

import { isValidJoinCode, MAX_MAX_VOTES_PER_USER, MIN_MAX_VOTES_PER_USER } from '~/types';
import { getBrowserStorage } from '~/utils/browserStorage';
import {
  getMatchingStoredSessionIdentity,
  normalizeJoinCode,
  readStoredSessionIdentity,
  shouldRequireParticipantNameForJoin,
} from '~/utils/sessionIdentity';

const { t } = useI18n();

interface Props {
  /** Prefilled join code (from URL) */
  prefilledJoinCode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  prefilledJoinCode: '',
});

const emit = defineEmits<{
  create: [
    sessionName: string,
    participantName: string,
    maxVotes: number,
    timerDuration: number,
  ];
  join: [code: string, participantName: string];
}>();

const mode = ref<'create' | 'join'>(props.prefilledJoinCode ? 'join' : 'create');

// Create form
const sessionName = ref('');
const createName = ref('');
const maxVotes = ref(5);
const timerDuration = ref(300);

// Join form
const joinCode = ref(props.prefilledJoinCode);
const joinName = ref('');
const normalizedJoinCode = computed(() => normalizeJoinCode(joinCode.value));

const matchingStoredJoinIdentity = computed(() => {
  if (!isValidJoinCode(normalizedJoinCode.value)) {
    return null;
  }

  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  return getMatchingStoredSessionIdentity(
    normalizedJoinCode.value,
    readStoredSessionIdentity(storage, normalizedJoinCode.value)
  );
});

const requiresJoinName = computed(() =>
  shouldRequireParticipantNameForJoin(joinName.value, matchingStoredJoinIdentity.value)
);

const isJoinDisabled = computed(
  () => !joinCode.value.trim() || requiresJoinName.value
);

watch(
  () => props.prefilledJoinCode,
  (newJoinCode) => {
    joinCode.value = normalizeJoinCode(newJoinCode);
    if (newJoinCode) {
      mode.value = 'join';
    }
  },
  { immediate: true }
);

function handleJoinCodeInput(event: Event): void {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  joinCode.value = normalizeJoinCode(target.value);
}

function handleCreate(): void {
  emit(
    'create',
    sessionName.value,
    createName.value,
    maxVotes.value,
    timerDuration.value
  );
}

function handleJoin(): void {
  emit('join', joinCode.value, joinName.value);
}

function switchMode(newMode: 'create' | 'join'): void {
  mode.value = newMode;
}
</script>

<template>
  <div class="max-w-md mx-auto">
    <!-- Mode Tabs -->
    <div class="flex justify-center mb-6">
      <div class="inline-flex rounded-lg bg-secondary-100 p-1">
        <button
          type="button"
          class="px-4 py-2 rounded-md text-sm font-medium transition-all"
          :class="
            mode === 'create'
              ? 'bg-white shadow text-primary-700'
              : 'text-secondary-600 hover:text-secondary-800'
          "
          @click="switchMode('create')"
        >
          <Icon name="heroicons:plus" class="w-4 h-4 inline mr-1" />
          {{ t('home.newSession') }}
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-md text-sm font-medium transition-all"
          :class="
            mode === 'join'
              ? 'bg-white shadow text-primary-700'
              : 'text-secondary-600 hover:text-secondary-800'
          "
          @click="switchMode('join')"
        >
          <Icon
            name="heroicons:arrow-right-on-rectangle"
            class="w-4 h-4 inline mr-1"
          />
          {{ t('home.joinSession') }}
        </button>
      </div>
    </div>

    <!-- Create Form -->
    <Transition name="fade" mode="out-in">
      <form
        v-if="mode === 'create'"
        class="card-container space-y-4"
        @submit.prevent="handleCreate"
      >
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-1">
            {{ t('form.sessionName') }}
          </label>
          <input
            v-model="sessionName"
            type="text"
            class="input"
            :placeholder="t('form.sessionNamePlaceholder')"
            required
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-1">
            {{ t('form.yourName') }}
          </label>
          <input
            v-model="createName"
            type="text"
            class="input"
            :placeholder="t('form.yourNamePlaceholder')"
            required
          >
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-secondary-700 mb-1">
              {{ t('form.maxVotes') }}
            </label>
            <input
              v-model.number="maxVotes"
              type="number"
              class="input"
              :min="MIN_MAX_VOTES_PER_USER"
              :max="MAX_MAX_VOTES_PER_USER"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-700 mb-1">
              {{ t('form.timerMinutes') }}
            </label>
            <input
              :value="timerDuration / 60"
              type="number"
              class="input"
              min="1"
              max="30"
              @input="
                timerDuration =
                  Number(($event.target as HTMLInputElement).value) * 60
              "
            >
          </div>
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="!sessionName.trim() || !createName.trim()"
        >
          <Icon name="heroicons:rocket-launch" class="w-5 h-5 mr-2" />
          {{ t('form.createButton') }}
        </button>
      </form>

      <!-- Join Form -->
      <form
        v-else
        class="card-container space-y-4"
        @submit.prevent="handleJoin"
      >
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-1">
            {{ t('form.joinCode') }}
          </label>
          <input
            :value="joinCode"
            type="text"
            class="input font-mono text-center text-lg tracking-widest uppercase"
            :placeholder="t('form.joinCodePlaceholder')"
            required
            @input="handleJoinCodeInput"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-1">
            {{ t('form.yourName') }}
          </label>
          <input
            v-model="joinName"
            type="text"
            class="input"
            :placeholder="t('form.yourNamePlaceholder')"
            :required="requiresJoinName"
          >
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="isJoinDisabled"
        >
          <Icon
            name="heroicons:arrow-right-on-rectangle"
            class="w-5 h-5 mr-2"
          />
          {{ t('form.joinButton') }}
        </button>
      </form>
    </Transition>
  </div>
</template>

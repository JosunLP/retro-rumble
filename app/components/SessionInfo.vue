<script setup lang="ts">
/**
 * SessionInfo Component
 *
 * Displays session information, join code, and participant count.
 */

const { t } = useI18n();

interface Props {
  /** Session name */
  sessionName: string;
  /** Join code for sharing */
  joinCode: string;
  /** Number of participants */
  participantCount: number;
}

defineProps<Props>();

const emit = defineEmits<{
  leave: [];
}>();

const copied = ref(false);

/**
 * Copies the join code to clipboard
 */
async function copyJoinCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard API not available
  }
}
</script>

<template>
  <div class="card-container">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-semibold text-secondary-800">
        {{ sessionName }}
      </h3>
      <button
        type="button"
        class="text-sm text-error-600 hover:text-error-700 transition-colors"
        @click="emit('leave')"
      >
        <Icon name="heroicons:arrow-right-on-rectangle" class="w-5 h-5" />
      </button>
    </div>

    <!-- Join Code -->
    <div class="mb-3">
      <p class="text-xs text-secondary-500 mb-1">
        {{ t('session.joinCode') }}
      </p>
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-1.5 bg-secondary-100 rounded-lg hover:bg-secondary-200 transition-colors w-full"
        @click="copyJoinCode(joinCode)"
      >
        <span
          class="font-mono font-bold text-lg tracking-widest text-primary-700"
        >
          {{ joinCode }}
        </span>
        <Icon
          :name="copied ? 'heroicons:check' : 'heroicons:clipboard-document'"
          class="w-4 h-4 text-secondary-500 ml-auto"
        />
      </button>
    </div>

    <!-- Participant Count -->
    <div class="flex items-center gap-2 text-sm text-secondary-600">
      <Icon name="heroicons:users" class="w-4 h-4" />
      <span>{{ participantCount }} {{ t('session.participants') }}</span>
    </div>
  </div>
</template>

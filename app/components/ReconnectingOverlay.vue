<script setup lang="ts">
import type { ConnectionStatus } from '~/composables/useWebSocket';

/**
 * Full-screen overlay shown when a live session loses its WebSocket connection.
 * Only visible while status is 'connecting' or 'error' AND a session is active.
 */
const props = defineProps<{
  /** Current WebSocket connection status */
  status: ConnectionStatus;
  /** Whether there is an active session that should be preserved */
  hasSession: boolean;
}>();

const { t } = useI18n();

/** True while the overlay should block interaction */
const isVisible = computed(
  () => props.hasSession && (props.status === 'connecting' || props.status === 'error'),
);
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isVisible"
      role="status"
      aria-live="polite"
      :aria-label="t('ui.reconnecting')"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-secondary-900/80 backdrop-blur-sm"
    >
      <!-- Animated spinner -->
      <svg
        class="h-14 w-14 animate-spin text-primary-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>

      <p class="text-xl font-semibold text-white">
        {{ t('ui.reconnecting') }}
      </p>
      <p class="max-w-sm text-center text-sm text-secondary-300">
        {{ t('ui.reconnectingHint') }}
      </p>

      <!-- Error hint — shown only when status is definitively 'error' -->
      <p v-if="status === 'error'" class="text-xs text-error-300">
        {{ t('ui.reconnectingError') }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

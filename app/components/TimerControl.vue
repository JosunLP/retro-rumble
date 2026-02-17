<script setup lang="ts">
/**
 * TimerControl Component
 *
 * Displays and controls the session timer.
 */

const { t } = useI18n();

interface Props {
  /** Timer duration in seconds */
  duration: number;
  /** Remaining time in seconds (null = not running) */
  remaining: number | null;
  /** Is the timer running? */
  running: boolean;
  /** Is the user the host? */
  isHost: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  start: [];
  stop: [];
  setDuration: [duration: number];
}>();

/**
 * Formats seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Timer progress percentage
 */
const progress = computed(() => {
  if (props.remaining === null || props.duration === 0) return 0;
  return ((props.duration - props.remaining) / props.duration) * 100;
});

/**
 * Pre-defined timer options in seconds
 */
const timerOptions = [60, 120, 180, 300, 600];
</script>

<template>
  <div class="card-container">
    <h3 class="font-semibold text-secondary-800 mb-3 flex items-center gap-2">
      <Icon name="heroicons:clock" class="w-5 h-5 text-primary-600" />
      {{ t('timer.title') }}
    </h3>

    <!-- Timer Display -->
    <div class="text-center mb-3">
      <div
        class="text-3xl font-mono font-bold"
        :class="{
          'text-error-600': running && remaining !== null && remaining <= 30,
          'text-warning-600':
            running && remaining !== null && remaining > 30 && remaining <= 60,
          'text-secondary-800':
            !running || remaining === null || remaining > 60,
        }"
      >
        {{
          running && remaining !== null
            ? formatTime(remaining)
            : formatTime(duration)
        }}
      </div>

      <!-- Progress Bar -->
      <div
        v-if="running"
        class="mt-2 h-1.5 bg-secondary-200 rounded-full overflow-hidden"
      >
        <div
          class="h-full rounded-full transition-all duration-1000"
          :class="{
            'bg-error-500': remaining !== null && remaining <= 30,
            'bg-warning-500':
              remaining !== null && remaining > 30 && remaining <= 60,
            'bg-primary-500': remaining === null || remaining > 60,
          }"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>

    <!-- Host Controls -->
    <div v-if="isHost" class="space-y-2">
      <!-- Start/Stop -->
      <div class="flex gap-2">
        <button
          v-if="!running"
          type="button"
          class="btn btn-sm btn-success flex-1"
          @click="emit('start')"
        >
          <Icon name="heroicons:play" class="w-4 h-4 mr-1" />
          {{ t('timer.start') }}
        </button>
        <button
          v-else
          type="button"
          class="btn btn-sm btn-error flex-1"
          @click="emit('stop')"
        >
          <Icon name="heroicons:stop" class="w-4 h-4 mr-1" />
          {{ t('timer.stop') }}
        </button>
      </div>

      <!-- Duration Presets -->
      <div v-if="!running" class="flex flex-wrap gap-1">
        <button
          v-for="option in timerOptions"
          :key="option"
          type="button"
          class="px-2 py-1 text-xs rounded-md transition-colors"
          :class="
            duration === option
              ? 'bg-primary-100 text-primary-700 font-medium'
              : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
          "
          @click="emit('setDuration', option)"
        >
          {{ formatTime(option) }}
        </button>
      </div>
    </div>
  </div>
</template>

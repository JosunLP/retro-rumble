<script setup lang="ts">
/**
 * PhaseIndicator Component
 *
 * Displays the current retro phase with step indicators.
 */

import type { RetroPhase } from '~/types';
import { RETRO_PHASES } from '~/types';

const { t } = useI18n();

interface Props {
  /** Current phase */
  currentPhase: RetroPhase;
  /** Is the user the host? */
  isHost: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  changePhase: [phase: RetroPhase];
}>();

const phaseIndex = computed(() => RETRO_PHASES.indexOf(props.currentPhase));

const phaseIcons: Record<RetroPhase, string> = {
  'set-the-stage': 'heroicons:hand-raised',
  'gather-data': 'heroicons:pencil-square',
  'generate-insights': 'heroicons:light-bulb',
  'voting': 'heroicons:hand-thumb-up',
  'decide-action': 'heroicons:rocket-launch',
  'close-retro': 'heroicons:clipboard-document-check',
};

function nextPhase(): void {
  const nextIdx = phaseIndex.value + 1;
  if (nextIdx < RETRO_PHASES.length) {
    emit('changePhase', RETRO_PHASES[nextIdx]!);
  }
}

function prevPhase(): void {
  const prevIdx = phaseIndex.value - 1;
  if (prevIdx >= 0) {
    emit('changePhase', RETRO_PHASES[prevIdx]!);
  }
}
</script>

<template>
  <div class="card-container">
    <!-- Phase Steps -->
    <div class="flex items-center justify-between mb-2">
      <div
        v-for="(phase, idx) in RETRO_PHASES"
        :key="phase"
        class="flex items-center"
      >
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
          :class="{
            'bg-primary-600 text-white shadow-sm': idx === phaseIndex,
            'bg-primary-100 text-primary-700': idx < phaseIndex,
            'bg-secondary-100 text-secondary-500': idx > phaseIndex,
          }"
        >
          <Icon :name="phaseIcons[phase]" class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t(`phase.${phase}`) }}</span>
        </div>
        <div
          v-if="idx < RETRO_PHASES.length - 1"
          class="w-6 h-0.5 mx-1"
          :class="idx < phaseIndex ? 'bg-primary-400' : 'bg-secondary-200'"
        />
      </div>
    </div>

    <!-- Phase description -->
    <p class="text-sm text-secondary-500 text-center mb-4">
      {{ t(`phase.description.${currentPhase}`) }}
    </p>

    <!-- Host Controls -->
    <div v-if="isHost" class="flex items-center justify-between">
      <button
        type="button"
        class="btn btn-sm btn-secondary"
        :disabled="phaseIndex === 0"
        :aria-label="t('phase.previous') + (phaseIndex > 0 ? ': ' + t(`phase.${RETRO_PHASES[phaseIndex - 1]}`) : '')"
        @click="prevPhase"
      >
        <Icon name="heroicons:chevron-left" class="w-4 h-4 mr-1" />
        {{ t('phase.previous') }}
      </button>
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="phaseIndex === RETRO_PHASES.length - 1"
        :aria-label="t('phase.next') + (phaseIndex < RETRO_PHASES.length - 1 ? ': ' + t(`phase.${RETRO_PHASES[phaseIndex + 1]}`) : '')"
        @click="nextPhase"
      >
        {{ t('phase.next') }}
        <Icon name="heroicons:chevron-right" class="w-4 h-4 ml-1" />
      </button>
    </div>
  </div>
</template>

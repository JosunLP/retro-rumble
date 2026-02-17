<script setup lang="ts">
/**
 * ExportPanel Component
 *
 * Provides download buttons for exporting retro results
 * in various formats: JSON, CSV, Markdown, PNG, PDF.
 */

import type { IRetroSession } from '~/types';

const { t } = useI18n();
const { exportJSON, exportCSV, exportMarkdown, exportPNG, exportPDF } =
  useExport();

interface Props {
  session: IRetroSession;
}

const props = defineProps<Props>();

const isExporting = ref<string | null>(null);

const formats = [
  {
    id: 'json',
    icon: 'heroicons:code-bracket',
    color: 'text-accent-600',
    bgColor: 'bg-accent-50 hover:bg-accent-100 border-accent-200',
  },
  {
    id: 'csv',
    icon: 'heroicons:table-cells',
    color: 'text-success-600',
    bgColor: 'bg-success-50 hover:bg-success-100 border-success-200',
  },
  {
    id: 'markdown',
    icon: 'heroicons:document-text',
    color: 'text-secondary-600',
    bgColor: 'bg-secondary-50 hover:bg-secondary-100 border-secondary-200',
  },
  {
    id: 'png',
    icon: 'heroicons:photo',
    color: 'text-primary-600',
    bgColor: 'bg-primary-50 hover:bg-primary-100 border-primary-200',
  },
  {
    id: 'pdf',
    icon: 'heroicons:document-arrow-down',
    color: 'text-error-600',
    bgColor: 'bg-error-50 hover:bg-error-100 border-error-200',
  },
] as const;

async function handleExport(format: string): Promise<void> {
  isExporting.value = format;
  try {
    switch (format) {
      case 'json':
        exportJSON(props.session);
        break;
      case 'csv':
        exportCSV(props.session);
        break;
      case 'markdown':
        exportMarkdown(props.session);
        break;
      case 'png':
        await exportPNG(props.session);
        break;
      case 'pdf':
        await exportPDF(props.session);
        break;
    }
  } finally {
    // Brief visual feedback
    setTimeout(() => {
      isExporting.value = null;
    }, 800);
  }
}
</script>

<template>
  <div class="card-container">
    <div class="flex items-center gap-2 mb-4">
      <Icon name="heroicons:arrow-down-tray" class="w-5 h-5 text-primary-600" />
      <h3 class="text-lg font-bold text-secondary-800">
        {{ t('export.title') }}
      </h3>
    </div>

    <p class="text-sm text-secondary-500 mb-4">
      {{ t('export.description') }}
    </p>

    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <button
        v-for="fmt in formats"
        :key="fmt.id"
        type="button"
        class="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer"
        :class="fmt.bgColor"
        :disabled="isExporting !== null"
        @click="handleExport(fmt.id)"
      >
        <Icon
          v-if="isExporting === fmt.id"
          name="heroicons:arrow-path"
          class="w-6 h-6 animate-spin"
          :class="fmt.color"
        />
        <Icon v-else :name="fmt.icon" class="w-6 h-6" :class="fmt.color" />
        <span class="text-xs font-medium text-secondary-700">
          {{ t(`export.format.${fmt.id}`) }}
        </span>
      </button>
    </div>
  </div>
</template>

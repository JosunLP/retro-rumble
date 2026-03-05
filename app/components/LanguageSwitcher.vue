<script setup lang="ts">
/**
 * LanguageSwitcher Component
 *
 * Allows users to switch between all available languages via a dropdown.
 * Locale codes are derived from the registered i18n locales to avoid hardcoding.
 */

const { locale, locales, setLocale } = useI18n();

type LocaleCode = typeof locales.value extends Array<{ code: infer C }> ? C : string;

const isOpen = ref(false);

const currentLocale = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).find(
    (l) => l.code === locale.value
  )
);

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).filter(
    (l) => l.code !== locale.value
  )
);

function switchLocale(code: string): void {
  setLocale(code as LocaleCode);
  isOpen.value = false;
}

function toggleDropdown(): void {
  isOpen.value = !isOpen.value;
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest('.language-switcher')) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
  <div class="language-switcher relative">
    <button
      type="button"
      class="flex items-center gap-1 px-2 py-1 text-sm text-secondary-600 hover:text-primary-600 transition-colors rounded"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click.stop="toggleDropdown"
    >
      <span>{{ currentLocale?.name }}</span>
      <Icon
        :name="isOpen ? 'heroicons:chevron-up-16-solid' : 'heroicons:chevron-down-16-solid'"
        class="w-3 h-3"
      />
    </button>
    <div
      v-if="isOpen"
      role="listbox"
      class="absolute right-0 mt-1 w-44 bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded shadow-lg z-50 py-1 max-h-72 overflow-y-auto"
    >
      <button
        v-for="loc in availableLocales"
        :key="loc.code"
        type="button"
        role="option"
        class="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
        @click="switchLocale(loc.code)"
      >
        {{ loc.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * LanguageSwitcher Component
 *
 * Allows users to switch between available languages.
 */

const { locale, locales, setLocale } = useI18n();

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).filter(
    (l) => l.code !== locale.value
  )
);

function switchLocale(code: string): void {
  setLocale(code);
}
</script>

<template>
  <div class="relative">
    <button
      v-for="loc in availableLocales"
      :key="loc.code"
      type="button"
      class="px-2 py-1 text-sm text-secondary-600 hover:text-primary-600 transition-colors"
      @click="switchLocale(loc.code)"
    >
      {{ loc.name }}
    </button>
  </div>
</template>

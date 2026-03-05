// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/hints',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
  ],

  devtools: { enabled: true },

  compatibilityDate: '2026-01-22',

  /**
   * TypeScript Configuration
   * Strict typing for better code quality
   */
  typescript: {
    strict: true,
    typeCheck: 'build',
  },

  /**
   * Nitro Server Configuration
   * WebSocket support for real-time communication
   */
  nitro: {
    experimental: {
      websocket: true,
    },
  },

  /**
   * Tailwind CSS Configuration
   */
  tailwindcss: {
    cssPath: ['~/assets/css/main.css', { injectPosition: 'first' }],
    configPath: 'tailwind.config.ts',
  },

  /**
   * i18n Configuration
   * Internationalization support for all 12 languages matching the planning-poker reference project:
   * English, German, Spanish, French, Italian, Japanese, Dutch, Polish, Brazilian Portuguese,
   * Russian, Swedish, Simplified Chinese
   */
  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json', iso: 'en-US' },
      { code: 'de', name: 'Deutsch', file: 'de.json', iso: 'de-DE' },
      { code: 'es', name: 'Español', file: 'es.json', iso: 'es-ES' },
      { code: 'fr', name: 'Français', file: 'fr.json', iso: 'fr-FR' },
      { code: 'it', name: 'Italiano', file: 'it.json', iso: 'it-IT' },
      { code: 'ja', name: '日本語', file: 'ja.json', iso: 'ja-JP' },
      { code: 'nl', name: 'Nederlands', file: 'nl.json', iso: 'nl-NL' },
      { code: 'pl', name: 'Polski', file: 'pl.json', iso: 'pl-PL' },
      { code: 'pt-BR', name: 'Português (BR)', file: 'pt-BR.json', iso: 'pt-BR' },
      { code: 'ru', name: 'Русский', file: 'ru.json', iso: 'ru-RU' },
      { code: 'sv', name: 'Svenska', file: 'sv.json', iso: 'sv-SE' },
      { code: 'zh-CN', name: '中文 (简体)', file: 'zh-CN.json', iso: 'zh-CN' },
    ],
    defaultLocale: 'en',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },

  /**
   * Runtime Configuration
   */
  runtimeConfig: {},
});

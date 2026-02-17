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
   * Internationalization support for English and German
   */
  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json', iso: 'en-US' },
      { code: 'de', name: 'Deutsch', file: 'de.json', iso: 'de-DE' },
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

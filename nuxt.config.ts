// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
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
   * Tailwind CSS Configuration
   */
  tailwindcss: {
    cssPath: ['~/assets/css/main.css', { injectPosition: 'first' }],
    configPath: 'tailwind.config.ts',
  },

  /**
   * i18n Configuration
   * Internationalization support
   */
  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json', iso: 'en-US' },
      { code: 'de', name: 'Deutsch', file: 'de.json', iso: 'de-DE' },
    ],
    defaultLocale: 'en',
    langDir: 'i18n/locales',
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
})

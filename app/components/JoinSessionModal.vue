<template>
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="join-session-title"
  >
    <div class="bg-white rounded-card max-w-md w-full p-6 animate-bounce-in">
      <div class="flex justify-between items-center mb-6">
        <h2 id="join-session-title">{{ $t('session.join') }}</h2>
        <button 
          class="text-secondary-400 hover:text-secondary-600" 
          aria-label="Close"
          @click="$emit('close')"
        >
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="joinSession">
        <!-- Session Code -->
        <div>
          <label for="session-code" class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.sessionCode') }}
          </label>
          <input
            id="session-code"
            v-model="form.sessionCode"
            type="text"
            required
            class="input-field uppercase"
            :placeholder="$t('session.enterCode')"
            maxlength="8"
          >
        </div>

        <!-- Participant Name -->
        <div>
          <label for="participant-name" class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.yourName') }}
          </label>
          <input
            id="participant-name"
            v-model="form.name"
            type="text"
            :required="!form.isAnonymous"
            class="input-field"
            :placeholder="$t('session.yourNamePlaceholder')"
          >
        </div>

        <!-- Anonymous Mode -->
        <div class="flex items-center">
          <input
            id="join-anonymous"
            v-model="form.isAnonymous"
            type="checkbox"
            class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          >
          <label for="join-anonymous" class="ml-2 text-sm text-secondary-700">
            {{ $t('session.anonymous') }}
          </label>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="text-error-600 text-sm">
          {{ error }}
        </div>

        <!-- Submit Button -->
        <button type="submit" class="btn-primary w-full">
          {{ $t('common.join') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(['close'])
const { t } = useI18n()

const form = ref({
  sessionCode: '',
  name: '',
  isAnonymous: false,
})

const error = ref('')

const joinSession = () => {
  error.value = ''
  
  // Ensure we're in a browser environment with localStorage
  if (typeof window === 'undefined' || !('localStorage' in window) || !window.localStorage) {
    console.error('localStorage is not available')
    error.value = 'Session storage is not available. Please check your browser settings.'
    return
  }
  
  try {
    // Check if session exists in localStorage
    const sessionCode = form.value.sessionCode.toUpperCase()
    const sessionData = window.localStorage.getItem(`session-${sessionCode}`)
    
    if (!sessionData) {
      error.value = t('errors.sessionNotFound')
      return
    }
    
    // Navigate to session
    navigateTo(`/session/${sessionCode}?name=${encodeURIComponent(form.value.name)}&anonymous=${form.value.isAnonymous}`)
  } catch (err) {
    console.error('Failed to join session:', err)
    error.value = t('errors.generic')
  }
}
</script>

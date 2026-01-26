<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-card max-w-md w-full p-6 animate-bounce-in">
      <div class="flex justify-between items-center mb-6">
        <h2>{{ $t('session.join') }}</h2>
        <button @click="$emit('close')" class="text-secondary-400 hover:text-secondary-600">
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>

      <form @submit.prevent="joinSession" class="space-y-4">
        <!-- Session Code -->
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.sessionCode') }}
          </label>
          <input
            v-model="form.sessionCode"
            type="text"
            required
            class="input-field uppercase"
            :placeholder="$t('session.enterCode')"
            maxlength="6"
          />
        </div>

        <!-- Participant Name -->
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-2">
            Your Name
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            class="input-field"
            placeholder="Your name"
          />
        </div>

        <!-- Anonymous Mode -->
        <div class="flex items-center">
          <input
            v-model="form.isAnonymous"
            type="checkbox"
            id="join-anonymous"
            class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          />
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
const emit = defineEmits(['close'])

const form = ref({
  sessionCode: '',
  name: '',
  isAnonymous: false,
})

const error = ref('')

const joinSession = () => {
  error.value = ''
  
  // Check if session exists in localStorage
  const sessionCode = form.value.sessionCode.toUpperCase()
  const sessionData = localStorage.getItem(`session-${sessionCode}`)
  
  if (!sessionData) {
    error.value = 'Session not found. Please check the code.'
    return
  }
  
  // Navigate to session
  navigateTo(`/session/${sessionCode}?name=${encodeURIComponent(form.value.name)}&anonymous=${form.value.isAnonymous}`)
}
</script>

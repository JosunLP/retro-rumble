<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-card max-w-md w-full p-6 animate-bounce-in">
      <div class="flex justify-between items-center mb-6">
        <h2>{{ $t('session.create') }}</h2>
        <button @click="$emit('close')" class="text-secondary-400 hover:text-secondary-600">
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>

      <form @submit.prevent="createSession" class="space-y-4">
        <!-- Session Title -->
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.title') }}
          </label>
          <input
            v-model="form.title"
            type="text"
            required
            class="input-field"
            :placeholder="$t('session.title')"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.description') }}
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="input-field"
            :placeholder="$t('session.description')"
          />
        </div>

        <!-- Facilitator Name -->
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-2">
            Your Name
          </label>
          <input
            v-model="form.facilitatorName"
            type="text"
            required
            class="input-field"
            placeholder="Your name"
          />
        </div>

        <!-- Max Votes -->
        <div>
          <label class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.maxVotes') }}
          </label>
          <input
            v-model.number="form.maxVotes"
            type="number"
            min="1"
            max="10"
            required
            class="input-field"
          />
        </div>

        <!-- Anonymous Mode -->
        <div class="flex items-center">
          <input
            v-model="form.isAnonymous"
            type="checkbox"
            id="anonymous"
            class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <label for="anonymous" class="ml-2 text-sm text-secondary-700">
            Enable anonymous mode
          </label>
        </div>

        <!-- Submit Button -->
        <button type="submit" class="btn-primary w-full">
          {{ $t('common.create') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['close'])

const form = ref({
  title: '',
  description: '',
  facilitatorName: '',
  maxVotes: 3,
  isAnonymous: false,
})

const createSession = () => {
  // Generate session ID
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase()
  
  // Store session data in localStorage (temporary, will be replaced with API)
  const sessionData = {
    id: sessionId,
    ...form.value,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(`session-${sessionId}`, JSON.stringify(sessionData))
  
  // Navigate to session
  navigateTo(`/session/${sessionId}`)
}
</script>

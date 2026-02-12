<template>
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-session-title"
  >
    <div class="bg-white rounded-card max-w-md w-full p-6 animate-bounce-in">
      <div class="flex justify-between items-center mb-6">
        <h2 id="create-session-title">{{ $t('session.create') }}</h2>
        <button 
          @click="$emit('close')" 
          class="text-secondary-400 hover:text-secondary-600"
          aria-label="Close"
        >
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
            {{ $t('session.yourName') }}
          </label>
          <input
            v-model="form.facilitatorName"
            type="text"
            required
            class="input-field"
            :placeholder="$t('session.yourNamePlaceholder')"
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
            {{ $t('session.enableAnonymous') }}
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
  try {
    // Generate session ID using cryptographically secure random UUID
    const sessionId = crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()
    
    // Generate facilitator ID
    const facilitatorId = crypto.randomUUID()
    
    // Store session data in localStorage matching RetroSession shape
    const sessionData = {
      id: sessionId,
      title: form.value.title,
      description: form.value.description,
      phase: 'writing' as const,
      facilitatorId: facilitatorId,
      participants: [],
      cards: [],
      maxVotesPerParticipant: form.value.maxVotes,
      isAnonymousMode: form.value.isAnonymous,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(`session-${sessionId}`, JSON.stringify(sessionData))
    
    // Store facilitator ID as the user's ID for this browser
    // This ID persists across all sessions the user creates or joins
    try {
      localStorage.setItem('userId', facilitatorId)
    } catch (error) {
      console.error('Failed to store facilitator ID:', error)
      // Treat this as a hard failure - without userId, facilitator permissions will be lost
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Failed to create session. Please check your browser storage settings and try again.')
      }
      return
    }
    
    // Navigate to session with facilitator name
    navigateTo(`/session/${sessionId}?name=${encodeURIComponent(form.value.facilitatorName)}`)
  } catch (error) {
    console.error('Failed to create session:', error)
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Failed to create session. Please check your browser storage settings and try again.')
    }
  }
}
</script>

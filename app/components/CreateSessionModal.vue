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
          class="text-secondary-400 hover:text-secondary-600" 
          aria-label="Close"
          @click="$emit('close')"
        >
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="createSession">
        <!-- Session Title -->
        <div>
          <label for="session-title" class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.title') }}
          </label>
          <input
            id="session-title"
            v-model="form.title"
            type="text"
            required
            class="input-field"
            :placeholder="$t('session.title')"
          >
        </div>

        <!-- Description -->
        <div>
          <label for="session-description" class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.description') }}
          </label>
          <textarea
            id="session-description"
            v-model="form.description"
            rows="3"
            class="input-field"
            :placeholder="$t('session.description')"
          />
        </div>

        <!-- Facilitator Name -->
        <div>
          <label for="facilitator-name" class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.yourName') }}
          </label>
          <input
            id="facilitator-name"
            v-model="form.facilitatorName"
            type="text"
            required
            class="input-field"
            :placeholder="$t('session.yourNamePlaceholder')"
          >
        </div>

        <!-- Max Votes -->
        <div>
          <label for="max-votes" class="block text-sm font-medium text-secondary-700 mb-2">
            {{ $t('session.maxVotes') }}
          </label>
          <input
            id="max-votes"
            v-model.number="form.maxVotes"
            type="number"
            min="1"
            max="10"
            required
            class="input-field"
          >
        </div>

        <!-- Anonymous Mode -->
        <div class="flex items-center">
          <input
            id="anonymous"
            v-model="form.isAnonymous"
            type="checkbox"
            class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          >
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
defineEmits(['close'])

const form = ref({
  title: '',
  description: '',
  facilitatorName: '',
  maxVotes: 3,
  isAnonymous: false,
})

const createSession = () => {
  // Ensure we're in a browser environment with localStorage
  if (typeof window === 'undefined' || !('localStorage' in window) || !window.localStorage) {
    console.error('localStorage is not available')
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Session storage is not available. Please check your browser settings.')
    }
    return
  }
  
  // Generate session ID using cryptographically secure random UUID
  // Using 8 characters for better uniqueness (16^8 ≈ 4.3 billion possible IDs)
  const sessionId = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
  
  try {
    // Generate facilitator ID
    const facilitatorId = crypto.randomUUID()
    
    // Store facilitator ID as the user's ID for this browser first
    // This ID persists across all sessions the user creates or joins
    try {
      localStorage.setItem('userId', facilitatorId)
    } catch (error) {
      console.error('Failed to store facilitator ID:', error)
      // Treat this as a hard failure - without userId, facilitator permissions will be lost
      if (typeof window.alert === 'function') {
        window.alert('Failed to create session. Please check your browser storage settings and try again.')
      }
      return
    }
    
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
    
    try {
      localStorage.setItem(`session-${sessionId}`, JSON.stringify(sessionData))
    } catch (error) {
      console.error('Failed to store session data:', error)
      // Clean up userId since session creation failed
      try {
        localStorage.removeItem('userId')
      } catch {
        // Ignore cleanup errors
      }
      if (typeof window.alert === 'function') {
        window.alert('Failed to create session. Please check your browser storage settings and try again.')
      }
      return
    }
    
    // Navigate to session with facilitator name
    navigateTo(`/session/${sessionId}?name=${encodeURIComponent(form.value.facilitatorName)}`)
  } catch (error) {
    console.error('Failed to create session:', error)
    // Clean up the session if it was created
    try {
      localStorage.removeItem(`session-${sessionId}`)
      localStorage.removeItem('userId')
    } catch {
      // Ignore cleanup errors
    }
    if (typeof window.alert === 'function') {
      window.alert('Failed to create session. Please check your browser settings and try again.')
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-secondary-50 p-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-card shadow-md p-4 mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold">{{ session?.title || 'Loading...' }}</h2>
            <p v-if="session?.description" class="text-secondary-600 text-sm mt-1">
              {{ session.description }}
            </p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Session Code -->
            <div class="text-right">
              <p class="text-xs text-secondary-600">Session Code</p>
              <p class="text-lg font-bold text-primary-600">{{ sessionId }}</p>
            </div>
            <!-- Leave Button -->
            <button @click="leaveSession" class="btn-secondary">
              {{ $t('common.leave') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Phase Indicator -->
      <div class="bg-white rounded-card shadow-md p-4 mb-6">
        <div class="flex justify-between items-center">
          <div class="flex space-x-4">
            <button
              v-for="phase in phases"
              :key="phase"
              @click="changePhase(phase)"
              :disabled="!isFacilitator"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors',
                currentPhase === phase
                  ? 'bg-primary-600 text-white'
                  : isFacilitator 
                    ? 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200' 
                    : 'bg-secondary-100 text-secondary-400 cursor-not-allowed'
              ]"
            >
              {{ $t(`retro.phases.${phase}`) }}
            </button>
          </div>
          <div class="text-sm text-secondary-600">
            <span v-if="votesRemaining !== null">
              {{ votesRemaining }} {{ $t('retro.votesRemaining') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Retro Board -->
      <div class="grid md:grid-cols-3 gap-6 mb-6">
        <!-- Positive Column -->
        <RetroColumn
          type="positive"
          :title="$t('retro.columns.positive')"
          :cards="positiveCards"
          :can-add="canAddCards"
          :can-vote="canVote"
          @add-card="addCard"
          @vote="toggleVote"
        />

        <!-- Improve Column -->
        <RetroColumn
          type="improve"
          :title="$t('retro.columns.improve')"
          :cards="improveCards"
          :can-add="canAddCards"
          :can-vote="canVote"
          @add-card="addCard"
          @vote="toggleVote"
        />

        <!-- Action Column -->
        <RetroColumn
          type="action"
          :title="$t('retro.columns.action')"
          :cards="actionCards"
          :can-add="canAddCards"
          :can-vote="canVote"
          @add-card="addCard"
          @vote="toggleVote"
        />
      </div>

      <!-- Participants Panel -->
      <div class="bg-white rounded-card shadow-md p-4">
        <h3 class="mb-4">{{ $t('participants.title') }} ({{ participants.length }})</h3>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="participant in participants"
            :key="participant.id"
            class="flex items-center space-x-2 bg-secondary-100 rounded-full px-3 py-1"
          >
            <div
              :class="[
                'w-2 h-2 rounded-full',
                participant.isOnline ? 'bg-success-500' : 'bg-secondary-400'
              ]"
            />
            <span class="text-sm">
              {{ participant.name }}
              <span v-if="participant.id === currentUserId" class="text-primary-600">
                ({{ $t('participants.you') }})
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RetroCard, RetroCardType, SessionPhase, RetroSession, Participant } from '~/types'

const route = useRoute()
const sessionId = route.params.id as string

// Session state
const session = ref<RetroSession | null>(null)
const currentPhase = ref<SessionPhase>('writing')
const currentUserId = ref<string>('')
const participants = ref<Participant[]>([])
const cards = ref<RetroCard[]>([])

// Load session data
onMounted(() => {
  loadSession()
})

const loadSession = () => {
  try {
    const sessionData = localStorage.getItem(`session-${sessionId}`)
    if (sessionData) {
      session.value = JSON.parse(sessionData)
      // Initialize currentPhase from the loaded session, if a phase was saved
      if (session.value && session.value.phase) {
        currentPhase.value = session.value.phase as SessionPhase
      }
    }
  } catch (error) {
    console.error('Failed to load session data:', error)
    session.value = null
  }
  
  // Generate or get user ID using crypto API
  let userId = ''
  try {
    userId = localStorage.getItem('userId') || ''
    if (!userId) {
      userId = crypto.randomUUID()
      localStorage.setItem('userId', userId)
    }
  } catch (error) {
    console.error('Failed to access localStorage, using temporary user ID:', error)
    userId = crypto.randomUUID()
  }
  currentUserId.value = userId
  
  // Load cards
  try {
    const cardsData = localStorage.getItem(`cards-${sessionId}`)
    if (cardsData) {
      cards.value = JSON.parse(cardsData)
    }
  } catch (error) {
    console.error('Failed to load cards:', error)
    cards.value = []
  }
  
  // Set session facilitator ID if this is a new session or legacy session without one,
  // and persist the updated session so the facilitator cannot be reassigned on next load.
  if (session.value && !session.value.facilitatorId) {
    session.value.facilitatorId = userId
    try {
      localStorage.setItem(`session-${sessionId}`, JSON.stringify(session.value))
    } catch (error) {
      console.error('Failed to persist updated session data:', error)
    }
  }
  
  // Add current user to participants with all required fields
  const userName = route.query.name as string || 'Anonymous'
  const isAnonymous = route.query.anonymous === 'true'
  
  // Determine if this user is the facilitator based on facilitatorId
  const isFacilitatorUser = session.value?.facilitatorId === userId
  
  participants.value = [{
    id: userId,
    name: isAnonymous ? 'Anonymous' : userName,
    role: isFacilitatorUser ? 'facilitator' : 'participant',
    isAnonymous: isAnonymous,
    sessionId: sessionId,
    joinedAt: new Date().toISOString(),
    isOnline: true,
  }]
}

// Phases
const phases: SessionPhase[] = ['writing', 'grouping', 'voting', 'discussion', 'completed']

// Check if current user is facilitator
const isFacilitator = computed(() => {
  if (!session.value) return false
  return session.value.facilitatorId === currentUserId.value
})

const changePhase = (phase: SessionPhase) => {
  // Only the facilitator can change the session phase
  if (!isFacilitator.value) return
  currentPhase.value = phase
  
  // Persist phase change to session
  if (session.value) {
    session.value.phase = phase
    try {
      localStorage.setItem(`session-${sessionId}`, JSON.stringify(session.value))
    } catch (error) {
      console.error('Failed to persist phase change:', error)
    }
  }
}

// Card filtering
const positiveCards = computed(() => cards.value.filter(c => c.type === 'positive'))
const improveCards = computed(() => cards.value.filter(c => c.type === 'improve'))
const actionCards = computed(() => cards.value.filter(c => c.type === 'action'))

// Permissions
const canAddCards = computed(() => currentPhase.value === 'writing')
const canVote = computed(() => currentPhase.value === 'voting')

// Votes - recalculated dynamically to prevent race conditions
const getVotesRemainingForCurrentUser = (): number => {
  // Support legacy sessions with maxVotes field
  const maxVotesPerUser = session.value?.maxVotesPerParticipant ?? (session.value as any)?.maxVotes ?? 3
  
  if (typeof maxVotesPerUser !== 'number' || maxVotesPerUser <= 0) {
    return 0
  }
  
  const userVotes = cards.value.reduce((count, c) => {
    return c.voterIds.includes(currentUserId.value) ? count + 1 : count
  }, 0)
  
  const remaining = maxVotesPerUser - userVotes
  return remaining > 0 ? remaining : 0
}

const votesRemaining = computed(() => {
  if (!canVote.value) return null
  return getVotesRemainingForCurrentUser()
})

// Actions
const addCard = (data: { type: RetroCardType, content: string }) => {
  const newCard: RetroCard = {
    id: crypto.randomUUID(),
    type: data.type,
    content: data.content,
    authorId: currentUserId.value,
    authorName: participants.value.find(p => p.id === currentUserId.value)?.name || 'Anonymous',
    votes: 0,
    voterIds: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  cards.value.push(newCard)
  saveCards()
}

const toggleVote = (cardId: string) => {
  const card = cards.value.find(c => c.id === cardId)
  if (!card) return
  
  const hasVoted = card.voterIds.includes(currentUserId.value)
  const votesRemainingForUser = getVotesRemainingForCurrentUser()
  
  if (hasVoted) {
    // Remove vote
    card.voterIds = card.voterIds.filter(id => id !== currentUserId.value)
    card.votes--
  } else {
    // Add vote - check votes remaining
    if (votesRemainingForUser > 0) {
      card.voterIds.push(currentUserId.value)
      card.votes++
    }
  }
  
  saveCards()
}

const saveCards = () => {
  try {
    localStorage.setItem(`cards-${sessionId}`, JSON.stringify(cards.value))
  } catch (error) {
    console.error('Failed to save cards to localStorage:', error)
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Your cards could not be saved. Please check your browser storage settings and try again.')
    }
  }
}

const leaveSession = () => {
  navigateTo('/')
}
</script>

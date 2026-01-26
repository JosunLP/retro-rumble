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
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors',
                currentPhase === phase
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
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
import type { RetroCard, RetroCardType, SessionPhase } from '~/types'

const route = useRoute()
const sessionId = route.params.id as string

// Session state
const session = ref<any>(null)
const currentPhase = ref<SessionPhase>('writing')
const currentUserId = ref<string>('')
const participants = ref<any[]>([])
const cards = ref<RetroCard[]>([])

// Load session data
onMounted(() => {
  loadSession()
})

const loadSession = () => {
  const sessionData = localStorage.getItem(`session-${sessionId}`)
  if (sessionData) {
    session.value = JSON.parse(sessionData)
  }
  
  // Generate or get user ID
  let userId = localStorage.getItem('userId')
  if (!userId) {
    userId = Math.random().toString(36).substring(2, 15)
    localStorage.setItem('userId', userId)
  }
  currentUserId.value = userId
  
  // Load cards
  const cardsData = localStorage.getItem(`cards-${sessionId}`)
  if (cardsData) {
    cards.value = JSON.parse(cardsData)
  }
  
  // Add current user to participants
  const userName = route.query.name as string || session.value?.facilitatorName || 'Anonymous'
  const isAnonymous = route.query.anonymous === 'true'
  
  participants.value = [{
    id: userId,
    name: isAnonymous ? 'Anonymous' : userName,
    isOnline: true,
  }]
}

// Phases
const phases: SessionPhase[] = ['writing', 'grouping', 'voting', 'discussion', 'completed']

const changePhase = (phase: SessionPhase) => {
  currentPhase.value = phase
}

// Card filtering
const positiveCards = computed(() => cards.value.filter(c => c.type === 'positive'))
const improveCards = computed(() => cards.value.filter(c => c.type === 'improve'))
const actionCards = computed(() => cards.value.filter(c => c.type === 'action'))

// Permissions
const canAddCards = computed(() => currentPhase.value === 'writing')
const canVote = computed(() => currentPhase.value === 'voting')

// Votes
const votesRemaining = computed(() => {
  if (!canVote.value) return null
  const maxVotes = session.value?.maxVotes || 3
  const usedVotes = cards.value.filter(c => c.voterIds?.includes(currentUserId.value)).length
  return maxVotes - usedVotes
})

// Actions
const addCard = (data: { type: RetroCardType, content: string }) => {
  const newCard: RetroCard = {
    id: Math.random().toString(36).substring(2, 15),
    type: data.type,
    content: data.content,
    authorId: currentUserId.value,
    authorName: participants.value.find(p => p.id === currentUserId.value)?.name || 'Anonymous',
    votes: 0,
    voterIds: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  cards.value.push(newCard)
  saveCards()
}

const toggleVote = (cardId: string) => {
  const card = cards.value.find(c => c.id === cardId)
  if (!card) return
  
  const hasVoted = card.voterIds.includes(currentUserId.value)
  
  if (hasVoted) {
    // Remove vote
    card.voterIds = card.voterIds.filter(id => id !== currentUserId.value)
    card.votes--
  } else {
    // Add vote
    if (votesRemaining.value && votesRemaining.value > 0) {
      card.voterIds.push(currentUserId.value)
      card.votes++
    }
  }
  
  saveCards()
}

const saveCards = () => {
  localStorage.setItem(`cards-${sessionId}`, JSON.stringify(cards.value))
}

const leaveSession = () => {
  navigateTo('/')
}
</script>

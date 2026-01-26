<template>
  <div class="bg-white rounded-card shadow-md p-4 h-full">
    <!-- Column Header -->
    <div class="flex justify-between items-center mb-4">
      <h3 :class="headerColorClass">{{ title }}</h3>
      <span class="text-sm text-secondary-600">{{ cards.length }}</span>
    </div>

    <!-- Add Card Button -->
    <button
      v-if="canAdd"
      @click="showAddForm = true"
      class="w-full btn-secondary mb-4 flex items-center justify-center space-x-2"
    >
      <Icon name="heroicons:plus" class="w-4 h-4" />
      <span>{{ $t('retro.addCard') }}</span>
    </button>

    <!-- Add Card Form -->
    <div v-if="showAddForm" class="mb-4 p-4 border-2 border-dashed rounded-lg" :class="borderColorClass">
      <textarea
        v-model="newCardContent"
        rows="3"
        class="input-field mb-2"
        :placeholder="$t('retro.cardPlaceholder')"
        autofocus
      />
      <div class="flex space-x-2">
        <button @click="submitCard" class="btn-primary flex-1">
          {{ $t('common.submit') }}
        </button>
        <button @click="cancelAdd" class="btn-secondary">
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>

    <!-- Cards List -->
    <div class="space-y-3 overflow-y-auto" style="max-height: 600px;">
      <div
        v-for="card in sortedCards"
        :key="card.id"
        class="retro-card"
        :class="cardColorClass"
      >
        <p class="text-sm mb-3">{{ card.content }}</p>
        
        <div class="flex justify-between items-center text-xs text-secondary-600">
          <span>{{ card.authorName }}</span>
          
          <!-- Vote Button -->
          <button
            v-if="canVote"
            @click="$emit('vote', card.id)"
            :class="[
              'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
              hasVoted(card) 
                ? 'bg-primary-600 text-white' 
                : 'bg-secondary-100 hover:bg-secondary-200 text-secondary-700'
            ]"
          >
            <Icon name="heroicons:heart-solid" class="w-4 h-4" />
            <span>{{ card.votes }}</span>
          </button>
          
          <!-- Vote Display (non-interactive) -->
          <div v-else class="flex items-center space-x-1">
            <Icon name="heroicons:heart-solid" class="w-4 h-4 text-error-500" />
            <span>{{ card.votes }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="cards.length === 0" class="text-center text-secondary-400 py-8">
        <Icon name="heroicons:inbox" class="w-12 h-12 mx-auto mb-2" />
        <p class="text-sm">{{ $t('retro.noCards') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RetroCard, RetroCardType } from '~/types'

interface Props {
  type: RetroCardType
  title: string
  cards: RetroCard[]
  canAdd: boolean
  canVote: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  addCard: [data: { type: RetroCardType, content: string }]
  vote: [cardId: string]
}>()

const showAddForm = ref(false)
const newCardContent = ref('')

// Computed styles based on card type
const headerColorClass = computed(() => {
  switch (props.type) {
    case 'positive': return 'text-positive-600'
    case 'improve': return 'text-warning-600'
    case 'action': return 'text-action-600'
    default: return 'text-secondary-900'
  }
})

const borderColorClass = computed(() => {
  switch (props.type) {
    case 'positive': return 'border-positive-300'
    case 'improve': return 'border-warning-300'
    case 'action': return 'border-action-300'
    default: return 'border-secondary-300'
  }
})

const cardColorClass = computed(() => {
  switch (props.type) {
    case 'positive': return 'border-l-4 border-positive-500'
    case 'improve': return 'border-l-4 border-warning-500'
    case 'action': return 'border-l-4 border-action-500'
    default: return 'border-l-4 border-secondary-500'
  }
})

// Sort cards by votes (descending)
const sortedCards = computed(() => {
  return [...props.cards].sort((a, b) => b.votes - a.votes)
})

// Check if current user has voted
const hasVoted = (card: RetroCard) => {
  const userId = localStorage.getItem('userId')
  return userId && card.voterIds?.includes(userId)
}

const submitCard = () => {
  if (!newCardContent.value.trim()) return
  
  emit('addCard', {
    type: props.type,
    content: newCardContent.value.trim(),
  })
  
  newCardContent.value = ''
  showAddForm.value = false
}

const cancelAdd = () => {
  newCardContent.value = ''
  showAddForm.value = false
}
</script>

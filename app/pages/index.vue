<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4">
    <div class="max-w-4xl w-full text-center">
      <!-- Header -->
      <div class="mb-12">
        <h1 class="text-gradient mb-4">
          {{ $t('app.name') }}
        </h1>
        <p class="text-secondary-600 text-xl">
          {{ $t('app.tagline') }}
        </p>
      </div>

      <!-- Action Cards -->
      <div class="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
        <!-- Create Session Card -->
        <div class="card hover:scale-105 transition-transform cursor-pointer" @click="showCreateModal = true">
          <Icon name="heroicons:plus-circle" class="w-16 h-16 mx-auto mb-4 text-primary-600" />
          <h3 class="mb-2">{{ $t('session.create') }}</h3>
          <p class="text-secondary-600">
            Start a new retrospective session
          </p>
        </div>

        <!-- Join Session Card -->
        <div class="card hover:scale-105 transition-transform cursor-pointer" @click="showJoinModal = true">
          <Icon name="heroicons:arrow-right-circle" class="w-16 h-16 mx-auto mb-4 text-accent-600" />
          <h3 class="mb-2">{{ $t('session.join') }}</h3>
          <p class="text-secondary-600">
            Join an existing session
          </p>
        </div>
      </div>

      <!-- Features -->
      <div class="mt-16 grid md:grid-cols-3 gap-6 text-left">
        <div class="flex items-start space-x-3">
          <Icon name="heroicons:shield-check" class="w-8 h-8 text-success-600 flex-shrink-0" />
          <div>
            <h4 class="mb-1">Secure</h4>
            <p class="text-sm text-secondary-600">End-to-end encrypted sessions</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <Icon name="heroicons:sparkles" class="w-8 h-8 text-primary-600 flex-shrink-0" />
          <div>
            <h4 class="mb-1">Simple</h4>
            <p class="text-sm text-secondary-600">No registration required</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <Icon name="heroicons:eye-slash" class="w-8 h-8 text-accent-600 flex-shrink-0" />
          <div>
            <h4 class="mb-1">Anonymous</h4>
            <p class="text-sm text-secondary-600">Optional anonymous participation</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Session Modal -->
    <CreateSessionModal v-if="showCreateModal" @close="showCreateModal = false" />

    <!-- Join Session Modal -->
    <JoinSessionModal v-if="showJoinModal" @close="showJoinModal = false" />
  </div>
</template>

<script setup lang="ts">
const showCreateModal = ref(false)
const showJoinModal = ref(false)
</script>

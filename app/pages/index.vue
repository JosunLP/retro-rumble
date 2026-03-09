<script setup lang="ts">
/**
 * Index Page
 *
 * Homepage of the Retro Rumble application.
 * Enables creating a new retro session or displays the active session.
 */

const { t } = useI18n();

/**
 * Retro session composable for state management
 */
const {
  session,
  currentParticipant,
  isHost,
  joinCode,
  error,
  connectionStatus,
  participantCount,
  remainingVotes,
  currentPhase,
  createSession,
  joinSession,
  changePhase,
  addCard,
  editCard,
  deleteCard,
  voteCard,
  unvoteCard,
  voteGroup,
  unvoteGroup,
  createGroup,
  addCardToGroup,
  removeCardFromGroup,
  renameGroup,
  moveGroup,
  deleteGroup,
  startTimer,
  stopTimer,
  setTimerDuration,
  leaveSession,
  addActionItem,
  editActionItem,
  deleteActionItem,
  toggleActionItem,
  submitCheckIn,
  submitFeedback,
  clearError,
  reconnect,
} = useRetroSession();

/**
 * Route for Join-Code from URL
 */
const route = useRoute();

/**
 * Join-Code from URL parameter
 */
const initialJoinCode = ref('');

onMounted(() => {
  const urlJoinCode = route.query.join as string;
  if (urlJoinCode) {
    initialJoinCode.value = urlJoinCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
  }
});

/**
 * SEO Meta Data
 */
useSeoMeta({
  title: t('app.name') + ' - ' + t('app.tagline'),
  description: t('app.tagline'),
});

/**
 * Handles creating a new session
 */
function handleCreateSession(
  sessionName: string,
  participantName: string,
  maxVotes: number,
  timerDuration: number
): void {
  createSession(sessionName, participantName, maxVotes, timerDuration);
}

/**
 * Handles joining a session
 */
function handleJoinSession(code: string, participantName: string): void {
  joinSession(code, participantName);
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header
      class="bg-white/80 backdrop-blur-sm border-b border-secondary-200 sticky top-0 z-50"
    >
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Icon
              name="heroicons:chat-bubble-bottom-center-text"
              class="w-8 h-8 text-primary-600"
            />
            <h1 class="text-xl font-bold text-secondary-800">
              {{ t('app.name') }}
            </h1>
            <div class="hidden sm:flex items-center gap-1.5 ml-4">
              <span
                class="w-2 h-2 rounded-full"
                :class="{
                  'bg-success-500': connectionStatus === 'connected',
                  'bg-warning-500 animate-pulse':
                    connectionStatus === 'connecting',
                  'bg-error-500': connectionStatus === 'error',
                  'bg-secondary-400': connectionStatus === 'disconnected',
                }"
              />
              <span class="text-xs text-secondary-500">
                {{
                  connectionStatus === 'connected'
                    ? t('connection.connected')
                    : connectionStatus === 'connecting'
                      ? t('connection.connecting')
                      : connectionStatus === 'error'
                        ? t('connection.error')
                        : t('connection.disconnected')
                }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <LanguageSwitcher />
            <div v-if="session" class="text-sm text-secondary-600">
              {{ t('session.info.sessionLabel') }}
              <span class="font-medium">{{ session.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Error Banner -->
    <Transition name="slide-up">
      <div v-if="error" class="bg-error-50 border-b border-error-200 px-4 py-3">
        <div class="container mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2 text-error-700">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5" />
            <span class="text-sm">{{ error }}</span>
          </div>
          <button
            type="button"
            class="text-error-500 hover:text-error-700"
            @click="clearError"
          >
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8 flex-1">
      <!-- No session active - display form -->
      <div v-if="!session" class="py-12">
        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-secondary-800 mb-2">
            {{ t('home.welcome') }}
          </h2>
          <p class="text-secondary-600">
            {{ t('home.subtitle') }}
          </p>
        </div>

        <CreateJoinForm
          :initial-join-code="initialJoinCode"
          @create="handleCreateSession"
          @join="handleJoinSession"
        />
      </div>

      <!-- Session active -->
      <div v-else class="space-y-6">
        <!-- Top Bar: Phase + Controls -->
        <div class="grid lg:grid-cols-12 gap-4">
          <div class="lg:col-span-8">
            <PhaseIndicator
              :current-phase="currentPhase"
              :is-host="isHost"
              @change-phase="changePhase"
            />
          </div>
          <div class="lg:col-span-4">
            <div class="grid grid-cols-2 gap-4 h-full">
              <!-- Vote Info (voting phase) -->
              <div
                v-if="currentPhase === 'voting'"
                class="card-container flex flex-col items-center justify-center"
              >
                <div class="text-2xl font-bold text-primary-700">
                  {{ remainingVotes }}
                </div>
                <div class="text-xs text-secondary-500">
                  {{ t('voting.remaining') }}
                </div>
              </div>
              <div v-else class="hidden lg:block" />

              <!-- Timer -->
              <TimerControl
                :duration="session.timerDuration"
                :remaining="session.timerRemaining"
                :running="session.timerRunning"
                :is-host="isHost"
                @start="startTimer"
                @stop="stopTimer"
                @set-duration="setTimerDuration"
              />
            </div>
          </div>
        </div>

        <!-- Main Board Area -->
        <div class="grid lg:grid-cols-12 gap-4">
          <!-- Sidebar -->
          <div class="lg:col-span-3 space-y-4">
            <SessionInfo
              :session-name="session.name"
              :join-code="joinCode!"
              :participant-count="participantCount"
              @leave="leaveSession"
            />
            <ParticipantList
              :participants="session.participants"
              :current-user-id="currentParticipant?.id"
            />
          </div>

          <!-- Retro Board / Grouping Board / Summary -->
          <div class="lg:col-span-9">
            <!-- Set the Stage: Check-in widget -->
            <CheckInWidget
              v-if="currentPhase === 'set-the-stage'"
              :check-in-responses="session.checkInResponses ?? []"
              :participants="session.participants"
              :current-user-id="currentParticipant!.id"
              @submit="submitCheckIn"
            />

            <!-- Close Retro: Summary, feedback & export -->
            <div v-else-if="currentPhase === 'close-retro'" class="space-y-6">
              <FeedbackWidget
                :feedback-responses="session.feedbackResponses ?? []"
                :participants="session.participants"
                :current-user-id="currentParticipant!.id"
                @submit="submitFeedback"
              />
              <RetroSummary
                :session="session"
                :is-host="isHost"
                @add-action-item="addActionItem"
                @edit-action-item="editActionItem"
                @delete-action-item="deleteActionItem"
                @toggle-action-item="toggleActionItem"
              />
              <ExportPanel :session="session" />
            </div>

            <!-- Discuss Topics: Read-only board before clustering -->
            <RetroBoard
              v-else-if="currentPhase === 'discuss-topics'"
              :session="session"
              :current-user-id="currentParticipant!.id"
              :is-host="isHost"
              :remaining-votes="remainingVotes"
              @add-card="addCard"
              @edit-card="editCard"
              @delete-card="deleteCard"
              @vote-card="voteCard"
              @unvote-card="unvoteCard"
            />

            <!-- Clustering: group cards, no renaming here -->
            <ClusterCanvas
              v-else-if="currentPhase === 'cluster-cards'"
              :session="session"
              :current-user-id="currentParticipant!.id"
              mode="cluster"
              @create-group="createGroup"
              @add-card-to-group="addCardToGroup"
              @remove-card-from-group="removeCardFromGroup"
              @rename-group="renameGroup"
              @move-group="moveGroup"
              @delete-group="deleteGroup"
            />

            <!-- Naming: rename existing groups without drag interactions -->
            <ClusterCanvas
              v-else-if="currentPhase === 'name-groups'"
              :session="session"
              :current-user-id="currentParticipant!.id"
              mode="name"
              @create-group="createGroup"
              @add-card-to-group="addCardToGroup"
              @remove-card-from-group="removeCardFromGroup"
              @rename-group="renameGroup"
              @move-group="moveGroup"
              @delete-group="deleteGroup"
            />

            <!-- Voting: Dedicated voting phase for groups -->
            <VotingBoard
              v-else-if="currentPhase === 'voting'"
              :session="session"
              :remaining-votes="remainingVotes"
              :current-user-id="currentParticipant!.id"
              @vote-card="voteCard"
              @unvote-card="unvoteCard"
              @vote-group="voteGroup"
              @unvote-group="unvoteGroup"
            />

            <!-- Decide Action: Action items with voted card overview -->
            <div v-else-if="currentPhase === 'decide-action'" class="space-y-6">
              <RetroSummary
                :session="session"
                :is-host="isHost"
                @add-action-item="addActionItem"
                @edit-action-item="editActionItem"
                @delete-action-item="deleteActionItem"
                @toggle-action-item="toggleActionItem"
              />
            </div>

            <!-- Gather Data: Standard retro board -->
            <RetroBoard
              v-else
              :session="session"
              :current-user-id="currentParticipant!.id"
              :is-host="isHost"
              :remaining-votes="remainingVotes"
              @add-card="addCard"
              @edit-card="editCard"
              @delete-card="deleteCard"
              @vote-card="voteCard"
              @unvote-card="unvoteCard"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- Reconnection Overlay — shown when the WS drops during an active session -->
    <ReconnectingOverlay
      :status="connectionStatus"
      :has-session="!!session"
      @reconnect="reconnect"
    />

    <!-- Footer -->
    <footer class="mt-auto py-6 text-center text-sm text-secondary-500">
      <p>
        {{ t('app.name') }} -
        <Icon
          name="heroicons:heart-solid"
          class="w-4 h-4 inline text-error-500"
        />
        Nuxt 4
      </p>
    </footer>
  </div>
</template>

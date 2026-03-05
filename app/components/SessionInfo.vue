<script setup lang="ts">
/**
 * SessionInfo Component
 *
 * Displays session information, join code, and participant count.
 * Provides copy-to-clipboard for join code, share URL, and leave confirmation.
 */

const { t } = useI18n();

interface Props {
  /** Session name */
  sessionName: string;
  /** Join code for sharing */
  joinCode: string;
  /** Number of participants */
  participantCount: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  leave: [];
}>();

const copied = ref(false);
const copiedLink = ref(false);
const showLeaveConfirm = ref(false);

/**
 * Copies the join code to clipboard
 */
/** Clipboard error fallback message */
const clipboardError = ref(false);

async function copyJoinCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    console.warn('[SessionInfo] Clipboard API not available for join code');
    clipboardError.value = true;
    setTimeout(() => { clipboardError.value = false; }, 3000);
  }
}

/**
 * Copies a direct session link (URL with ?join=CODE) to clipboard
 */
async function copySessionLink(): Promise<void> {
  try {
    const url = `${window.location.origin}${window.location.pathname}?join=${props.joinCode}`;
    await navigator.clipboard.writeText(url);
    copiedLink.value = true;
    setTimeout(() => { copiedLink.value = false; }, 2000);
  } catch {
    console.warn('[SessionInfo] Clipboard API not available for session link');
    clipboardError.value = true;
    setTimeout(() => { clipboardError.value = false; }, 3000);
  }
}

/** Confirms and performs the leave action */
function confirmLeave(): void {
  showLeaveConfirm.value = false;
  emit('leave');
}
</script>

<template>
  <div class="card-container">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-semibold text-secondary-800 truncate mr-2">
        {{ sessionName }}
      </h3>
      <button
        type="button"
        class="text-sm text-error-600 hover:text-error-700 transition-colors flex-shrink-0"
        :aria-label="t('ui.leaveSession', 'Leave session')"
        :title="t('ui.leaveSession', 'Leave session')"
        @click="showLeaveConfirm = true"
      >
        <Icon name="heroicons:arrow-right-on-rectangle" class="w-5 h-5" />
      </button>
    </div>

    <!-- Leave Confirmation Dialog -->
    <Transition name="fade">
      <div
        v-if="showLeaveConfirm"
        class="mb-3 p-3 bg-error-50 border border-error-200 rounded-lg text-sm"
      >
        <p class="text-error-700 mb-2">{{ t('ui.leaveConfirm') }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-sm btn-error flex-1"
            @click="confirmLeave"
          >
            <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4 mr-1" />
            {{ t('ui.leaveSession', 'Leave') }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-secondary flex-1"
            @click="showLeaveConfirm = false"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Join Code -->
    <div class="mb-3">
      <p class="text-xs text-secondary-500 mb-1">
        {{ t('session.joinCode') }}
      </p>
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-1.5 bg-secondary-100 rounded-lg hover:bg-secondary-200 transition-colors w-full"
        :aria-label="t('session.joinCode')"
        @click="copyJoinCode(joinCode)"
      >
        <span
          class="font-mono font-bold text-lg tracking-widest text-primary-700"
        >
          {{ joinCode }}
        </span>
        <Icon
          :name="copied ? 'heroicons:check' : 'heroicons:clipboard-document'"
          class="w-4 h-4 text-secondary-500 ml-auto"
          :class="copied ? 'text-success-500' : ''"
        />
      </button>

      <!-- Share link button -->
      <button
        type="button"
        class="mt-1.5 flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 transition-colors"
        @click="copySessionLink"
      >
        <Icon
          :name="copiedLink ? 'heroicons:check-circle' : 'heroicons:link'"
          class="w-3.5 h-3.5"
        />
        {{ copiedLink ? t('ui.shareLinkCopied') : t('ui.shareLink') }}
      </button>
    </div>

    <!-- Clipboard Error Message -->
    <Transition name="fade">
      <p
        v-if="clipboardError"
        class="text-xs text-error-600 mt-1"
        role="alert"
      >
        {{ t('errors.clipboardFailed') }}
      </p>
    </Transition>

    <!-- Participant Count -->
    <div class="flex items-center gap-2 text-sm text-secondary-600">
      <Icon name="heroicons:users" class="w-4 h-4" />
      <span>{{ participantCount }} {{ t('session.participants') }}</span>
    </div>
  </div>
</template>

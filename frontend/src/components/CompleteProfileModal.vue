<script setup>
import { ref } from 'vue'
import { X, User, Phone, MapPin, CheckCircle } from 'lucide-vue-next'
import { useUserProfile } from '@/composables/useUserProfile'
import { useAuth } from '@/composables/useAuth'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'completed'])

const { user } = useAuth()
const { updateUserProfile } = useUserProfile()

const isSaving = ref(false)
const errorMessage = ref('')

const form = ref({
  full_name: '',
  telefono: '',
  ciudad: '',
  zona_trabajo: ''
})

async function handleSubmit() {
  // Validar que al menos tenga nombre
  if (!form.value.full_name?.trim()) {
    errorMessage.value = 'El nombre completo es obligatorio'
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  const result = await updateUserProfile(user.value.id, form.value)

  if (result.success) {
    emit('completed', result.profile)
    emit('close')
  } else {
    errorMessage.value = result.error || 'Error al guardar el perfil'
  }

  isSaving.value = false
}

function handleSkip() {
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleSkip">
      <div class="modal-container" @click.stop>
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <div class="icon-container">
              <User :size="32" />
            </div>
            <div>
              <h2 class="modal-title">¡Completa tu perfil!</h2>
              <p class="modal-subtitle">Ayúdanos a personalizar tu experiencia</p>
            </div>
          </div>
          <button @click="handleSkip" class="close-button" :disabled="isSaving">
            <X :size="20" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label for="modalFullName" class="form-label">
              <User :size="16" />
              Nombre Completo *
            </label>
            <input
              id="modalFullName"
              v-model="form.full_name"
              type="text"
              placeholder="Tu nombre completo"
              class="form-input"
              :disabled="isSaving"
              required
            />
          </div>

          <div class="form-group">
            <label for="modalPhone" class="form-label">
              <Phone :size="16" />
              Teléfono (opcional)
            </label>
            <input
              id="modalPhone"
              v-model="form.telefono"
              type="tel"
              placeholder="(123) 456-7890"
              class="form-input"
              :disabled="isSaving"
            />
          </div>

          <div class="form-group">
            <label for="modalCity" class="form-label">
              <MapPin :size="16" />
              Ciudad (opcional)
            </label>
            <input
              id="modalCity"
              v-model="form.ciudad"
              type="text"
              placeholder="Tu ciudad"
              class="form-input"
              :disabled="isSaving"
            />
          </div>

          <div class="form-group">
            <label for="modalWorkZone" class="form-label">
              <MapPin :size="16" />
              Zona de Trabajo (opcional)
            </label>
            <input
              id="modalWorkZone"
              v-model="form.zona_trabajo"
              type="text"
              placeholder="Ej: Downtown, North Side"
              class="form-input"
              :disabled="isSaving"
            />
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button 
              type="button"
              @click="handleSkip" 
              class="skip-button"
              :disabled="isSaving"
            >
              Saltar por ahora
            </button>
            <button 
              type="submit" 
              class="save-button"
              :disabled="isSaving"
            >
              <CheckCircle :size="18" />
              {{ isSaving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: var(--z-modal);
  backdrop-filter: blur(4px);
}

.modal-container {
  background-color: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s var(--ease-out);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-primary);
}

.header-content {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.icon-container {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.modal-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.modal-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.close-button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-base);
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-button:hover:not(:disabled) {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Form */
.modal-form {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: var(--error);
  font-size: var(--text-sm);
  padding: var(--space-3);
  background-color: var(--error-bg);
  border-radius: var(--radius-base);
  border: 1px solid #fca5a5;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.skip-button,
.save-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.skip-button {
  color: var(--text-secondary);
  background-color: transparent;
  border: 1px solid var(--border-primary);
}

.skip-button:hover:not(:disabled) {
  background-color: var(--bg-primary);
  border-color: var(--text-secondary);
}

.save-button {
  color: white;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
}

.save-button:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.skip-button:disabled,
.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s var(--ease-out);
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9) translateY(20px);
}

/* Responsive */
@media (max-width: 768px) {
  .modal-container {
    max-height: 95vh;
  }

  .modal-header {
    padding: var(--space-4);
  }

  .header-content {
    gap: var(--space-3);
  }

  .icon-container {
    width: 48px;
    height: 48px;
  }

  .modal-title {
    font-size: var(--text-xl);
  }

  .modal-form {
    padding: var(--space-4);
  }

  .modal-actions {
    flex-direction: column;
  }
}
</style>
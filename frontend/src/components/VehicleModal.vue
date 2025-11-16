<script setup>
import { ref, watch } from 'vue'
import { Car, X, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  vehicle: {
    type: Object,
    default: null // null = crear nuevo, objeto = editar existente
  }
})

const emit = defineEmits(['close', 'save'])

// Form data
const formData = ref({
  nickname: '',
  make: '',
  model: '',
  year: null,
  is_primary: false
})

const error = ref(null)
const isSaving = ref(false)

// Resetear form cuando se abre el modal
watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.vehicle) {
      // Modo edición: cargar datos existentes
      formData.value = {
        nickname: props.vehicle.nickname || '',
        make: props.vehicle.make || '',
        model: props.vehicle.model || '',
        year: props.vehicle.year || null,
        is_primary: props.vehicle.is_primary || false
      }
    } else {
      // Modo creación: limpiar form
      formData.value = {
        nickname: '',
        make: '',
        model: '',
        year: null,
        is_primary: false
      }
    }
    error.value = null
  }
})

function closeModal() {
  emit('close')
}

function handleSave() {
  // Validación
  if (!formData.value.nickname || formData.value.nickname.trim().length === 0) {
    error.value = 'El apodo del vehículo es obligatorio'
    return
  }

  // Validar año si se proporcionó
  if (formData.value.year) {
    const currentYear = new Date().getFullYear()
    if (formData.value.year < 1900 || formData.value.year > currentYear + 1) {
      error.value = `El año debe estar entre 1900 y ${currentYear + 1}`
      return
    }
  }

  error.value = null
  isSaving.value = true
  
  emit('save', formData.value)
  
  // El padre maneja el loading, pero reseteamos el estado local
  setTimeout(() => {
    isSaving.value = false
  }, 2000)
}

// Cerrar con ESC
function handleKeydown(e) {
  if (e.key === 'Escape' && props.show && !isSaving.value) {
    closeModal()
  }
}

// Listener global para ESC
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title-group">
            <Car :size="24" class="modal-icon" />
            <h2 class="modal-title">
              {{ vehicle ? 'Editar Vehículo' : 'Agregar Vehículo' }}
            </h2>
          </div>
          <button 
            @click="closeModal" 
            class="close-button"
            :disabled="isSaving"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <form @submit.prevent="handleSave" class="vehicle-form">
            
            <!-- Nickname (Obligatorio) -->
            <div class="input-group">
              <label for="nickname" class="input-label">
                Apodo del Vehículo <span class="required">*</span>
              </label>
              <input
                id="nickname"
                v-model="formData.nickname"
                type="text"
                placeholder="Ej: Mi Kia Rojo, Trax de Trabajo..."
                class="modal-input"
                :disabled="isSaving"
                maxlength="50"
                required
              />
              <span class="input-hint">Cómo identificarás este vehículo</span>
            </div>

            <!-- Make (Opcional) -->
            <div class="input-group">
              <label for="make" class="input-label">Marca</label>
              <input
                id="make"
                v-model="formData.make"
                type="text"
                placeholder="Ej: Kia, Chevrolet, Pontiac..."
                class="modal-input"
                :disabled="isSaving"
                maxlength="30"
              />
            </div>

            <!-- Model (Opcional) -->
            <div class="input-group">
              <label for="model" class="input-label">Modelo</label>
              <input
                id="model"
                v-model="formData.model"
                type="text"
                placeholder="Ej: Soul, Trax, G6..."
                class="modal-input"
                :disabled="isSaving"
                maxlength="30"
              />
            </div>

            <!-- Year (Opcional) -->
            <div class="input-group">
              <label for="year" class="input-label">Año</label>
              <input
                id="year"
                v-model.number="formData.year"
                type="number"
                placeholder="Ej: 2018"
                class="modal-input"
                :disabled="isSaving"
                min="1900"
                :max="new Date().getFullYear() + 1"
              />
            </div>

            <!-- Is Primary (Solo si hay otros vehículos) -->
            <div class="input-group checkbox-group">
              <label class="checkbox-label">
                <input
                  v-model="formData.is_primary"
                  type="checkbox"
                  class="modal-checkbox"
                  :disabled="isSaving"
                />
                <span>Marcar como vehículo principal</span>
              </label>
              <span class="input-hint">
                El vehículo principal se selecciona por defecto al registrar rutas
              </span>
            </div>

            <!-- Error Banner -->
            <div v-if="error" class="error-banner">
              <AlertCircle :size="16" />
              <span>{{ error }}</span>
            </div>

            <!-- Buttons -->
            <div class="modal-actions">
              <button
                type="button"
                @click="closeModal"
                class="btn-secondary"
                :disabled="isSaving"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn-primary"
                :disabled="isSaving"
              >
                {{ isSaving ? 'Guardando...' : (vehicle ? 'Guardar Cambios' : 'Agregar Vehículo') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ==================== MODAL OVERLAY ==================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.modal-container {
  background-color: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ==================== HEADER ==================== */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-primary);
  position: sticky;
  top: 0;
  background-color: var(--bg-elevated);
  z-index: 10;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.modal-icon {
  color: var(--brand-primary);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.close-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s var(--ease-out);
}

.close-button:hover:not(:disabled) {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== BODY ==================== */
.modal-body {
  padding: var(--space-6);
}

.vehicle-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ==================== INPUTS ==================== */
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.required {
  color: var(--error);
}

.modal-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.modal-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.modal-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-style: italic;
}

/* ==================== CHECKBOX ==================== */
.checkbox-group {
  padding: var(--space-4);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-base);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  font-size: var(--text-base);
  color: var(--text-primary);
}

.modal-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--brand-primary);
}

/* ==================== ERROR ==================== */
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background-color: var(--error-bg);
  color: var(--error);
  border-radius: var(--radius-base);
  font-size: var(--text-sm);
}

/* ==================== ACTIONS ==================== */
.modal-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.btn-secondary,
.btn-primary {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-secondary {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--bg-tertiary);
}

.btn-primary {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary:disabled,
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ==================== TRANSITIONS ==================== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s var(--ease-out);
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(20px);
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .modal-container {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header,
  .modal-body {
    padding: var(--space-4);
  }
}
</style>
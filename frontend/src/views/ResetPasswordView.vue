<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { Lock, AlertCircle, CheckCircle } from 'lucide-vue-next'

const router = useRouter()
const { updatePassword } = useAuth()

const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const error = ref(null)
const success = ref(false)
const isValidToken = ref(false)

onMounted(() => {
  // Verificar si hay un hash en la URL (token de Supabase)
  const hash = window.location.hash
  if (hash && hash.includes('type=recovery')) {
    isValidToken.value = true
  } else {
    error.value = 'Link de recuperación inválido o expirado'
  }
})

async function handleSubmit() {
  // Validaciones
  if (!newPassword.value || !confirmPassword.value) {
    error.value = 'Por favor completa todos los campos'
    return
  }

  if (newPassword.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  
  error.value = null
  isLoading.value = true
  
  const result = await updatePassword(newPassword.value)
  isLoading.value = false
  
  if (result.success) {
    success.value = true
    // Redirigir al login después de 3 segundos
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  } else {
    error.value = result.error
  }
}
</script>

<template>
  <div class="reset-container">
    <div class="reset-card">
      <div class="reset-header">
        <div class="logo-container">
          <Lock :size="48" class="logo-icon" />
        </div>
        <h1 class="reset-title">Restablecer Contraseña</h1>
        <p class="reset-subtitle">Ingresa tu nueva contraseña</p>
      </div>

      <form v-if="isValidToken && !success" @submit.prevent="handleSubmit" class="reset-form">
        <div class="input-group">
          <label for="newPassword" class="input-label">
            <Lock :size="16" />
            Nueva Contraseña
          </label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            placeholder="Mínimo 6 caracteres"
            class="reset-input"
            :disabled="isLoading"
            required
          />
        </div>

        <div class="input-group">
          <label for="confirmPassword" class="input-label">
            <Lock :size="16" />
            Confirmar Contraseña
          </label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="Repite tu contraseña"
            class="reset-input"
            :disabled="isLoading"
            required
          />
        </div>

        <div v-if="error" class="error-banner">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>

        <button type="submit" class="reset-button" :disabled="isLoading">
          {{ isLoading ? 'Actualizando...' : 'Restablecer Contraseña' }}
        </button>
      </form>

      <div v-else-if="!isValidToken" class="error-state">
        <AlertCircle :size="48" class="error-icon" />
        <h2>Link Inválido</h2>
        <p>{{ error }}</p>
        <button @click="router.push('/forgot-password')" class="retry-button">
          Solicitar Nuevo Link
        </button>
      </div>

      <div v-else-if="success" class="success-message">
        <CheckCircle :size="48" class="success-icon" />
        <h2>¡Contraseña Actualizada!</h2>
        <p>Tu contraseña ha sido restablecida exitosamente.</p>
        <p class="redirect-text">Redirigiendo al login...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.reset-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-8);
}

.reset-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.logo-container {
  display: inline-flex;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border-radius: var(--radius-full);
  margin-bottom: var(--space-4);
  align-items: center;
  justify-content: center;
}

.logo-icon {
  color: white;
}

.reset-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.reset-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.reset-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
}

.reset-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

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

.reset-button {
  width: 100%;
  padding: var(--space-4);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: white;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: opacity 0.2s;
}

.reset-button:hover:not(:disabled) {
  opacity: 0.9;
}

.reset-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-state {
  text-align: center;
  padding: var(--space-6) 0;
}

.error-icon {
  color: var(--error);
  margin-bottom: var(--space-4);
}

.error-state h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3) 0;
}

.error-state p {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-6) 0;
}

.retry-button {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: white;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: opacity 0.2s;
}

.retry-button:hover {
  opacity: 0.9;
}

.success-message {
  text-align: center;
  padding: var(--space-6) 0;
}

.success-icon {
  color: var(--success);
  margin-bottom: var(--space-4);
}

.success-message h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3) 0;
}

.success-message p {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-2) 0;
}

.redirect-text {
  font-size: var(--text-sm);
  color: var(--brand-primary);
  font-style: italic;
}
</style>
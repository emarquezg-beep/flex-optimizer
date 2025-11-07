<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { KeyRound, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
const { requestPasswordReset } = useAuth()

const email = ref('')
const isLoading = ref(false)
const error = ref(null)
const success = ref(false)

async function handleSubmit() {
  if (!email.value) {
    error.value = 'Por favor ingresa tu email'
    return
  }
  
  error.value = null
  isLoading.value = true
  
  const result = await requestPasswordReset(email.value)
  isLoading.value = false
  
  if (result.success) {
    success.value = true
  } else {
    error.value = result.error
  }
}

function goBack() {
  router.push('/login')
}
</script>

<template>
  <div class="forgot-container">
    <div class="forgot-card">
      <div class="forgot-header">
        <div class="logo-container">
          <KeyRound :size="48" class="logo-icon" />
        </div>
        <h1 class="forgot-title">Recuperar Contraseña</h1>
        <p class="forgot-subtitle">
          Ingresa tu email y te enviaremos un link para restablecer tu contraseña
        </p>
      </div>

      <form v-if="!success" @submit.prevent="handleSubmit" class="forgot-form">
        <div class="input-group">
          <label for="email" class="input-label">
            <Mail :size="16" />
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="tu@email.com"
            class="forgot-input"
            :disabled="isLoading"
            required
          />
        </div>

        <div v-if="error" class="error-banner">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>

        <button type="submit" class="forgot-button" :disabled="isLoading">
          {{ isLoading ? 'Enviando...' : 'Enviar Link de Recuperación' }}
        </button>

        <button type="button" @click="goBack" class="back-button">
          <ArrowLeft :size="16" />
          Volver al Login
        </button>
      </form>

      <div v-else class="success-message">
        <CheckCircle :size="48" class="success-icon" />
        <h2>¡Email Enviado!</h2>
        <p>
          Hemos enviado un link de recuperación a <strong>{{ email }}</strong>
        </p>
        <p class="info-text">
          Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
        </p>
        <p class="info-text small">
          Si no recibes el email en unos minutos, revisa tu carpeta de spam.
        </p>
        
        <button @click="goBack" class="back-button-success">
          <ArrowLeft :size="16" />
          Volver al Login
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.forgot-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-8);
}

.forgot-header {
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

.forgot-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.forgot-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.forgot-form {
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

.forgot-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
}

.forgot-input:focus {
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

.forgot-button {
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

.forgot-button:hover:not(:disabled) {
  opacity: 0.9;
}

.forgot-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  color: var(--text-primary);
  border-color: var(--brand-primary);
}

.success-message {
  text-align: center;
  padding: var(--space-4) 0;
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
  margin: 0 0 var(--space-3) 0;
  line-height: 1.5;
}

.info-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: var(--space-2) 0;
}

.info-text.small {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.back-button-success {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-6);
  padding: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--brand-primary);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s;
}

.back-button-success:hover {
  background: var(--brand-primary);
  color: white;
}
</style>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { UserPlus, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-vue-next'


const router = useRouter()
const { register } = useAuth()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const error = ref(null)
const success = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

async function handleRegister() {
  // Validaciones
  if (!email.value || !password.value || !confirmPassword.value) {
    error.value = 'Por favor completa todos los campos'
    return
  }

  if (password.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  
  error.value = null
  isLoading.value = true
  
  const result = await register(email.value, password.value)
  isLoading.value = false
  
  if (result.success) {
    success.value = true
    // Redirigir al login después de 2 segundos
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } else {
    error.value = result.error
  }
}
</script>

<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <div class="logo-container">
          <UserPlus :size="48" class="logo-icon" />
        </div>
        <h1 class="register-title">Crear Cuenta</h1>
        <p class="register-subtitle">Regístrate en Flex Optimizer</p>
      </div>

      <form v-if="!success" @submit.prevent="handleRegister" class="register-form">
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
            class="register-input"
            :disabled="isLoading"
            required
          />
        </div>

        <div class="input-group">
        <label for="password" class="input-label">
            <Lock :size="16" />
            Contraseña
        </label>
        <div class="password-input-wrapper">
            <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Mínimo 6 caracteres"
            class="register-input"
            :disabled="isLoading"
            required
            />
        <button
        type="button"
        @click="showPassword = !showPassword"
        class="toggle-password"
        :disabled="isLoading"
        >
        <EyeOff v-if="showPassword" :size="20" />
        <Eye v-else :size="20" />
        </button>
        </div>
        </div>

        <div class="input-group">
        <label for="confirmPassword" class="input-label">
            <Lock :size="16" />
            Confirmar Contraseña
        </label>
        <div class="password-input-wrapper">
            <input
            id="confirmPassword"
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Repite tu contraseña"
            class="register-input"
            :disabled="isLoading"
            required
            />
        <button
        type="button"
        @click="showConfirmPassword = !showConfirmPassword"
        class="toggle-password"
        :disabled="isLoading"
        >
        <EyeOff v-if="showConfirmPassword" :size="20" />
        <Eye v-else :size="20" />
        </button>
        </div>
        </div>

        <div v-if="error" class="error-banner">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>

        <button type="submit" class="register-button" :disabled="isLoading">
          {{ isLoading ? 'Registrando...' : 'Crear Cuenta' }}
        </button>

        <div class="register-links">
          <router-link to="/login" class="link-text">
            ¿Ya tienes cuenta? Inicia sesión
          </router-link>
        </div>
      </form>

      <div v-else class="success-message">
        <CheckCircle :size="48" class="success-icon" />
        <h2>¡Registro Exitoso!</h2>
        <p>Tu cuenta ha sido creada correctamente.</p>
        <p class="redirect-text">Redirigiendo al login...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-8);
}

.register-header {
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

.register-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.register-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

.register-form {
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

.register-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
}

.register-input:focus {
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

.register-button {
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

.register-button:hover:not(:disabled) {
  opacity: 0.9;
}

.register-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.register-links {
  text-align: center;
  margin-top: var(--space-2);
}

.link-text {
  font-size: var(--text-sm);
  color: var(--brand-primary);
  text-decoration: none;
  transition: color 0.2s;
}

.link-text:hover {
  color: var(--brand-accent);
  text-decoration: underline;
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

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper .register-input {
  padding-right: var(--space-12);
}

.toggle-password {
  position: absolute;
  right: var(--space-3);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  padding: var(--space-2);
  transition: color 0.2s;
}

.toggle-password:hover:not(:disabled) {
  color: var(--text-primary);
}

.toggle-password:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
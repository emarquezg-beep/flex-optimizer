<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const { login } = useAuth()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref(null)

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Por favor completa todos los campos'
    return
  }
  
  error.value = null
  isLoading.value = true
  
  const result = await login(email.value, password.value)
  isLoading.value = false
  
  if (result.success) {
    router.push('/')
  } else {
    error.value = result.error
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo-container">
          <LogIn :size="48" class="logo-icon" />
        </div>
        <h1 class="login-title">Flex Optimizer</h1>
        <p class="login-subtitle">Inicia sesión para continuar</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
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
            class="login-input"
            :disabled="isLoading"
          />
        </div>

        <div class="input-group">
          <label for="password" class="input-label">
            <Lock :size="16" />
            Contraseña
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="login-input"
            :disabled="isLoading"
          />
        </div>

        <div v-if="error" class="error-banner">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>

        <button type="submit" class="login-button" :disabled="isLoading">
          {{ isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
        </button>
        <div class="login-links">
          <router-link to="/register" class="link-text">
            ¿No tienes cuenta? Regístrate
          </router-link>
          <router-link to="/forgot-password" class="link-text">
            ¿Olvidaste tu contraseña?
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-8);
}

.login-header {
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

.login-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.login-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

.login-form {
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

.login-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
}

.login-input:focus {
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

.login-button {
  width: 100%;
  padding: var(--space-4);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: white;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.login-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
  text-align: center;
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
</style>

// Forzando nuevo commit 
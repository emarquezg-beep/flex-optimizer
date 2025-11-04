<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { LogOut, User, Mail } from 'lucide-vue-next'

const router = useRouter()
const { logout, user, userName } = useAuth()
const isLoggingOut = ref(false)

async function handleLogout() {
  isLoggingOut.value = true
  const result = await logout()
  
  if (result.success) {
    router.push('/login')
  } else {
    alert('Error al cerrar sesión')
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="view-container">
    <div class="settings-header">
      <h1 class="settings-title">⚙️ Configuración</h1>
      <p class="settings-subtitle">Gestiona tu cuenta y preferencias</p>
    </div>

    <div class="settings-section">
      <h2 class="section-title">👤 Información de Usuario</h2>
      
      <div class="user-info-card">
        <div class="info-row">
          <User :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Nombre</span>
            <span class="info-value">{{ userName }}</span>
          </div>
        </div>
        
        <div class="info-row">
          <Mail :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Email</span>
            <span class="info-value">{{ user?.email }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">🚪 Sesión</h2>
      
      <button 
        @click="handleLogout" 
        class="logout-button"
        :disabled="isLoggingOut"
      >
        <LogOut :size="20" />
        {{ isLoggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión' }}
      </button>
    </div>

    <div class="settings-section">
      <p class="coming-soon">
        🚧 Más opciones de configuración próximamente...
      </p>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: var(--space-6) var(--space-4);
  max-width: 600px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: var(--space-8);
}

.settings-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.settings-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

.settings-section {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-4) 0;
}

.user-info-card {
  background-color: var(--bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.info-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.info-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.info-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.info-value {
  font-size: var(--text-base);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.logout-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: white;
  background-color: var(--error);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.logout-button:hover {
  background-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.logout-button:active {
  transform: translateY(0);
}

.logout-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.coming-soon {
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-style: italic;
  padding: var(--space-4);
  background-color: var(--bg-elevated);
  border-radius: var(--radius-base);
  border: 1px dashed var(--border-secondary);
}

@media (max-width: 768px) {
  .view-container {
    padding: var(--space-4) var(--space-3);
  }

  .settings-title {
    font-size: var(--text-2xl);
  }
}
</style>
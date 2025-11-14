<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useUserProfile } from '@/composables/useUserProfile'
import { LogOut, User, Mail, Phone, MapPin, Edit2, Save, X, CheckCircle, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const { logout, user } = useAuth()
const { userProfile, isLoadingProfile, fetchUserProfile, updateUserProfile } = useUserProfile()

const isLoggingOut = ref(false)
const isEditingProfile = ref(false)
const isSavingProfile = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Form fields
const editForm = ref({
  full_name: '',
  telefono: '',
  ciudad: '',
  zona_trabajo: ''
})

const userName = computed(() => {
  if (userProfile.value?.full_name) {
    return userProfile.value.full_name
  }
  if (user.value?.email) {
    return user.value.email.split('@')[0]
  }
  return 'Usuario'
})

onMounted(async () => {
  if (user.value?.id) {
    await fetchUserProfile(user.value.id)
    // Inicializar el formulario con los datos actuales
    if (userProfile.value) {
      editForm.value = {
        full_name: userProfile.value.full_name || '',
        telefono: userProfile.value.telefono || '',
        ciudad: userProfile.value.ciudad || '',
        zona_trabajo: userProfile.value.zona_trabajo || ''
      }
    }
  }
})

function startEditing() {
  isEditingProfile.value = true
  successMessage.value = ''
  errorMessage.value = ''
}

function cancelEditing() {
  isEditingProfile.value = false
  // Restaurar valores originales
  if (userProfile.value) {
    editForm.value = {
      full_name: userProfile.value.full_name || '',
      telefono: userProfile.value.telefono || '',
      ciudad: userProfile.value.ciudad || '',
      zona_trabajo: userProfile.value.zona_trabajo || ''
    }
  }
}

async function saveProfile() {
  if (!editForm.value.full_name?.trim()) {
    errorMessage.value = 'El nombre completo es obligatorio'
    return
  }

  isSavingProfile.value = true
  errorMessage.value = ''
  successMessage.value = ''

  const result = await updateUserProfile(user.value.id, editForm.value)

  if (result.success) {
    successMessage.value = '¡Perfil actualizado exitosamente!'
    isEditingProfile.value = false
    
    // Limpiar mensaje después de 3 segundos
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } else {
    errorMessage.value = result.error || 'Error al actualizar el perfil'
  }

  isSavingProfile.value = false
}

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

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="message-banner success-banner">
      <CheckCircle :size="20" />
      <span>{{ successMessage }}</span>
    </div>

    <div v-if="errorMessage" class="message-banner error-banner">
      <AlertCircle :size="20" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Profile Section -->
    <div class="settings-section">
      <div class="section-header">
        <h2 class="section-title">👤 Información Personal</h2>
        <button 
          v-if="!isEditingProfile" 
          @click="startEditing"
          class="edit-button"
          :disabled="isLoadingProfile"
        >
          <Edit2 :size="16" />
          Editar
        </button>
      </div>
      
      <!-- View Mode -->
      <div v-if="!isEditingProfile" class="user-info-card">
        <div class="info-row">
          <User :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Nombre Completo</span>
            <span class="info-value">{{ userProfile?.full_name || 'No configurado' }}</span>
          </div>
        </div>
        
        <div class="info-row">
          <Mail :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Email</span>
            <span class="info-value">{{ user?.email }}</span>
          </div>
        </div>

        <div class="info-row">
          <Phone :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Teléfono</span>
            <span class="info-value">{{ userProfile?.telefono || 'No configurado' }}</span>
          </div>
        </div>

        <div class="info-row">
          <MapPin :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Ciudad</span>
            <span class="info-value">{{ userProfile?.ciudad || 'No configurado' }}</span>
          </div>
        </div>

        <div class="info-row">
          <MapPin :size="20" class="info-icon" />
          <div class="info-content">
            <span class="info-label">Zona de Trabajo</span>
            <span class="info-value">{{ userProfile?.zona_trabajo || 'No configurado' }}</span>
          </div>
        </div>
      </div>

      <!-- Edit Mode -->
      <div v-else class="edit-form">
        <div class="form-group">
          <label for="fullName" class="form-label">
            <User :size="16" />
            Nombre Completo *
          </label>
          <input
            id="fullName"
            v-model="editForm.full_name"
            type="text"
            placeholder="Tu nombre completo"
            class="form-input"
            :disabled="isSavingProfile"
            required
          />
        </div>

        <div class="form-group">
          <label for="phone" class="form-label">
            <Phone :size="16" />
            Teléfono
          </label>
          <input
            id="phone"
            v-model="editForm.telefono"
            type="tel"
            placeholder="(123) 456-7890"
            class="form-input"
            :disabled="isSavingProfile"
          />
        </div>

        <div class="form-group">
          <label for="city" class="form-label">
            <MapPin :size="16" />
            Ciudad
          </label>
          <input
            id="city"
            v-model="editForm.ciudad"
            type="text"
            placeholder="Tu ciudad"
            class="form-input"
            :disabled="isSavingProfile"
          />
        </div>

        <div class="form-group">
          <label for="workZone" class="form-label">
            <MapPin :size="16" />
            Zona de Trabajo
          </label>
          <input
            id="workZone"
            v-model="editForm.zona_trabajo"
            type="text"
            placeholder="Ej: Downtown, North Side"
            class="form-input"
            :disabled="isSavingProfile"
          />
        </div>

        <div class="form-actions">
          <button 
            @click="cancelEditing"
            class="cancel-button"
            :disabled="isSavingProfile"
          >
            <X :size="18" />
            Cancelar
          </button>
          <button 
            @click="saveProfile"
            class="save-button"
            :disabled="isSavingProfile"
          >
            <Save :size="18" />
            {{ isSavingProfile ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Session Section -->
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

/* Message Banners */
.message-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.success-banner {
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.error-banner {
  background-color: var(--error-bg);
  color: var(--error);
  border: 1px solid #fca5a5;
}

/* Settings Section */
.settings-section {
  margin-bottom: var(--space-8);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.edit-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--brand-primary);
  background-color: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.edit-button:hover:not(:disabled) {
  background-color: var(--brand-primary);
  color: white;
}

.edit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* View Mode Card */
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

/* Edit Form */
.edit-form {
  background-color: var(--bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: 1px solid var(--border-primary);
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

.form-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.cancel-button,
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

.cancel-button {
  color: var(--text-secondary);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-primary);
}

.cancel-button:hover:not(:disabled) {
  background-color: var(--bg-elevated);
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

.cancel-button:disabled,
.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Logout Button */
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

.logout-button:hover:not(:disabled) {
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

/* Responsive */
@media (max-width: 768px) {
  .view-container {
    padding: var(--space-4) var(--space-3);
  }

  .settings-title {
    font-size: var(--text-2xl);
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .edit-button {
    width: 100%;
    justify-content: center;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
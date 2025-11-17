<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useVehicles } from '@/composables/useVehicles'
import { LogOut, User, Mail, Car, Plus, Edit2, Archive, Star, RotateCcw } from 'lucide-vue-next'
import VehicleModal from '@/components/VehicleModal.vue'

const router = useRouter()
const { logout, user, userName } = useAuth()
const { 
  vehicles, 
  isLoadingVehicles, 
  fetchVehicles, 
  createVehicle, 
  updateVehicle, 
  archiveVehicle,
  unarchiveVehicle,
  setPrimaryVehicle 
} = useVehicles()

const isLoggingOut = ref(false)
const showVehicleModal = ref(false)
const editingVehicle = ref(null)

// Cargar vehículos al montar
onMounted(async () => {
  if (user.value?.id) {
    await fetchVehicles(user.value.id)
  }
})

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

function openCreateVehicleModal() {
  editingVehicle.value = null
  showVehicleModal.value = true
}

function openEditVehicleModal(vehicle) {
  editingVehicle.value = vehicle
  showVehicleModal.value = true
}

function closeVehicleModal() {
  showVehicleModal.value = false
  editingVehicle.value = null
}

async function handleSaveVehicle(vehicleData) {
  if (!user.value?.id) return
  
  let result
  
  if (editingVehicle.value) {
    // Modo edición
    result = await updateVehicle(user.value.id, editingVehicle.value.id, vehicleData)
  } else {
    // Modo creación
    result = await createVehicle(user.value.id, vehicleData)
  }
  
  if (result.success) {
    closeVehicleModal()
  } else {
    alert(result.error || 'Error al guardar vehículo')
  }
}

async function handleArchiveVehicle(vehicleId) {
  if (!user.value?.id) return
  
  if (confirm('¿Archivar este vehículo? Podrás restaurarlo después.')) {
    const result = await archiveVehicle(user.value.id, vehicleId)
    if (!result.success) {
      alert(result.error || 'Error al archivar vehículo')
    }
  }
}

async function handleUnarchiveVehicle(vehicleId) {
  if (!user.value?.id) return
  
  const result = await unarchiveVehicle(user.value.id, vehicleId)
  if (!result.success) {
    alert(result.error || 'Error al restaurar vehículo')
  }
}

async function handleSetPrimary(vehicleId) {
  if (!user.value?.id) return
  
  const result = await setPrimaryVehicle(user.value.id, vehicleId)
  if (!result.success) {
    alert(result.error || 'Error al marcar como principal')
  }
}

function formatMileage(mileage) {
  if (!mileage) return '0'
  return new Intl.NumberFormat('en-US').format(Math.round(mileage))
}
</script>

<template>
  <div class="view-container">
    <div class="settings-header">
      <h1 class="settings-title">⚙️ Configuración</h1>
      <p class="settings-subtitle">Gestiona tu cuenta y preferencias</p>
    </div>

    <!-- ==================== SECCIÓN: INFORMACIÓN DE USUARIO ==================== -->
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

    <!-- ==================== SECCIÓN: MIS VEHÍCULOS ==================== -->
    <div class="settings-section">
      <div class="section-header">
        <h2 class="section-title">🚗 Mis Vehículos</h2>
        <button @click="openCreateVehicleModal" class="btn-add-vehicle">
          <Plus :size="18" />
          Agregar
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoadingVehicles" class="loading-state">
        <p>Cargando vehículos...</p>
      </div>

      <!-- Lista de vehículos -->
      <div v-else-if="vehicles.length > 0" class="vehicles-grid">
        <div 
          v-for="vehicle in vehicles" 
          :key="vehicle.id"
          class="vehicle-card"
          :class="{ 'is-archived': vehicle.is_archived }"
        >
          <!-- Header del card -->
          <div class="vehicle-header">
            <div class="vehicle-title-group">
              <Car :size="20" class="vehicle-icon" />
              <h3 class="vehicle-nickname">{{ vehicle.nickname }}</h3>
            </div>
            
            <!-- Badges -->
            <div class="vehicle-badges">
              <span v-if="vehicle.is_primary && !vehicle.is_archived" class="badge badge-primary">
                <Star :size="14" />
                Principal
              </span>
              <span v-if="vehicle.is_archived" class="badge badge-archived">
                <Archive :size="14" />
                Archivado
              </span>
            </div>
          </div>

          <!-- Info del vehículo -->
          <div class="vehicle-info">
            <div v-if="vehicle.make || vehicle.model" class="vehicle-detail">
              <span class="detail-label">Vehículo:</span>
              <span class="detail-value">
                {{ vehicle.make }} {{ vehicle.model }}
                <span v-if="vehicle.year" class="year-badge">{{ vehicle.year }}</span>
              </span>
            </div>
            
            <div class="vehicle-detail">
              <span class="detail-label">Millaje acumulado:</span>
              <span class="detail-value">{{ formatMileage(vehicle.total_mileage) }} mi</span>
            </div>
          </div>

          <!-- Acciones -->
          <div class="vehicle-actions">
            <button 
              v-if="!vehicle.is_archived"
              @click="openEditVehicleModal(vehicle)"
              class="btn-action btn-edit"
              title="Editar"
            >
              <Edit2 :size="16" />
            </button>

            <button 
              v-if="!vehicle.is_primary && !vehicle.is_archived"
              @click="handleSetPrimary(vehicle.id)"
              class="btn-action btn-primary-set"
              title="Marcar como principal"
            >
              <Star :size="16" />
            </button>

            <button 
              v-if="!vehicle.is_archived"
              @click="handleArchiveVehicle(vehicle.id)"
              class="btn-action btn-archive"
              title="Archivar"
            >
              <Archive :size="16" />
            </button>

            <button 
              v-if="vehicle.is_archived"
              @click="handleUnarchiveVehicle(vehicle.id)"
              class="btn-action btn-unarchive"
              title="Restaurar"
            >
              <RotateCcw :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Estado vacío -->
      <div v-else class="empty-state">
        <Car :size="48" class="empty-icon" />
        <p class="empty-title">No tienes vehículos registrados</p>
        <p class="empty-subtitle">Agrega tu primer vehículo para comenzar a trackear tus rutas</p>
        <button @click="openCreateVehicleModal" class="btn-add-first">
          <Plus :size="18" />
          Agregar mi primer vehículo
        </button>
      </div>
    </div>

    <!-- ==================== SECCIÓN: SESIÓN ==================== -->
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

    <!-- ==================== MODAL DE VEHÍCULO ==================== -->
    <VehicleModal 
      :show="showVehicleModal"
      :vehicle="editingVehicle"
      @close="closeVehicleModal"
      @save="handleSaveVehicle"
    />
  </div>
</template>

<style scoped>
.view-container {
  padding: var(--space-6) var(--space-4);
  max-width: 900px;
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

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

/* ==================== USER INFO CARD ==================== */
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

/* ==================== VEHICLES SECTION ==================== */
.btn-add-vehicle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: white;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-add-vehicle:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.loading-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-secondary);
}

.vehicles-grid {
  display: grid;
  gap: var(--space-4);
}

.vehicle-card {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: all 0.2s var(--ease-out);
}

.vehicle-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.vehicle-card.is-archived {
  opacity: 0.6;
  border-style: dashed;
}

.vehicle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.vehicle-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.vehicle-icon {
  color: var(--brand-primary);
}

.vehicle-nickname {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.vehicle-badges {
  display: flex;
  gap: var(--space-2);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
}

.badge-primary {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-archived {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
}

.vehicle-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-base);
}

.vehicle-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
}

.detail-label {
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.detail-value {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.year-badge {
  padding: 2px var(--space-2);
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.vehicle-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-edit {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-edit:hover {
  background-color: var(--brand-primary);
  color: white;
}

.btn-primary-set {
  background-color: #fef3c7;
  color: #92400e;
}

.btn-primary-set:hover {
  background-color: #fde047;
}

.btn-archive {
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-archive:hover {
  background-color: var(--error-bg);
  color: var(--error);
}

.btn-unarchive {
  background-color: var(--success-bg);
  color: var(--success);
}

.btn-unarchive:hover {
  background-color: var(--success);
  color: white;
}

/* ==================== EMPTY STATE ==================== */
.empty-state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.empty-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-4) 0;
}

.btn-add-first {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: white;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-add-first:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* ==================== LOGOUT ==================== */
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

/* ==================== RESPONSIVE ==================== */
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
    gap: var(--space-3);
  }

  .btn-add-vehicle {
    width: 100%;
    justify-content: center;
  }

  .vehicle-detail {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}
</style>
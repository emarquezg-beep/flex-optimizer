<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useVehicles } from '@/composables/useVehicles'
import { LogOut, User, Mail, Car, Plus, Edit2, Archive, Star, RotateCcw, ChevronRight } from 'lucide-vue-next'
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
      <h1 class="settings-title">Configuración</h1>
      <p class="settings-subtitle">Perfil y Preferencias</p>
    </div>

    <div class="settings-grid">
      
      <div class="settings-col">
        <section class="settings-card profile-card">
          <div class="card-header">
            <h2 class="card-title">Perfil de Piloto</h2>
          </div>
          
          <div class="profile-content">
            <div class="profile-avatar">
              <span class="avatar-initials">{{ userName.charAt(0) }}</span>
            </div>
            
            <div class="profile-details">
              <div class="detail-group">
                <label>Nombre</label>
                <div class="value-row">
                  <User :size="16" class="icon-muted" />
                  <span>{{ userName }}</span>
                </div>
              </div>
              
              <div class="detail-divider"></div>
              
              <div class="detail-group">
                <label>Email</label>
                <div class="value-row">
                  <Mail :size="16" class="icon-muted" />
                  <span class="text-truncate">{{ user?.email }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card-footer">
            <button @click="handleLogout" class="btn-logout" :disabled="isLoggingOut">
              <LogOut :size="18" />
              <span>{{ isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión' }}</span>
            </button>
          </div>
        </section>

        <section class="settings-card coming-soon-card">
          <div class="card-header">
            <h2 class="card-title">Preferencias</h2>
            <span class="badge-soon">Pronto</span>
          </div>
          <p class="text-muted text-sm">Más opciones de personalización de ruta y notificaciones en camino.</p>
        </section>
      </div>

      <div class="settings-col">
        <section class="settings-card vehicles-section">
          <div class="card-header flex-between">
            <h2 class="card-title">Flota de Vehículos</h2>
            <button @click="openCreateVehicleModal" class="btn-icon-primary" title="Agregar Vehículo">
              <Plus :size="20" />
            </button>
          </div>

          <div v-if="isLoadingVehicles" class="loading-container">
            <div class="spinner"></div>
          </div>

          <div v-else-if="vehicles.length > 0" class="vehicles-list">
            <div 
              v-for="vehicle in vehicles" 
              :key="vehicle.id"
              class="vehicle-item"
              :class="{ 'is-primary': vehicle.is_primary, 'is-archived': vehicle.is_archived }"
            >
              <div class="vehicle-main">
                <div class="vehicle-icon-box">
                  <Car :size="24" />
                </div>
                
                <div class="vehicle-info">
                  <div class="vehicle-name-row">
                    <h3 class="vehicle-name">{{ vehicle.nickname }}</h3>
                    <span v-if="vehicle.is_primary" class="badge-primary">Principal</span>
                    <span v-if="vehicle.is_archived" class="badge-archived">Archivado</span>
                  </div>
                  <p class="vehicle-specs">
                    {{ vehicle.make }} {{ vehicle.model }} <span v-if="vehicle.year">• {{ vehicle.year }}</span>
                  </p>
                  <div class="vehicle-mileage">
                    <span class="mileage-val">{{ formatMileage(vehicle.total_mileage) }}</span> 
                    <span class="mileage-unit">mi</span>
                  </div>
                </div>
              </div>

              <div class="vehicle-actions">
                <button v-if="!vehicle.is_archived" @click="openEditVehicleModal(vehicle)" class="action-btn" title="Editar">
                  <Edit2 :size="16" />
                </button>
                
                <button v-if="!vehicle.is_primary && !vehicle.is_archived" @click="handleSetPrimary(vehicle.id)" class="action-btn" title="Hacer Principal">
                  <Star :size="16" />
                </button>
                
                <button v-if="!vehicle.is_archived" @click="handleArchiveVehicle(vehicle.id)" class="action-btn btn-danger" title="Archivar">
                  <Archive :size="16" />
                </button>
                
                <button v-if="vehicle.is_archived" @click="handleUnarchiveVehicle(vehicle.id)" class="action-btn btn-success" title="Restaurar">
                  <RotateCcw :size="16" />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="empty-vehicles">
            <div class="empty-icon-box">
              <Car :size="32" />
            </div>
            <p>No hay vehículos registrados.</p>
            <button @click="openCreateVehicleModal" class="btn-text-primary">Registrar ahora</button>
          </div>
        </section>
      </div>
    </div>

    <VehicleModal 
      :show="showVehicleModal"
      :vehicle="editingVehicle"
      @close="closeVehicleModal"
      @save="handleSaveVehicle"
    />
  </div>
</template>

<style scoped>
/* ============================================
   VARIABLES & THEME
   ============================================ */
:root {
  --bg-main: #0f172a;
  --bg-card: #1e293b;
  --bg-hover: #334155;
  --border-color: #334155;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --accent-orange: #f97316;
  --accent-blue: #3b82f6;
  --danger: #ef4444;
  --success: #10b981;
}

.view-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  font-family: 'Inter', sans-serif;
  color: var(--text-main);
  padding-bottom: 100px; /* Espacio para navbar móvil */
}

/* ============================================
   HEADER
   ============================================ */
.settings-header {
  margin-bottom: 30px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 20px;
}

.settings-title {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(90deg, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -1px;
}

.settings-subtitle {
  color: var(--text-muted);
  margin: 5px 0 0 0;
  font-size: 1rem;
}

/* ============================================
   GRID LAYOUT
   ============================================ */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr; /* Perfil ocupa menos, Vehículos más */
  gap: 24px;
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.settings-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ============================================
   CARDS GENERAL
   ============================================ */
.settings-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
}

.flex-between { justify-content: space-between; }

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: white;
}

/* ============================================
   PROFILE CARD
   ============================================ */
.profile-content {
  padding: 30px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-blue), #60a5fa);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
  border: 4px solid rgba(255,255,255,0.1);
}

.avatar-initials {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
}

.profile-details {
  width: 100%;
}

.detail-group {
  margin-bottom: 5px;
}

.detail-group label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.value-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.05);
  font-size: 0.95rem;
}

.icon-muted { color: var(--text-muted); }
.text-truncate { 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
}

.detail-divider {
  height: 1px;
  background: var(--border-color);
  margin: 15px 0;
}

.card-footer {
  padding: 20px;
  background: rgba(0,0,0,0.2);
  border-top: 1px solid var(--border-color);
}

.btn-logout {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--danger);
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover:not(:disabled) {
  background: var(--danger);
  color: white;
}

.btn-logout:disabled { opacity: 0.5; cursor: not-allowed; }

/* ============================================
   VEHICLES SECTION
   ============================================ */
.btn-icon-primary {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-orange);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);
  transition: transform 0.2s;
}

.btn-icon-primary:hover { transform: scale(1.05); }

.vehicles-list {
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 15px;
}

.vehicle-item {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.vehicle-item:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.1);
}

.vehicle-item.is-primary {
  border: 1px solid rgba(249, 115, 22, 0.5);
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.05), transparent);
}

.vehicle-item.is-archived {
  opacity: 0.5;
  filter: grayscale(1);
}

.vehicle-main {
  display: flex;
  align-items: center;
  gap: 15px;
}

.vehicle-icon-box {
  width: 48px;
  height: 48px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.is-primary .vehicle-icon-box {
  background: rgba(249, 115, 22, 0.2);
  color: var(--accent-orange);
}

.vehicle-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: white;
}

.vehicle-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vehicle-specs {
  margin: 2px 0 4px 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.vehicle-mileage {
  font-size: 0.8rem;
  background: rgba(0,0,0,0.3);
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
}

.mileage-val { font-family: monospace; color: var(--accent-blue); }
.mileage-unit { color: var(--text-muted); margin-left: 2px; }

/* Badges */
.badge-primary {
  background: var(--accent-orange);
  color: white;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-archived {
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Acciones */
.vehicle-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: white;
  border-color: var(--text-muted);
}

.btn-danger:hover { background: rgba(239, 68, 68, 0.2); border-color: var(--danger); color: var(--danger); }
.btn-success:hover { background: rgba(16, 185, 129, 0.2); border-color: var(--success); color: var(--success); }

/* Empty State */
.empty-vehicles {
  text-align: center;
  padding: 40px 20px;
}
.empty-icon-box {
  margin-bottom: 10px;
  color: var(--text-muted);
}
.btn-text-primary {
  background: none; border: none;
  color: var(--accent-orange);
  font-weight: 600;
  cursor: pointer;
}

/* ============================================
   COMING SOON
   ============================================ */
.coming-soon-card {
  border-style: dashed;
  opacity: 0.7;
}
.badge-soon {
  background: rgba(255,255,255,0.1);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.loading-container {
  padding: 40px; display: flex; justify-content: center;
}
.spinner {
  width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent-orange); border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
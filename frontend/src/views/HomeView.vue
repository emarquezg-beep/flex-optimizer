<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, TrendingUp, DollarSign, Clock, Plus, MapPin } from 'lucide-vue-next'
import { BaseButton, BaseCard } from '@/components/base'

const router = useRouter()
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// 🚧 TEMPORAL: Auto-detección de usuario
// TODO v4.2: Reemplazar con usuario autenticado
const USERS = [
  { name: 'Ernesto', id: 'b5a04a69-1e96-47c4-a0c8-972fec54c21d' },
  { name: 'Carmen Cecilia', id: 'b3aaad3a-5835-4796-aca7-ea634e150b5d' }
]
const selectedUserId = ref(USERS[0].id)

// Estados
const isLoading = ref(true)
const weekSummary = ref(null)
const scheduledBlocks = ref([])
const selectedBlock = ref(null)
const showBlockModal = ref(false)

onMounted(async () => {
  await loadDashboard()
})

async function loadDashboard() {
  isLoading.value = true
  
  try {
    // Cargar resumen semanal
    const summaryResponse = await fetch(
      `${backendUrl}/api/scheduled-blocks/${selectedUserId.value}/week-summary`
    )
    const summaryResult = await summaryResponse.json()
    
    if (summaryResult.success) {
      weekSummary.value = summaryResult.summary
    }
    
    // Cargar bloques agendados (próximos 7 días)
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const blocksResponse = await fetch(
      `${backendUrl}/api/scheduled-blocks/${selectedUserId.value}?status=scheduled&startDate=${today}&endDate=${nextWeek}`
    )
    const blocksResult = await blocksResponse.json()
    
    if (blocksResult.success) {
      scheduledBlocks.value = blocksResult.blocks
    }
    
    console.log('✅ Dashboard cargado')
    
  } catch (error) {
    console.error('❌ Error cargando dashboard:', error)
  } finally {
    isLoading.value = false
  }
}

function openBlockModal(block) {
  selectedBlock.value = block
  showBlockModal.value = true
}

function closeBlockModal() {
  showBlockModal.value = false
  selectedBlock.value = null
}

async function startBlock(block) {
  closeBlockModal()
  // Redirigir a UploadView con parámetros del bloque
  router.push({
    path: '/upload',
    query: {
      blockId: block.id,
      fecha: block.fecha,
      hora: block.hora,
      duracion: block.duracion_horas,
      pago: block.pago,
      warehouse: block.warehouse,
      vehiculo: block.vehiculo
    }
  })
}

async function editBlock(block) {
  closeBlockModal()
  router.push({
    path: '/schedule',
    query: { blockId: block.id }
  })
}

async function deleteBlock(block) {
  if (!confirm('¿Estás seguro de cancelar este bloque?')) {
    return
  }
  
  try {
    const response = await fetch(
      `${backendUrl}/api/scheduled-blocks/${block.id}?soft=true`,
      { method: 'DELETE' }
    )
    
    const result = await response.json()
    
    if (result.success) {
      alert('Bloque cancelado')
      closeBlockModal()
      await loadDashboard()
    } else {
      alert('Error: ' + result.error)
    }
    
  } catch (error) {
    console.error('❌ Error cancelando bloque:', error)
    alert('Error de conexión')
  }
}

function goToSchedule() {
  router.push('/schedule')
}

// Formateo de fecha
function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('es-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

// Formateo de hora (de "14:15:00" a "2:15 PM")
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

// Computed
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
})

const userName = computed(() => {
  return USERS.find(u => u.id === selectedUserId.value)?.name || 'Usuario'
})

const hoursWorked = computed(() => {
  if (!weekSummary.value) return 0
  return parseFloat(weekSummary.value.completed.hours)
})

// 🆕 Horas agendadas
const hoursScheduled = computed(() => {
  if (!weekSummary.value) return 0
  return parseFloat(weekSummary.value.scheduled.hours || 0)
})

// 🆕 Horas libres
const hoursFree = computed(() => {
  const worked = hoursWorked.value
  const scheduled = hoursScheduled.value
  return Math.max(0, 40 - worked - scheduled)
})

const hoursRemaining = computed(() => {
  if (!weekSummary.value) return 0
  const worked = parseFloat(weekSummary.value.completed.hours)
  return Math.max(0, 40 - worked)
})

const progressPercentage = computed(() => {
  if (!weekSummary.value) return 0
  const worked = parseFloat(weekSummary.value.completed.hours)
  return Math.min(100, (worked / 40) * 100)
})
</script>

<template>
  <div class="home-view">
    
    <!-- Header con Saludo -->
    <div class="header-section">
      <h1 class="greeting">{{ greeting }}, {{ userName }} 👋</h1>
      <p class="header-subtitle">Aquí está tu resumen semanal</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando dashboard...</p>
    </div>

    <!-- Dashboard Content -->
    <div v-else class="dashboard-content">
      
      <!-- Resumen Semanal -->
      <BaseCard v-if="weekSummary" padding="lg" class="summary-card" elevated>
        <h2 class="section-title">
          <Calendar :size="20" />
          Resumen de la Semana
        </h2>
        
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Horas trabajadas</span>
            <span class="progress-value">
              {{ weekSummary.completed.hours }} / 40h
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
          <p class="progress-detail">
            Te quedan {{ hoursRemaining.toFixed(1) }}h para completar las 40h semanales
          </p>
        </div>

        <!-- 🆕 Grid de 6 cards (2 columnas en móvil, 3 en desktop) -->
        <div class="stats-grid">
          <!-- 1. Ganado esta semana -->
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <DollarSign :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Ganado esta semana</span>
              <span class="stat-value">${{ weekSummary.completed.pay }}</span>
            </div>
          </div>

          <!-- 2. Millas recorridas -->
          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <MapPin :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Millas recorridas</span>
              <span class="stat-value">{{ weekSummary.completed.miles }} mi</span>
            </div>
          </div>

          <!-- 3. Bloques completados -->
          <div class="stat-card">
            <div class="stat-icon stat-icon--purple">
              <TrendingUp :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Bloques completados</span>
              <span class="stat-value">{{ weekSummary.completed.routes }}</span>
            </div>
          </div>

          <!-- 4. Bloques agendados -->
          <div class="stat-card">
            <div class="stat-icon stat-icon--orange">
              <Clock :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Bloques agendados</span>
              <span class="stat-value">{{ weekSummary.scheduled.blocks }}</span>
            </div>
          </div>

          <!-- 🆕 5. Horas agendadas -->
          <div class="stat-card">
            <div class="stat-icon stat-icon--indigo">
              <Calendar :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Horas agendadas</span>
              <span class="stat-value">{{ hoursScheduled.toFixed(1) }}h</span>
            </div>
          </div>

          <!-- 🆕 6. Horas libres -->
          <div class="stat-card">
            <div class="stat-icon stat-icon--teal">
              <Clock :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Horas libres</span>
              <span class="stat-value">{{ hoursFree.toFixed(1) }}h</span>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- Bloques Agendados -->
      <BaseCard padding="lg" class="blocks-card">
        <div class="blocks-header">
          <h2 class="section-title">
            <Calendar :size="20" />
            Próximos Bloques
          </h2>
          <BaseButton 
            variant="primary" 
            size="sm"
            @click="goToSchedule"
          >
            <Plus :size="16" />
            Nuevo Bloque
          </BaseButton>
        </div>

        <!-- Lista de Bloques -->
        <div v-if="scheduledBlocks.length > 0" class="blocks-list">
          <div 
            v-for="block in scheduledBlocks" 
            :key="block.id"
            class="block-item"
            @click="openBlockModal(block)"
          >
            <div class="block-date">
              <span class="block-day">{{ formatDate(block.fecha) }}</span>
              <span class="block-time">{{ formatTime(block.hora) }}</span>
            </div>
            
            <div class="block-details">
              <div class="block-main">
                <span class="block-warehouse">{{ block.warehouse }}</span>
                <span class="block-duration">{{ block.duracion_horas }}h</span>
              </div>
              <div class="block-meta">
                <span class="block-vehicle">{{ block.vehiculo }}</span>
                <span class="block-pay">${{ block.pago }}</span>
              </div>
            </div>

            <div class="block-arrow">›</div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-blocks">
          <Calendar :size="48" class="empty-icon" />
          <p class="empty-text">No tienes bloques agendados</p>
          <BaseButton 
            variant="primary" 
            @click="goToSchedule"
          >
            Agendar Primer Bloque
          </BaseButton>
        </div>
      </BaseCard>

    </div>

    <!-- Modal de Acciones del Bloque -->
    <div v-if="showBlockModal" class="modal-overlay" @click="closeBlockModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Detalles del Bloque</h3>
          <button class="close-btn" @click="closeBlockModal">×</button>
        </div>

        <div v-if="selectedBlock" class="modal-body">
          <div class="detail-row">
            <span class="detail-label">Fecha</span>
            <span class="detail-value">{{ formatDate(selectedBlock.fecha) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Hora</span>
            <span class="detail-value">{{ formatTime(selectedBlock.hora) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Warehouse</span>
            <span class="detail-value">{{ selectedBlock.warehouse }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Duración</span>
            <span class="detail-value">{{ selectedBlock.duracion_horas }}h</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Pago</span>
            <span class="detail-value">${{ selectedBlock.pago }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Vehículo</span>
            <span class="detail-value">{{ selectedBlock.vehiculo }}</span>
          </div>
        </div>

        <div class="modal-actions">
          <BaseButton 
            variant="primary" 
            @click="startBlock(selectedBlock)"
            style="flex: 1"
          >
            Iniciar Bloque
          </BaseButton>
          <BaseButton 
            variant="secondary" 
            @click="editBlock(selectedBlock)"
            style="flex: 1"
          >
            Editar
          </BaseButton>
          <BaseButton 
            variant="danger" 
            @click="deleteBlock(selectedBlock)"
            style="flex: 1"
          >
            Cancelar
          </BaseButton>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  padding-bottom: 80px;
}

/* Header */
.header-section {
  margin-bottom: 24px;
}

.greeting {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.header-subtitle {
  font-size: 16px;
  color: var(--color-text-secondary);
}

/* Loading */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Dashboard Content */
.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Summary Card */
.summary-card {
  background: white;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 20px;
}

/* Progress Section */
.progress-section {
  margin-bottom: 24px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.progress-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
}

.progress-bar {
  height: 12px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), #10b981);
  border-radius: 999px;
  transition: width 0.5s ease;
}

.progress-detail {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 🆕 Stats Grid - 2 columnas en móvil, 3 en desktop */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2 columnas en móvil */
  gap: 8px; /* Reducido para móvil */
}

/* Desktop: 3 columnas */
@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 8px; /* Reducido */
  padding: 12px; /* Reducido */
  background: #f9fafb;
  border-radius: 10px; /* Reducido */
  transition: all 0.2s;
  min-height: 70px; /* Altura mínima consistente */
}

.stat-card:hover {
  background: #f3f4f6;
  transform: translateY(-2px);
}

.stat-icon {
  flex-shrink: 0;
  width: 40px; /* Reducido de 48px */
  height: 40px; /* Reducido de 48px */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: white;
}

.stat-icon--green { color: #10b981; }
.stat-icon--blue { color: #3b82f6; }
.stat-icon--purple { color: #8b5cf6; }
.stat-icon--orange { color: #f59e0b; }
.stat-icon--indigo { color: #6366f1; } /* 🆕 */
.stat-icon--teal { color: #14b8a6; } /* 🆕 */

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px; /* Reducido */
  min-width: 0; /* Para permitir text-overflow */
  flex: 1;
}

.stat-label {
  font-size: 11px; /* Reducido de 12px */
  color: var(--color-text-secondary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* Permite 2 líneas */
  -webkit-box-orient: vertical;
}

.stat-value {
  font-size: 18px; /* Reducido de 20px */
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}

/* Ajustes específicos para desktop */
@media (min-width: 768px) {
  .stat-card {
    padding: 16px;
    gap: 12px;
  }
  
  .stat-icon {
    width: 48px;
    height: 48px;
  }
  
  .stat-label {
    font-size: 12px;
  }
  
  .stat-value {
    font-size: 20px;
  }
}

/* Blocks Card */
.blocks-card {
  background: white;
}

.blocks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.block-item:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.block-date {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  min-width: 70px;
}

.block-day {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
}

.block-time {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.block-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.block-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.block-warehouse {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-duration {
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.block-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.block-vehicle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-pay {
  font-weight: 600;
  color: #10b981;
  flex-shrink: 0;
}

.block-arrow {
  font-size: 24px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* Empty State */
.empty-blocks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-tertiary);
}

.empty-text {
  font-size: 16px;
  color: var(--color-text-secondary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 0;
}

@media (min-width: 768px) {
  .modal-overlay {
    align-items: center;
    padding: 20px;
  }
}

.modal-content {
  background: white;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

@media (min-width: 768px) {
  .modal-content {
    border-radius: 20px;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  color: var(--color-text-secondary);
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e5e7eb;
}
</style>
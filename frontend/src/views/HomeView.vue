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
  if (!confirm(`¿Eliminar el bloque de ${block.warehouse} el ${formatDate(block.fecha)}?`)) {
    return
  }
  
  try {
    const response = await fetch(
      `${backendUrl}/api/scheduled-blocks/${block.id}?soft=true`,
      { method: 'DELETE' }
    )
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ Bloque cancelado')
      closeBlockModal()
      await loadDashboard() // Recargar
    } else {
      alert('Error cancelando bloque: ' + result.error)
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

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <DollarSign :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Ganado esta semana</span>
              <span class="stat-value">${{ weekSummary.completed.pay }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <MapPin :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Millas recorridas</span>
              <span class="stat-value">{{ weekSummary.completed.miles }} mi</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--purple">
              <TrendingUp :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Bloques completados</span>
              <span class="stat-value">{{ weekSummary.completed.routes }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--orange">
              <Clock :size="24" />
            </div>
            <div class="stat-content">
              <span class="stat-label">Bloques agendados</span>
              <span class="stat-value">{{ weekSummary.scheduled.blocks }}</span>
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
        <h3 class="modal-title">¿Qué deseas hacer?</h3>
        
        <div v-if="selectedBlock" class="modal-block-info">
          <p><strong>{{ selectedBlock.warehouse }}</strong></p>
          <p>{{ formatDate(selectedBlock.fecha) }} a las {{ formatTime(selectedBlock.hora) }}</p>
          <p>{{ selectedBlock.duracion_horas }}h - ${{ selectedBlock.pago }}</p>
        </div>

        <div class="modal-actions">
          <BaseButton 
            variant="primary" 
            size="lg" 
            full-width
            @click="startBlock(selectedBlock)"
          >
            🚀 Empezar Bloque
          </BaseButton>

          <BaseButton 
            variant="secondary" 
            size="lg" 
            full-width
            @click="editBlock(selectedBlock)"
          >
            ✏️ Editar
          </BaseButton>

          <BaseButton 
            variant="secondary" 
            size="lg" 
            full-width
            @click="deleteBlock(selectedBlock)"
          >
            🗑️ Eliminar
          </BaseButton>

          <BaseButton 
            variant="ghost" 
            size="md" 
            full-width
            @click="closeBlockModal"
          >
            Cancelar
          </BaseButton>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ==================== LAYOUT ==================== */
.home-view {
  min-height: 100vh;
  background-color: var(--bg-primary);
  padding-bottom: calc(var(--bottom-nav-height) + var(--space-4));
}

.header-section {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-4);
}

.greeting {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.header-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

.dashboard-content {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ==================== LOADING ==================== */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: var(--space-3);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==================== SUMMARY CARD ==================== */
.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-5) 0;
}

.progress-section {
  margin-bottom: var(--space-6);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.progress-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.progress-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--brand-primary);
}

.progress-bar {
  height: 12px;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-accent), var(--brand-primary));
  border-radius: var(--radius-full);
  transition: width 0.5s var(--ease-out);
}

.progress-detail {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-align: center;
  margin: 0;
}

/* ==================== STATS GRID ==================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  transition: all var(--transition-base);
}

.stat-card:hover {
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.stat-icon--green { background-color: rgba(16, 185, 129, 0.1); color: var(--success); }
.stat-icon--blue { background-color: rgba(59, 130, 246, 0.1); color: var(--brand-primary); }
.stat-icon--purple { background-color: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
.stat-icon--orange { background-color: rgba(245, 158, 11, 0.1); color: var(--warning); }

.stat-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* ==================== BLOCKS CARD ==================== */
.blocks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.block-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.block-item:hover {
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.block-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  min-width: 80px;
  padding: var(--space-3);
  background-color: var(--brand-primary);
  color: white;
  border-radius: var(--radius-md);
  text-align: center;
}

.block-day {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.block-time {
  font-size: var(--text-xs);
  opacity: 0.9;
}

.block-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.block-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.block-warehouse {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.block-duration {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--brand-primary);
}

.block-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.block-pay {
  font-weight: var(--font-semibold);
  color: var(--success);
}

.block-arrow {
  font-size: var(--text-2xl);
  color: var(--text-tertiary);
}

/* ==================== EMPTY STATE ==================== */
.empty-blocks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  gap: var(--space-4);
}

.empty-icon {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

/* ==================== MODAL ==================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: var(--surface-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
  animation: fadeIn 0.2s var(--ease-out);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-elevated);
  animation: slideUp 0.3s var(--ease-out);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-4) 0;
  text-align: center;
}

.modal-block-info {
  background-color: var(--bg-primary);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-5);
  text-align: center;
}

.modal-block-info p {
  margin: var(--space-1) 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.modal-block-info p:first-child {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .greeting {
    font-size: var(--text-2xl);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .blocks-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .block-item {
    flex-wrap: wrap;
  }

  .block-date {
    min-width: 70px;
  }
}
</style>
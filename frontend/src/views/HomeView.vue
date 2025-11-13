<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { fetchWithAuth } from '@/lib/api'
import { Calendar, TrendingUp, DollarSign, Clock, Plus, MapPin } from 'lucide-vue-next'
import { BaseButton, BaseCard } from '@/components/base'

const router = useRouter()
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// ✅ Usuario autenticado
const { userId, userName: authUserName } = useAuth()

// Estados
const isLoading = ref(true)
const currentWeekSummary = ref(null)
const nextWeekSummary = ref(null)
const currentWeekBlocks = ref([])
const nextWeekBlocks = ref([])
const selectedBlock = ref(null)
const showBlockModal = ref(false)
const isNextWeekBlock = ref(false) // 🆕 Indica si el bloque es de la semana siguiente

// 🆕 Control del slider (0 = semana actual, 1 = semana siguiente)
const activeWeek = ref(0)

onMounted(async () => {
  await loadDashboard()
})

async function loadDashboard() {
  isLoading.value = true
  
  try {
    // ========================================
    // SEMANA ACTUAL
    // ========================================
    const summaryResponse = await fetchWithAuth(
      `${backendUrl}/api/scheduled-blocks/${userId.value}/week-summary`
    )
    const summaryResult = await summaryResponse.json()
    
    console.log('📊 Respuesta del backend - week-summary:', summaryResult)
    
    if (summaryResult.success) {
      currentWeekSummary.value = summaryResult.summary
      console.log('✅ Resumen cargado:', {
        completed: summaryResult.summary.completed,
        scheduled: summaryResult.summary.scheduled
      })
    }
    
    // ========================================
    // 📅 CÁLCULO DE SEMANAS (LUNES-DOMINGO)
    // ========================================
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    // Obtener el día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
    const dayOfWeek = now.getDay()
    
    // Calcular días hasta el lunes (inicio de semana)
    // Si es Domingo (0), retroceder 6 días
    // Si es Lunes (1), retroceder 0 días
    // Si es Martes (2), retroceder 1 día, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    
    // SEMANA ACTUAL: Lunes - Domingo
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - daysToMonday)
    
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6) // +6 días = Domingo
    
    // SEMANA SIGUIENTE: Lunes - Domingo
    const nextWeekStart = new Date(currentWeekStart)
    nextWeekStart.setDate(currentWeekStart.getDate() + 7) // Siguiente lunes
    
    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6) // +6 días = Domingo
    
    const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0]
    const currentWeekEndStr = currentWeekEnd.toISOString().split('T')[0]
    const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0]
    const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0]
    
    console.log('📅 HOY:', now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    console.log('📅 Semana Actual (Lun-Dom):', currentWeekStartStr, '→', currentWeekEndStr)
    console.log('📅 Semana Siguiente (Lun-Dom):', nextWeekStartStr, '→', nextWeekEndStr)
    
    // ========================================
    // BLOQUES SEMANA ACTUAL
    // ========================================
    const blocksResponse = await fetchWithAuth(
      `${backendUrl}/api/scheduled-blocks/${userId.value}?status=scheduled&startDate=${currentWeekStartStr}&endDate=${currentWeekEndStr}`
    )
    const blocksResult = await blocksResponse.json()
    
    if (blocksResult.success) {
      currentWeekBlocks.value = blocksResult.blocks
      console.log('✅ Bloques semana actual:', blocksResult.blocks.length, 'bloques')
      console.log('   Fechas:', blocksResult.blocks.map(b => b.fecha))
    }
    
    // ========================================
    // 🆕 BLOQUES SEMANA SIGUIENTE
    // ========================================
    
    // Cargar bloques de la semana siguiente
    const nextBlocksResponse = await fetchWithAuth(
      `${backendUrl}/api/scheduled-blocks/${userId.value}?status=scheduled&startDate=${nextWeekStartStr}&endDate=${nextWeekEndStr}`
    )
    const nextBlocksResult = await nextBlocksResponse.json()
    
    if (nextBlocksResult.success) {
      nextWeekBlocks.value = nextBlocksResult.blocks
      
      // 🆕 Calcular resumen de la semana siguiente
      nextWeekSummary.value = calculateNextWeekSummary(nextBlocksResult.blocks)
      
      console.log('✅ Bloques semana siguiente:', nextWeekBlocks.value.length, 'bloques')
      console.log('   Fechas:', nextBlocksResult.blocks.map(b => b.fecha))
      console.log('   📊 RESUMEN:', nextWeekSummary.value)
      
      if (nextBlocksResult.blocks.length > 0) {
        console.log('   📋 Detalles:', nextBlocksResult.blocks.map(b => ({
          fecha: b.fecha,
          warehouse: b.warehouse,
          horas: b.duracion_horas,
          pago: b.pago
        })))
      }
    } else {
      console.log('⚠️ No se pudieron cargar bloques de semana siguiente')
      console.log('   Error:', nextBlocksResult.error)
    }
    
    console.log('✅ Dashboard cargado completo')
    
  } catch (error) {
    console.error('❌ Error cargando dashboard:', error)
  } finally {
    isLoading.value = false
  }
}

// 🆕 Calcular resumen de la semana siguiente
function calculateNextWeekSummary(blocks) {
  if (!blocks || blocks.length === 0) {
    return {
      blocks: 0,
      hours: '0.0',
      pay: '0.00'
    }
  }
  
  const totalHours = blocks.reduce((sum, block) => {
    const hours = parseFloat(block.duracion_horas || 0)
    return sum + hours
  }, 0)
  
  const totalPay = blocks.reduce((sum, block) => {
    const pay = parseFloat(block.pago || 0)
    return sum + pay
  }, 0)
  
  return {
    blocks: blocks.length,
    hours: totalHours.toFixed(1),
    pay: totalPay.toFixed(2)
  }
}

function openBlockModal(block, isFromNextWeek = false) {
  selectedBlock.value = block
  isNextWeekBlock.value = isFromNextWeek
  showBlockModal.value = true
}

function closeBlockModal() {
  showBlockModal.value = false
  selectedBlock.value = null
  isNextWeekBlock.value = false
}

async function startBlock(block) {
  closeBlockModal()
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
  
  console.log('🗑️ Eliminando bloque:', block.id)
  
  try {
    const response = await fetchWithAuth(
      `${backendUrl}/api/scheduled-blocks/${block.id}?soft=true`,
      { method: 'DELETE' }
    )
    
    const result = await response.json()
    
    console.log('📥 Respuesta del DELETE:', result)
    
    if (result.success) {
      alert('Bloque cancelado')
      closeBlockModal()
      console.log('🔄 Recargando dashboard...')
      await loadDashboard()
      console.log('✅ Dashboard recargado')
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

// 🆕 Cambiar entre semanas
function switchWeek(weekIndex) {
  activeWeek.value = weekIndex
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

// Formateo de hora
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

const userName = computed(() => authUserName.value)

const hoursWorked = computed(() => {
  if (!currentWeekSummary.value) return 0
  return parseFloat(currentWeekSummary.value.completed.hours)
})

const hoursScheduled = computed(() => {
  if (!currentWeekSummary.value) return 0
  return parseFloat(currentWeekSummary.value.scheduled.hours || 0)
})

const hoursFree = computed(() => {
  const worked = hoursWorked.value
  const scheduled = hoursScheduled.value
  return Math.max(0, 40 - worked - scheduled)
})

const hoursRemaining = computed(() => {
  if (!currentWeekSummary.value) return 0
  const worked = parseFloat(currentWeekSummary.value.completed.hours)
  return Math.max(0, 40 - worked)
})

const progressPercentage = computed(() => {
  if (!currentWeekSummary.value) return 0
  const worked = parseFloat(currentWeekSummary.value.completed.hours)
  return Math.min(100, (worked / 40) * 100)
})

// 🆕 Total agendado
const totalScheduledPay = computed(() => {
  if (!currentWeekSummary.value) return 0
  return parseFloat(currentWeekSummary.value.scheduled.pay || 0)
})

// 🆕 Total estimado de la semana (ganado + agendado)
const totalEstimatedWeek = computed(() => {
  if (!currentWeekSummary.value) return 0
  const completed = parseFloat(currentWeekSummary.value.completed.pay || 0)
  const scheduled = parseFloat(currentWeekSummary.value.scheduled.pay || 0)
  return completed + scheduled
})

// 🆕 Computeds para semana siguiente
const nextWeekProgressPercentage = computed(() => {
  if (!nextWeekSummary.value) return 0
  const scheduled = parseFloat(nextWeekSummary.value.hours || 0)
  return Math.min(100, (scheduled / 40) * 100)
})

const nextWeekRemainingHours = computed(() => {
  if (!nextWeekSummary.value) return 40
  return Math.max(0, 40 - parseFloat(nextWeekSummary.value.hours || 0))
})
</script>

<template>
  <div class="home-view">
    
    <!-- Header con Saludo -->
    <div class="header-section">
      <h1 class="greeting">{{ greeting }}, {{ userName }} 👋</h1>
      <p class="header-subtitle">Aquí está tu resumen semanal</p>
    </div>

    <!-- 🆕 Navegación de Semanas -->
    <div v-show="!isLoading" class="week-tabs">
      <button 
        class="week-tab" 
        :class="{ active: activeWeek === 0 }"
        @click="switchWeek(0)"
      >
        <Calendar :size="16" />
        Semana Actual
      </button>
      <button 
        class="week-tab" 
        :class="{ active: activeWeek === 1 }"
        @click="switchWeek(1)"
      >
        <Calendar :size="16" />
        Semana Siguiente
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando dashboard...</p>
    </div>

    <!-- 🆕 Slider Container -->
    <div v-else class="slider-container">
      <div class="slider-wrapper" :style="{ transform: `translateX(-${activeWeek * 50}%)` }">
        
        <!-- ========================================
             SLIDE 1: SEMANA ACTUAL
             ======================================== -->
        <div class="slide">
          <div class="dashboard-content">
            
            <!-- Resumen Semanal Actual -->
            <BaseCard v-if="currentWeekSummary" padding="lg" class="summary-card" elevated>
              <h2 class="section-title">
                <Calendar :size="20" />
                Resumen de la Semana
              </h2>
              
              <div class="progress-section">
                <div class="progress-header">
                  <span class="progress-label">Horas trabajadas</span>
                  <span class="progress-value">
                    {{ currentWeekSummary.completed.hours }} / 40h
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
                    <span class="stat-value">${{ currentWeekSummary.completed.pay }}</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--blue">
                    <MapPin :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Millas recorridas</span>
                    <span class="stat-value">{{ currentWeekSummary.completed.miles }} mi</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--purple">
                    <TrendingUp :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Bloques completados</span>
                    <span class="stat-value">{{ currentWeekSummary.completed.routes }}</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--orange">
                    <Clock :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Bloques agendados</span>
                    <span class="stat-value">{{ currentWeekSummary.scheduled.blocks }}</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--indigo">
                    <Calendar :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Horas agendadas</span>
                    <span class="stat-value">{{ hoursScheduled.toFixed(1) }}h</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--teal">
                    <Clock :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Horas libres</span>
                    <span class="stat-value">{{ hoursFree.toFixed(1) }}h</span>
                  </div>
                </div>
                <!-- 🆕 7. Total agendado -->
                <div class="stat-card">
                  <div class="stat-icon stat-icon--yellow">
                    <DollarSign :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Total agendado</span>
                    <span class="stat-value">${{ totalScheduledPay.toFixed(2) }}</span>
                  </div>
                </div>

                <!-- 🆕 8. Total estimado semana -->
                <div class="stat-card">
                  <div class="stat-icon stat-icon--emerald">
                    <TrendingUp :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Estimado semana</span>
                    <span class="stat-value">${{ totalEstimatedWeek.toFixed(2) }}</span>
                  </div>
                </div>
              </div>
            </BaseCard>

            <!-- Bloques Agendados Semana Actual -->
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

              <div v-if="currentWeekBlocks.length > 0" class="blocks-list">
                <div 
                  v-for="block in currentWeekBlocks" 
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
                  
                  <span class="block-arrow">›</span>
                </div>
              </div>

              <div v-else class="empty-blocks">
                <Calendar :size="48" class="empty-icon" />
                <p class="empty-text">No tienes bloques agendados</p>
                <BaseButton variant="primary" size="sm" @click="goToSchedule">
                  Agendar Bloque
                </BaseButton>
              </div>
            </BaseCard>

          </div>
        </div>

        <!-- ========================================
             SLIDE 2: SEMANA SIGUIENTE
             ======================================== -->
        <div class="slide">
          <div class="dashboard-content">
            
            <!-- 🆕 Resumen Semana Siguiente -->
            <BaseCard padding="lg" class="summary-card" elevated>
              <h2 class="section-title">
                <Calendar :size="20" />
                Semana Siguiente
              </h2>
              
              <div v-if="nextWeekSummary && nextWeekSummary.blocks > 0" class="progress-section">
                <div class="progress-header">
                  <span class="progress-label">Horas agendadas</span>
                  <span class="progress-value">
                    {{ nextWeekSummary.hours }} / 40h
                  </span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill progress-fill--blue" :style="{ width: nextWeekProgressPercentage + '%' }"></div>
                </div>
                <p class="progress-detail">
                  Te quedan {{ nextWeekRemainingHours.toFixed(1) }}h disponibles para agendar
                </p>
              </div>

              <div v-else class="progress-section">
                <div class="progress-header">
                  <span class="progress-label">Horas agendadas</span>
                  <span class="progress-value">0.0 / 40h</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill progress-fill--blue" style="width: 0%"></div>
                </div>
                <p class="progress-detail">
                  Te quedan 40.0h disponibles para agendar
                </p>
              </div>

              <!-- 🆕 Stats compactos para semana siguiente -->
              <div class="stats-grid stats-grid--compact">
                <div class="stat-card">
                  <div class="stat-icon stat-icon--orange">
                    <Calendar :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Bloques agendados</span>
                    <span class="stat-value">{{ nextWeekSummary?.blocks || 0 }}</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--green">
                    <DollarSign :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Monto total</span>
                    <span class="stat-value">${{ nextWeekSummary?.pay || '0.00' }}</span>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon stat-icon--indigo">
                    <Clock :size="24" />
                  </div>
                  <div class="stat-content">
                    <span class="stat-label">Total de horas</span>
                    <span class="stat-value">{{ nextWeekSummary?.hours || '0.0' }}h</span>
                  </div>
                </div>
              </div>
            </BaseCard>

            <!-- 🆕 Bloques Semana Siguiente -->
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

              <!-- Lista siempre visible -->
              <div v-if="nextWeekBlocks.length > 0" class="blocks-list">
                <div 
                  v-for="block in nextWeekBlocks" 
                  :key="block.id"
                  class="block-item"
                  @click="openBlockModal(block, true)"
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
                  
                  <span class="block-arrow">›</span>
                </div>
              </div>

              <div v-else class="empty-blocks">
                <Calendar :size="48" class="empty-icon" />
                <p class="empty-text">No tienes bloques agendados para la semana siguiente</p>
                <BaseButton variant="primary" size="sm" @click="goToSchedule">
                  Agendar Bloque
                </BaseButton>
              </div>
            </BaseCard>

          </div>
        </div>

      </div>
    </div>

    <!-- Modal de Bloque -->
    <Teleport to="body">
      <div v-if="showBlockModal" class="modal-overlay" @click.self="closeBlockModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Detalles del Bloque</h3>
            <button class="close-btn" @click="closeBlockModal">×</button>
          </div>
          
          <div class="modal-body" v-if="selectedBlock">
            <div class="detail-row">
              <span class="detail-label">Fecha</span>
              <span class="detail-value">{{ formatDate(selectedBlock.fecha) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Hora</span>
              <span class="detail-value">{{ formatTime(selectedBlock.hora) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Duración</span>
              <span class="detail-value">{{ selectedBlock.duracion_horas }}h</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Warehouse</span>
              <span class="detail-value">{{ selectedBlock.warehouse }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Vehículo</span>
              <span class="detail-value">{{ selectedBlock.vehiculo }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Pago</span>
              <span class="detail-value">${{ selectedBlock.pago }}</span>
            </div>
          </div>
          
          <div class="modal-actions">
            <!-- 🆕 Botón "Iniciar Ruta" solo para bloques de la semana actual -->
            <BaseButton 
              v-if="!isNextWeekBlock"
              variant="primary" 
              size="md" 
              class="modal-btn"
              @click="startBlock(selectedBlock)"
            >
              Iniciar Ruta
            </BaseButton>
            <BaseButton 
              variant="secondary" 
              size="md" 
              class="modal-btn"
              @click="editBlock(selectedBlock)"
            >
              Editar
            </BaseButton>
            <BaseButton 
              variant="danger" 
              size="md" 
              class="modal-btn"
              @click="deleteBlock(selectedBlock)"
            >
              Cancelar
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
/* ============================================
   Variables y Reset
   ============================================ */
:root {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;
  --color-bg-secondary: #f9fafb;
}

/* ============================================
   Layout Principal
   ============================================ */
.home-view {
  min-height: 100vh;
  background: linear-gradient(to bottom, #f0f9ff, #ffffff);
  padding: 20px 16px 100px;
}

/* Header */
.header-section {
  margin-bottom: 24px;
}

.greeting {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
}

.header-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* 🆕 Navegación de Semanas (Tabs) */
.week-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  background: white;
  padding: 6px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 10;
}

.week-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.week-tab.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

/* 🆕 Slider Container */
.slider-container {
  overflow: hidden;
  position: relative;
  width: 100%;
}

.slider-wrapper {
  display: flex;
  width: 200%; /* 2 slides = 200% */
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide {
  width: 50%; /* Cada slide ocupa 50% del wrapper (que es 200%) */
  flex-shrink: 0;
}

/* Loading */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Dashboard Content */
.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 2px;
}

/* Section Title */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 16px 0;
}

/* ============================================
   Summary Card
   ============================================ */
.summary-card {
  background: white;
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
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.progress-bar {
  height: 10px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 999px;
  transition: width 0.5s ease;
}

/* 🆕 Variante azul para horas agendadas */
.progress-fill--blue {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

.progress-detail {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* 🆕 Grid compacto para semana siguiente (3 columnas en móvil) */
.stats-grid--compact {
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .stats-grid--compact {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon--green { background: #d1fae5; color: #10b981; }
.stat-icon--blue { background: #dbeafe; color: #3b82f6; }
.stat-icon--purple { background: #ede9fe; color: #8b5cf6; }
.stat-icon--orange { background: #fed7aa; color: #f59e0b; }
.stat-icon--indigo { background: #e0e7ff; color: #6366f1; }
.stat-icon--teal { background: #ccfbf1; color: #14b8a6; }
.stat-icon--yellow { background: #fef3c7; color: #f59e0b; }
.stat-icon--emerald { background: #d1fae5; color: #059669; }

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}

/* ============================================
   Blocks Card
   ============================================ */
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

/* Lista de Bloques */
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

/* ============================================
   MODAL
   ============================================ */
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
  max-height: 75vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
  margin-bottom: 80px;
}

@media (min-width: 768px) {
  .modal-content {
    border-radius: 20px;
    max-height: 90vh;
    margin-bottom: 0;
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
  flex-shrink: 0;
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
  overflow-y: auto;
  flex: 1;
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
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  padding-bottom: 24px;
  border-top: 1px solid #e5e7eb;
  background: white;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.modal-btn {
  width: 100%;
  min-height: 44px;
}

@media (min-width: 768px) {
  .modal-actions {
    flex-direction: row;
    padding-bottom: 20px;
  }
  
  .modal-btn {
    flex: 1;
  }
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .modal-content {
    margin-bottom: calc(80px + env(safe-area-inset-bottom));
  }
  
  .modal-actions {
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
  }
}
</style>
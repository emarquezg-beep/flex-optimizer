<script setup>
import { ref, computed, onMounted } from 'vue'
import { Home, TrendingUp, MapPin, Clock, Navigation, Flame } from 'lucide-vue-next'
import { BaseButton, BaseCard, BaseInput } from '@/components/base'

const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const USERS = [
  { name: 'Ernesto', id: 'b5a04a69-1e96-47c4-a0c8-972fec54c21d' },
  { name: 'Carmen Cecilia', id: 'b3aaad3a-5835-4796-aca7-ea634e150b5d' }
]
const selectedUserId = ref(USERS[1].id)

// Estados
const isLoading = ref(true)
const hasActiveRoute = ref(false)
const activeRoute = ref(null)
const currentStopInput = ref('')
const isCalculating = ref(false)
const liveETAs = ref(null)
const etaRealInput = ref('')
const isCompleting = ref(false)
const completionStatus = ref(null)

// 🚧 TEMPORAL: Auto-detección de usuario
// TODO v4.2: Reemplazar con usuario autenticado
// const currentUser = await supabase.auth.getUser()
// selectedUserId.value = currentUser.id
onMounted(async () => {
  await autoDetectActiveRoute()
})
// 🆕 FUNCIÓN HELPER: Intentar cargar ruta de un usuario específico
async function tryLoadRoute(userId) {
  try {
    console.log(`🔍 Intentando cargar ruta para: ${USERS.find(u => u.id === userId)?.name}`)
    
    const response = await fetch(`${backendUrl}/api/active-route/${userId}`)
    const result = await response.json()
    
    if (result.hasActiveRoute) {
      console.log(`✅ Ruta activa encontrada para: ${USERS.find(u => u.id === userId)?.name}`)
      selectedUserId.value = userId
      hasActiveRoute.value = true
      activeRoute.value = result.route
      return true
    }
    
    console.log(`❌ No hay ruta activa para: ${USERS.find(u => u.id === userId)?.name}`)
    return false
    
  } catch (error) {
    console.error(`❌ Error cargando ruta para userId ${userId}:`, error)
    return false
  }
}
// 🆕 FUNCIÓN: Auto-detectar qué usuario tiene ruta activa
async function autoDetectActiveRoute() {
  isLoading.value = true
  hasActiveRoute.value = false
  activeRoute.value = null
  
  try {
    console.log('🔄 Buscando ruta activa para cualquier usuario...')
    
    // Intentar con cada usuario en orden
    for (const user of USERS) {
      const found = await tryLoadRoute(user.id)
      if (found) {
        console.log(`🎯 Usando ruta de: ${user.name}`)
        break // Salir del loop si encontró una ruta
      }
    }
    
    if (!hasActiveRoute.value) {
      console.log('ℹ️ No hay rutas activas para ningún usuario')
    }
    
  } catch (error) {
    console.error('❌ Error en auto-detección:', error)
    hasActiveRoute.value = false
  } finally {
    isLoading.value = false
  }
}
async function loadActiveRoute() {
  isLoading.value = true
  try {
    const response = await fetch(`${backendUrl}/api/active-route/${selectedUserId.value}`)
    const result = await response.json()
    
    if (result.hasActiveRoute) {
      hasActiveRoute.value = true
      activeRoute.value = result.route
      console.log('✅ Ruta activa cargada:', activeRoute.value)
    } else {
      hasActiveRoute.value = false
      console.log('ℹ️ No hay ruta activa')
    }
  } catch (error) {
    console.error('❌ Error cargando ruta activa:', error)
    hasActiveRoute.value = false
  } finally {
    isLoading.value = false
  }
}

async function calculateLiveETA() {
  const stopNumber = parseInt(currentStopInput.value)
  
  if (!stopNumber || stopNumber < 2) {
    alert('Por favor, ingresa un número de parada válido (≥2)')
    return
  }
  
  if (stopNumber > activeRoute.value.numero_paradas) {
    alert(`El número de parada no puede ser mayor a ${activeRoute.value.numero_paradas}`)
    return
  }

  isCalculating.value = true
  liveETAs.value = null

  try {
    const response = await fetch(`${backendUrl}/api/calculate-live-eta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId: activeRoute.value.id,
        currentStopNumber: stopNumber
      })
    })

    const result = await response.json()

    if (result.success) {
      liveETAs.value = result
      console.log('🔥 ETAs en caliente calculados:', result)
    } else {
      throw new Error(result.error || 'Error calculando ETAs')
    }
  } catch (error) {
    console.error('❌ Error calculando live ETA:', error)
    alert(`Error: ${error.message}`)
  } finally {
    isCalculating.value = false
  }
}

async function completeRoute() {
  if (!etaRealInput.value || !etaRealInput.value.trim()) {
    alert('Por favor, ingresa la hora real de llegada (ej: 5:11 PM)')
    return
  }
  
  const timePattern = /^\d{1,2}:\d{2}\s?(AM|PM)$/i
  if (!timePattern.test(etaRealInput.value.trim())) {
    alert('Formato inválido. Usa: "5:11 PM" o "11:30 AM"')
    return
  }

  isCompleting.value = true
  completionStatus.value = null

  try {
    const response = await fetch(`${backendUrl}/api/complete-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId: activeRoute.value.id,
        etaReal: etaRealInput.value.trim()
      })
    })

    const result = await response.json()

    if (result.success) {
      completionStatus.value = {
        success: true,
        message: '✅ ¡Ruta completada! ETA real guardado.'
      }
      
      setTimeout(() => {
        hasActiveRoute.value = false
        activeRoute.value = null
        liveETAs.value = null
        etaRealInput.value = ''
      }, 2000)
    } else {
      throw new Error(result.message || 'Error completando ruta')
    }
  } catch (error) {
    console.error('❌ Error completando ruta:', error)
    completionStatus.value = {
      success: false,
      message: `Error: ${error.message}`
    }
  } finally {
    isCompleting.value = false
  }
}

const routeProgress = computed(() => {
  if (!activeRoute.value || !liveETAs.value) return 0
  const remaining = liveETAs.value.remainingStops
  const total = activeRoute.value.numero_paradas
  return Math.round(((total - remaining) / total) * 100)
})

const canComplete = computed(() => {
  return liveETAs.value !== null
})
</script>

<template>
  <div class="live-eta-view">
    
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner-large"></div>
      <p class="loading-text">Cargando ruta activa...</p>
    </div>

    <!-- No Active Route -->
    <div v-else-if="!hasActiveRoute" class="empty-state">
      <div class="empty-icon">
        <MapPin :size="64" :stroke-width="1.5" />
      </div>
      <h2 class="empty-title">No hay ruta activa</h2>
      <p class="empty-description">Aún no has iniciado ninguna ruta hoy.</p>
      <router-link to="/upload">
        <BaseButton variant="primary" size="lg">
          Crear Nueva Ruta
        </BaseButton>
      </router-link>
    </div>

    <!-- Active Route Exists -->
    <div v-else class="content-container">
      
      <!-- Route Header Card -->
      <BaseCard padding="lg" class="route-header-card" elevated>
        <div class="route-badge">
          <div class="badge-icon-wrapper">
            <Flame :size="32" class="badge-icon" />
          </div>
          <div class="badge-content">
            <h1 class="route-title">Ruta en Vivo</h1>
            <p class="route-subtitle">
              {{ activeRoute.warehouse }} · {{ activeRoute.primary_city }}
            </p>
          </div>
        </div>
        
        <div class="route-meta-grid">
          <div class="meta-stat">
            <Clock :size="16" class="meta-icon" />
            <div class="meta-content">
              <span class="meta-label">Inicio</span>
              <span class="meta-value">{{ activeRoute.hora }}</span>
            </div>
          </div>
          
          <div class="meta-stat">
            <TrendingUp :size="16" class="meta-icon" />
            <div class="meta-content">
              <span class="meta-label">Duración</span>
              <span class="meta-value">{{ activeRoute.duracion_horas }}h</span>
            </div>
          </div>
          
          <div class="meta-stat">
            <MapPin :size="16" class="meta-icon" />
            <div class="meta-content">
              <span class="meta-label">Paradas</span>
              <span class="meta-value">{{ activeRoute.numero_paradas }}</span>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- Progress Bar -->
      <BaseCard v-if="liveETAs" padding="md" class="progress-card" elevated>
        <div class="progress-header">
          <span class="progress-label">Progreso de Ruta</span>
          <span class="progress-percentage">{{ routeProgress }}%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: routeProgress + '%' }"></div>
        </div>
        <p class="progress-detail">
          {{ activeRoute.numero_paradas - liveETAs.remainingStops }} de {{ activeRoute.numero_paradas }} paradas completadas
        </p>
      </BaseCard>

      <!-- Live Calculation Section -->
      <BaseCard padding="lg" class="calculation-card">
        <div class="section-header">
          <h2 class="section-title">🔥 Cálculo en Caliente</h2>
          <p class="section-description">
            Ingresa en qué parada estás para recalcular tu ETA
          </p>
        </div>
        
        <div class="input-row">
          <BaseInput
            v-model="currentStopInput"
            type="number"
            :min="2"
            :max="activeRoute.numero_paradas"
            placeholder="Ej: 15"
            label="¿En qué parada estás?"
            :disabled="isCalculating"
            class="stop-input"
          />
          <BaseButton
            @click="calculateLiveETA"
            variant="primary"
            size="lg"
            :loading="isCalculating"
            :disabled="isCalculating"
            class="calc-button"
          >
            {{ isCalculating ? 'Calculando...' : 'Calcular' }}
          </BaseButton>
        </div>

        <!-- ETA Results -->
        <div v-if="liveETAs" class="eta-results">
          <div class="results-header">
            <h3 class="results-title">⏱️ Llegada Estimada</h3>
            <div class="results-stats">
              <span class="stat-item">
                <MapPin :size="14" />
                {{ liveETAs.remainingStops }} paradas
              </span>
              <span class="stat-item">
                <Navigation :size="14" />
                {{ liveETAs.remainingMiles }} mi
              </span>
            </div>
          </div>

          <div class="eta-cards-grid">
            <div class="eta-card eta-card--optimistic">
              <div class="eta-card-header">
                <span class="eta-emoji">😊</span>
                <span class="eta-label">Optimista</span>
              </div>
              <div class="eta-time">{{ liveETAs.etas.optimistic.eta }}</div>
              <div class="eta-duration">{{ liveETAs.etas.optimistic.totalMinutes }} min</div>
            </div>
            
            <div class="eta-card eta-card--normal">
              <div class="eta-card-header">
                <span class="eta-emoji">😐</span>
                <span class="eta-label">Normal</span>
              </div>
              <div class="eta-time">{{ liveETAs.etas.normal.eta }}</div>
              <div class="eta-duration">{{ liveETAs.etas.normal.totalMinutes }} min</div>
            </div>
            
            <div class="eta-card eta-card--pessimistic">
              <div class="eta-card-header">
                <span class="eta-emoji">😰</span>
                <span class="eta-label">Pesimista</span>
              </div>
              <div class="eta-time">{{ liveETAs.etas.pessimistic.eta }}</div>
              <div class="eta-duration">{{ liveETAs.etas.pessimistic.totalMinutes }} min</div>
            </div>
          </div>

          <!-- Technical Details -->
          <details class="tech-details">
            <summary class="tech-summary">Ver detalles técnicos</summary>
            <div class="tech-grid">
              <div class="tech-item">
                <span class="tech-label">Drive Base</span>
                <span class="tech-value">{{ liveETAs.breakdown.baseDriveMinutes }} min</span>
              </div>
              <div class="tech-item">
                <span class="tech-label">Paradas</span>
                <span class="tech-value">{{ liveETAs.breakdown.stopCount }}</span>
              </div>
              <div class="tech-item">
                <span class="tech-label">Apartamentos</span>
                <span class="tech-value">{{ liveETAs.breakdown.aptCount }}</span>
              </div>
              <div class="tech-item">
                <span class="tech-label">Downtown</span>
                <span class="tech-value">{{ liveETAs.breakdown.downtownCount }}</span>
              </div>
            </div>
          </details>
        </div>
      </BaseCard>

      <!-- Complete Route Section -->
      <BaseCard padding="lg" class="completion-card">
        <div class="section-header">
          <h2 class="section-title">✅ Completar Ruta</h2>
          <p class="section-description">
            Ingresa la hora REAL que te mostró tu GPS al llegar
          </p>
        </div>

        <!-- Original Predictions -->
        <div class="predictions-box">
          <h4 class="predictions-title">📊 Predicciones Originales</h4>
          <div class="predictions-list">
            <div class="prediction-item">
              <span class="prediction-label">Optimista</span>
              <span class="prediction-value">{{ activeRoute.eta_optimista }}</span>
            </div>
            <div class="prediction-item">
              <span class="prediction-label">Normal</span>
              <span class="prediction-value">{{ activeRoute.eta_normal }}</span>
            </div>
            <div class="prediction-item">
              <span class="prediction-label">Pesimista</span>
              <span class="prediction-value">{{ activeRoute.eta_pesimista }}</span>
            </div>
          </div>
        </div>

        <!-- ETA Real Input -->
        <div class="completion-input-group">
          <BaseInput
            v-model="etaRealInput"
            type="text"
            placeholder="Ej: 5:11 PM"
            label="¿A qué hora llegaste realmente? 🏁"
            :disabled="isCompleting || !canComplete"
            :helper-text="canComplete ? 'Formato: 5:11 PM o 11:30 AM' : ''"
          />
          
          <p v-if="!canComplete" class="warning-text">
            ⚠️ Primero calcula el ETA en caliente
          </p>
          
          <BaseButton
            @click="completeRoute"
            variant="primary"
            size="lg"
            full-width
            :loading="isCompleting"
            :disabled="isCompleting || !canComplete"
          >
            {{ isCompleting ? 'Guardando...' : '💾 Guardar y Finalizar' }}
          </BaseButton>
        </div>

        <!-- Completion Status -->
        <div v-if="completionStatus" :class="['status-alert', completionStatus.success ? 'status-alert--success' : 'status-alert--error']">
          {{ completionStatus.message }}
        </div>
      </BaseCard>

      <div class="bottom-spacer"></div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== LAYOUT ==================== */
.live-eta-view {
  min-height: 100vh;
  background-color: var(--bg-primary);
  padding-bottom: calc(var(--bottom-nav-height) + var(--space-4));
}

.content-container {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bottom-spacer {
  height: var(--space-4);
}

/* ==================== LOADING STATE ==================== */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-4);
}

.spinner-large {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-primary);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--text-base);
  color: var(--text-secondary); /* 🔥 Nuevo gris oscuro */
}

/* ==================== EMPTY STATE ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: var(--space-6);
  gap: var(--space-4);
}

.empty-icon {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.empty-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-secondary); /* 🔥 Mejor contraste */
  max-width: 320px;
  margin: 0;
}

/* ==================== ROUTE HEADER CARD ==================== */
.route-badge {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.badge-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  border-radius: var(--radius-lg);
  flex-shrink: 0;
  box-shadow: var(--shadow-md); /* 🆕 */
}

.badge-icon {
  color: white;
}

.badge-content {
  flex: 1;
}

.route-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
  line-height: 1.2;
}

.route-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary); /* 🔥 Mejor contraste */
  margin: 0;
}

.route-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.meta-stat {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.meta-icon {
  color: var(--brand-accent);
  flex-shrink: 0;
}

.meta-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.meta-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.meta-value {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==================== PROGRESS CARD ==================== */
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.progress-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary); /* 🔥 */
}

.progress-percentage {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--brand-accent);
}

.progress-bar-container {
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-2);
  box-shadow: inset var(--shadow-xs); /* 🆕 */
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-accent), var(--brand-primary));
  border-radius: var(--radius-full);
  transition: width 0.5s var(--ease-out);
  box-shadow: var(--shadow-sm); /* 🆕 */
}

.progress-detail {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-align: center;
  margin: 0;
}

/* ==================== SECTION HEADERS ==================== */
.section-header {
  margin-bottom: var(--space-5);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.section-description {
  font-size: var(--text-sm);
  color: var(--text-secondary); /* 🔥 Mejor contraste */
  line-height: var(--leading-relaxed);
  margin: 0;
}

/* ==================== INPUT ROW ==================== */
.input-row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  margin-bottom: var(--space-5);
}

.stop-input {
  flex: 1;
}

.calc-button {
  flex-shrink: 0;
}

/* ==================== ETA RESULTS ==================== */
.eta-results {
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-secondary);
}

.results-header {
  margin-bottom: var(--space-4);
}

.results-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3) 0;
}

.results-stats {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary); /* 🔥 */
}

/* 🔥 ETA CARDS - MEJORADO */
.eta-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.eta-card {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 2px solid;
  text-align: center;
  transition: all var(--transition-base);
  background-color: var(--bg-primary); /* 🔥 Fondo blanco */
  box-shadow: var(--shadow-sm); /* 🆕 */
}

.eta-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md); /* 🔥 */
}

.eta-card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.eta-emoji {
  font-size: 24px;
}

.eta-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.eta-time {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.eta-duration {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.eta-card--optimistic {
  border-color: var(--success);
}

.eta-card--optimistic .eta-label {
  color: var(--success);
}

.eta-card--normal {
  border-color: var(--warning);
}

.eta-card--normal .eta-label {
  color: var(--warning);
}

.eta-card--pessimistic {
  border-color: var(--error);
}

.eta-card--pessimistic .eta-label {
  color: var(--error);
}

/* ==================== TECHNICAL DETAILS ==================== */
.tech-details {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-base);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-xs); /* 🆕 */
}

.tech-summary {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--brand-accent);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.tech-summary::-webkit-details-marker {
  display: none;
}

.tech-summary:hover {
  color: var(--brand-accent-hover);
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.tech-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background-color: var(--bg-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
}

.tech-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.tech-value {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* ==================== PREDICTIONS BOX ==================== */
.predictions-box {
  padding: var(--space-4);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-5);
  box-shadow: var(--shadow-xs); /* 🆕 */
}

.predictions-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary); /* 🔥 */
  margin: 0 0 var(--space-3) 0;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.predictions-list {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.prediction-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.prediction-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.prediction-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* ==================== COMPLETION INPUT ==================== */
.completion-input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.warning-text {
  font-size: var(--text-sm);
  color: var(--warning);
  margin: 0;
  padding: var(--space-3);
  background-color: var(--warning-bg);
  border-radius: var(--radius-base);
  border-left: 3px solid var(--warning);
}

/* ==================== STATUS ALERT ==================== */
.status-alert {
  padding: var(--space-4);
  border-radius: var(--radius-base);
  font-weight: var(--font-medium);
  text-align: center;
  animation: slideDown 0.3s var(--ease-out);
  box-shadow: var(--shadow-sm); /* 🆕 */
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-alert--success {
  background-color: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success);
}

.status-alert--error {
  background-color: var(--error-bg);
  color: var(--error);
  border: 1px solid var(--error);
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .content-container {
    padding: var(--space-3);
    gap: var(--space-3);
  }

  .route-meta-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .input-row {
    flex-direction: column;
    align-items: stretch;
  }

  .calc-button {
    width: 100%;
  }

  .eta-cards-grid {
    grid-template-columns: 1fr;
  }

  .predictions-list {
    flex-direction: column;
    gap: var(--space-3);
  }

  .tech-grid {
    grid-template-columns: 1fr;
  }

  .badge-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .badge-icon {
    width: 24px;
    height: 24px;
  }

  .route-title {
    font-size: var(--text-xl);
  }
}

/* ==================== ANIMATIONS ==================== */
.route-header-card,
.progress-card,
.calculation-card,
.completion-card {
  animation: fadeInUp 0.4s var(--ease-out);
  animation-fill-mode: both;
}

.progress-card {
  animation-delay: 0.1s;
}

.calculation-card {
  animation-delay: 0.2s;
}

.completion-card {
  animation-delay: 0.3s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Smooth scroll */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}
</style>
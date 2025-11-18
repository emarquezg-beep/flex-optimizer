<template>
  <div class="summary-slide">
    <!-- FRI Score Hero -->
    <div class="fri-hero">
      <div class="fri-label">FRI Score</div>
      <div class="fri-score" :class="friScoreClass">
        {{ displayFriScore }}
      </div>
      <div class="fri-badge" :class="friBadgeClass">
        {{ friBadgeText }}
      </div>
    </div>

    <!-- ETA Comparison -->
    <div class="eta-section">
      <div class="eta-title">⏱️ Tiempo de Llegada</div>
      <div class="eta-comparison">
        <div class="eta-item">
          <span class="eta-label">Esperado</span>
          <span class="eta-value">{{ formatTime(routeData.eta_normal) }}</span>
        </div>
        <div class="eta-divider">→</div>
        <div class="eta-item">
          <span class="eta-label">Real</span>
          <span class="eta-value real" :class="etaStatusClass">
            {{ formatTime(routeData.eta_real) }}
          </span>
        </div>
      </div>
      <div class="eta-status" :class="etaStatusClass">
        {{ etaStatusText }}
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="quick-stats">
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-value">${{ netEarnings.toFixed(2) }}</div>
        <div class="stat-label">Ganancia Neta</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-value">${{ routeData.pago_real_por_hora?.toFixed(2) || '0.00' }}</div>
        <div class="stat-label">$/Hora Real</div>
      </div>
    </div>

    <!-- Route Quality Indicator -->
    <div class="route-quality" :class="routeQualityClass">
      {{ routeQualityText }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  routeData: {
    type: Object,
    required: true
  }
})

// FRI Score (0-10)
const displayFriScore = computed(() => {
  const score = props.routeData.route_score || 0
  return score.toFixed(1)
})

const friScoreClass = computed(() => {
  const score = props.routeData.route_score || 0
  if (score >= 7) return 'score-good'
  if (score >= 4) return 'score-medium'
  return 'score-bad'
})

const friBadgeClass = computed(() => {
  const score = props.routeData.route_score || 0
  if (score >= 7) return 'badge-good'
  if (score >= 4) return 'badge-medium'
  return 'badge-bad'
})

const friBadgeText = computed(() => {
  const score = props.routeData.route_score || 0
  if (score >= 7) return '✅ Excelente Ruta'
  if (score >= 4) return '⚠️ Ruta Normal'
  return '❌ Ruta Difícil'
})

// ETA Status
const etaStatusClass = computed(() => {
  if (!props.routeData.eta_normal || !props.routeData.eta_real) return ''
  
  const expected = timeToMinutes(props.routeData.eta_normal)
  const actual = timeToMinutes(props.routeData.eta_real)
  const diff = actual - expected

  if (diff <= 0) return 'eta-early'
  if (diff <= 15) return 'eta-ontime'
  return 'eta-late'
})

const etaStatusText = computed(() => {
  if (!props.routeData.eta_normal || !props.routeData.eta_real) return ''
  
  const expected = timeToMinutes(props.routeData.eta_normal)
  const actual = timeToMinutes(props.routeData.eta_real)
  const diff = actual - expected

  if (diff <= 0) return `✅ Llegaste ${Math.abs(diff)} min antes`
  if (diff <= 15) return `✅ Llegaste a tiempo (+${diff} min)`
  return `⚠️ Llegaste ${diff} min tarde`
})

// Net Earnings
const netEarnings = computed(() => {
  const pago = props.routeData.pago || 0
  const gastos = (props.routeData.gasto_de_gasolina || 0) + 
                 (props.routeData.desgaste_vehiculo || 0) + 
                 (props.routeData.tax || 0)
  return pago - gastos
})

// Route Quality
const routeQualityClass = computed(() => {
  const score = props.routeData.route_score || 0
  const hourlyRate = props.routeData.pago_real_por_hora || 0
  
  if (score >= 7 && hourlyRate >= 20) return 'quality-excellent'
  if (score >= 4 && hourlyRate >= 15) return 'quality-good'
  return 'quality-poor'
})

const routeQualityText = computed(() => {
  const score = props.routeData.route_score || 0
  const hourlyRate = props.routeData.pago_real_por_hora || 0
  
  if (score >= 7 && hourlyRate >= 20) return '🎉 Esta fue una ruta excelente!'
  if (score >= 4 && hourlyRate >= 15) return '👍 Ruta aceptable'
  return '😤 Ruta que desgasta'
})

// Helpers
const formatTime = (time) => {
  if (!time) return '--:--'
  // Si time es string tipo "14:30:00"
  if (typeof time === 'string') {
    return time.slice(0, 5) // "14:30"
  }
  return time
}

const timeToMinutes = (time) => {
  if (!time) return 0
  const parts = time.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}
</script>

<style scoped>
.summary-slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

/* FRI Score Hero */
.fri-hero {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  color: white;
}

.fri-label {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
  margin-bottom: 8px;
}

.fri-score {
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  margin: 12px 0;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.fri-badge {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 30px;
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}

.badge-good {
  background: rgba(34, 197, 94, 0.3);
  border: 2px solid rgba(34, 197, 94, 0.6);
}

.badge-medium {
  background: rgba(251, 191, 36, 0.3);
  border: 2px solid rgba(251, 191, 36, 0.6);
}

.badge-bad {
  background: rgba(239, 68, 68, 0.3);
  border: 2px solid rgba(239, 68, 68, 0.6);
}

/* ETA Section */
.eta-section {
  background: #f8fafc;
  padding: 20px;
  border-radius: 16px;
  border: 2px solid #e2e8f0;
}

.eta-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 16px;
  text-align: center;
}

.eta-comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.eta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.eta-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.eta-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.eta-value.real.eta-early {
  color: #22c55e;
}

.eta-value.real.eta-ontime {
  color: #3b82f6;
}

.eta-value.real.eta-late {
  color: #ef4444;
}

.eta-divider {
  font-size: 24px;
  color: #cbd5e1;
  font-weight: 300;
}

.eta-status {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  margin-top: 12px;
}

.eta-status.eta-early,
.eta-status.eta-ontime {
  background: #dcfce7;
  color: #166534;
}

.eta-status.eta-late {
  background: #fee2e2;
  color: #991b1b;
}

/* Quick Stats */
.quick-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

/* Route Quality */
.route-quality {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
}

.quality-excellent {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.quality-good {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.quality-poor {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

/* Mobile Adjustments */
@media (max-width: 640px) {
  .fri-score {
    font-size: 56px;
  }

  .eta-value {
    font-size: 24px;
  }

  .stat-value {
    font-size: 20px;
  }
}
</style>
<template>
  <div class="time-slide">
    <h2 class="slide-title">🚗 Tiempo & Millaje</h2>

    <!-- Time Breakdown -->
    <div class="time-section">
      <div class="section-header">
        <span class="icon">⏱️</span>
        <span class="title">Desglose de Tiempo</span>
      </div>
      
      <div class="time-bars">
        <div class="time-bar">
          <div class="bar-info">
            <span class="bar-label">Commute 1 (Casa → Warehouse)</span>
            <span class="bar-value">{{ formatHours(routeData.antes_del_bloque) }}</span>
          </div>
          <div class="bar-visual">
            <div class="bar-fill commute" :style="{ width: commute1Percentage + '%' }"></div>
          </div>
        </div>

        <div class="time-bar">
          <div class="bar-info">
            <span class="bar-label">Trabajo (Warehouse → Última Parada)</span>
            <span class="bar-value">{{ formatHours(routeData.duracion_horas) }}</span>
          </div>
          <div class="bar-visual">
            <div class="bar-fill work" :style="{ width: workPercentage + '%' }"></div>
          </div>
        </div>

        <div class="time-bar">
          <div class="bar-info">
            <span class="bar-label">Commute 2 (Última Parada → Destino)</span>
            <span class="bar-value">{{ formatHours(routeData.despues_del_bloque) }}</span>
          </div>
          <div class="bar-visual">
            <div class="bar-fill commute" :style="{ width: commute2Percentage + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="time-total">
        <span class="total-label">Tiempo Total Invertido</span>
        <span class="total-value">{{ formatHours(routeData.tiempo_total) }}</span>
      </div>
    </div>

    <!-- Mileage Breakdown -->
    <div class="mileage-section">
      <div class="section-header">
        <span class="icon">📍</span>
        <span class="title">Desglose de Millas</span>
      </div>

      <div class="mileage-grid">
        <div class="mileage-card">
          <div class="card-icon">🏠</div>
          <div class="card-value">{{ routeData.commute_1?.toFixed(1) || '0.0' }}</div>
          <div class="card-label">Commute 1</div>
        </div>

        <div class="mileage-card work-card">
          <div class="card-icon">📦</div>
          <div class="card-value">{{ routeData.millas_de_trabajo?.toFixed(1) || '0.0' }}</div>
          <div class="card-label">Trabajo</div>
        </div>

        <div class="mileage-card">
          <div class="card-icon">🎯</div>
          <div class="card-value">{{ routeData.commute_2?.toFixed(1) || '0.0' }}</div>
          <div class="card-label">Commute 2</div>
        </div>
      </div>

      <div class="mileage-total">
        <div class="total-row">
          <span class="total-label">Millas Totales</span>
          <span class="total-value">{{ routeData.millas_totales?.toFixed(1) || '0.0' }} mi</span>
        </div>
        <div class="total-row">
          <span class="total-label">Eficiencia</span>
          <span class="total-value efficiency">{{ routeData.millas_por_hora?.toFixed(1) || '0.0' }} mi/hr</span>
        </div>
      </div>
    </div>

    <!-- Route Details -->
    <div class="route-details">
      <div class="detail-item">
        <span class="detail-icon">🏢</span>
        <span class="detail-text">{{ routeData.warehouse }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-icon">🏙️</span>
        <span class="detail-text">{{ routeData.primary_city || 'N/A' }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-icon">📍</span>
        <span class="detail-text">{{ routeData.numero_paradas || 0 }} paradas</span>
      </div>
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

// Time percentages for visual bars
const totalTime = computed(() => props.routeData.tiempo_total || 1)

const commute1Percentage = computed(() => {
  return ((props.routeData.antes_del_bloque || 0) / totalTime.value) * 100
})

const workPercentage = computed(() => {
  return ((props.routeData.duracion_horas || 0) / totalTime.value) * 100
})

const commute2Percentage = computed(() => {
  return ((props.routeData.despues_del_bloque || 0) / totalTime.value) * 100
})

// Helpers
const formatHours = (hours) => {
  if (!hours) return '0h 0m'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}
</script>

<style scoped>
.time-slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.slide-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  text-align: center;
  margin: 0 0 8px 0;
}

/* Section Headers */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.section-header .icon {
  font-size: 20px;
}

.section-header .title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
}

/* Time Section */
.time-section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  border: 2px solid #e2e8f0;
}

.time-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.time-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bar-label {
  font-size: 13px;
  color: #64748b;
}

.bar-value {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.bar-visual {
  width: 100%;
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.6s ease-out;
}

.bar-fill.commute {
  background: linear-gradient(90deg, #94a3b8 0%, #64748b 100%);
}

.bar-fill.work {
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
}

.time-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  border: 2px solid #cbd5e1;
  margin-top: 8px;
}

.time-total .total-label {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.time-total .total-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

/* Mileage Section */
.mileage-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  border: 2px solid #e2e8f0;
}

.mileage-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.mileage-card {
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  border: 2px solid #e2e8f0;
}

.mileage-card.work-card {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.card-icon {
  font-size: 24px;
  margin-bottom: 6px;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 2px;
}

.card-label {
  font-size: 11px;
  color: #64748b;
}

.mileage-total {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 2px solid #e2e8f0;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.total-row .total-label {
  font-size: 14px;
  color: #64748b;
}

.total-row .total-value {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.total-row .total-value.efficiency {
  color: #3b82f6;
}

/* Route Details */
.route-details {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
}

.detail-icon {
  font-size: 16px;
}

.detail-text {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}

/* Mobile */
@media (max-width: 640px) {
  .mileage-grid {
    grid-template-columns: 1fr;
  }

  .bar-label {
    font-size: 12px;
  }
}
</style>
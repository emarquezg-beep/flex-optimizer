<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, required: true },
  selectedScenario: { type: String, required: true }
});

const emit = defineEmits(['update:selectedScenario']);

// Función helper para formatear el resumen de paradas
const getStopSummary = (data) => {
  // Asumiendo que data.numero_paradas es el total
  // Y si tuviéramos info de apts desglosada en el payload, la usaríamos.
  // Por ahora usamos el total genérico, pero preparado para el futuro.
  return `${data.numero_paradas} stops`;
};

// Helper para ARIA (si no viene en data, usamos default)
const getAriaLabel = (data) => {
  // Aquí podrías pasar el multiplier real si lo guardamos en el payload
  // Por ahora simulamos el formato visual
  return 'ARIA Active'; 
};
</script>

<template>
  <div class="slide-content split-layout">
    <div 
      class="split-side normal-side" 
      :class="{ 'is-active': selectedScenario === 'normal' }"
      @click="emit('update:selectedScenario', 'normal')"
    >
      <div class="aria-badge">🤖</div>

      <div class="selection-indicator">
        <div class="radio-circle">
          <div v-if="selectedScenario === 'normal'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">NORMAL</span>
      </div>

      <div class="hero-score">
        <span class="score-val">{{ normalData.route_score }}</span>
        <span class="score-max">/100</span>
        <div class="stop-summary">
          {{ getStopSummary(normalData) }}
        </div>
      </div>
      
      <div class="hero-metrics">
        <div class="metric">
          <span class="icon">⏱️</span>
          <span class="val">{{ normalData.eta_normal }}</span>
        </div>
        <div class="metric">
          <span class="icon">📏</span>
          <span class="val">{{ normalData.millas_totales }} mi</span>
        </div>
        <div class="metric">
          <span class="icon">💰</span>
          <span class="val">${{ normalData.pago_real_por_hora }}/h</span>
        </div>
      </div>
    </div>

    <div 
      class="split-side inverse-side" 
      :class="{ 'is-active': selectedScenario === 'inverse' }"
      @click="emit('update:selectedScenario', 'inverse')"
    >
      <div class="aria-badge">🤖</div>

      <div class="selection-indicator">
        <div class="radio-circle">
          <div v-if="selectedScenario === 'inverse'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">INVERSA</span>
      </div>

      <div class="hero-score">
        <span class="score-val">{{ inverseData.route_score }}</span>
        <span class="score-max">/100</span>
        <div class="stop-summary">
          {{ getStopSummary(inverseData) }}
        </div>
      </div>

      <div class="hero-metrics">
        <div class="metric">
          <span class="icon">⏱️</span>
          <span class="val">{{ inverseData.eta_normal }}</span>
        </div>
        <div class="metric">
          <span class="icon">📏</span>
          <span class="val">{{ inverseData.millas_totales }} mi</span>
        </div>
        <div class="metric">
          <span class="icon">💰</span>
          <span class="val">${{ inverseData.pago_real_por_hora }}/h</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-content {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: row;
  padding: 0;
}

.split-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px 5px;
  transition: all 0.3s ease;
  border-bottom: 4px solid transparent;
  cursor: pointer;
  background-color: var(--bg-secondary);
  opacity: 0.6;
  position: relative; /* Para posicionar el badge */
}

.split-side.is-active {
  background-color: var(--bg-primary);
  opacity: 1;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
}

.normal-side.is-active { border-bottom-color: #4facfe; }
.inverse-side.is-active { border-bottom-color: #ff9a9e; }

/* ARIA Badge */
.aria-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 1.2rem;
  filter: grayscale(100%);
  opacity: 0.5;
  transition: all 0.3s;
}

.is-active .aria-badge {
  filter: grayscale(0%);
  opacity: 1;
  transform: scale(1.1);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Radio styles */
.selection-indicator {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.scenario-label {
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.radio-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.is-active .radio-circle {
  border-color: var(--brand-primary);
  background-color: rgba(255,255,255,0.1);
}

.radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--brand-primary);
}

/* Hero Score */
.hero-score {
  margin-bottom: 15px;
  text-align: center;
}
.score-val {
  font-size: 2.8rem;
  font-weight: 800;
  line-height: 1;
  color: var(--text-primary);
}
.score-max {
  font-size: 0.8rem;
  color: var(--text-secondary);
  vertical-align: top;
}
.stop-summary {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.2);
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 5px;
  display: inline-block;
}

/* Metrics */
.hero-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 0 8px;
}

.metric {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  background: rgba(0,0,0,0.1);
  padding: 6px 8px;
  border-radius: 6px;
}
.metric .icon { font-size: 1rem; }
.metric .val { font-weight: bold; margin-left: auto; color: var(--text-primary); }
</style>
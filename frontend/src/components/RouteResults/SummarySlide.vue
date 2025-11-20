<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, required: true },
  selectedScenario: { type: String, required: true }
});

const emit = defineEmits(['update:selectedScenario']);

// 🧠 Helper Inteligente para Paradas
const getStopSummary = (data) => {
  // Sumamos apartamentos normales + downtown
  const totalApts = (data.apartment_count || 0) + (data.downtown_count || 0);
  const stops = data.numero_paradas || 0;

  if (totalApts > 0) {
    // Ej: "31 stops • 5 Apts"
    return `${stops} stops • ${totalApts} Apts`; 
  }
  return `${stops} stops`;
};

// 🧠 Helper para Factor ARIA
const getAriaFactor = (data) => {
  const mult = data.aria_multiplier || 0.9;
  return `x${Number(mult).toFixed(2)}`;
};
</script>

<template>
  <div class="slide-content split-layout">
    <div 
      class="split-side normal-side" 
      :class="{ 'is-active': selectedScenario === 'normal' }"
      @click="emit('update:selectedScenario', 'normal')"
    >
      <div class="aria-badge" title="ARIA Intelligence Active">
        <span class="aria-icon">🤖</span>
        <span class="aria-val">{{ getAriaFactor(normalData) }}</span>
      </div>

      <div class="selection-indicator">
        <div class="radio-circle">
          <div v-if="selectedScenario === 'normal'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">NORMAL</span>
      </div>

      <div class="hero-score">
        <span class="score-val">{{ normalData.route_score }}</span>
        <span class="score-max">/100</span>
        
        <div class="stop-summary-pill" :class="{ 'has-apts': (normalData.apartment_count + normalData.downtown_count) > 0 }">
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
      <div class="aria-badge" title="ARIA Intelligence Active">
        <span class="aria-icon">🤖</span>
        <span class="aria-val">{{ getAriaFactor(inverseData) }}</span>
      </div>

      <div class="selection-indicator">
        <div class="radio-circle">
          <div v-if="selectedScenario === 'inverse'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">INVERSA</span>
      </div>

      <div class="hero-score">
        <span class="score-val">{{ inverseData.route_score }}</span>
        <span class="score-max">/100</span>
        
        <div class="stop-summary-pill" :class="{ 'has-apts': (inverseData.apartment_count + inverseData.downtown_count) > 0 }">
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
  position: relative;
}

.split-side.is-active {
  background-color: var(--bg-primary);
  opacity: 1;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
}

.normal-side.is-active { border-bottom-color: #4facfe; }
.inverse-side.is-active { border-bottom-color: #ff9a9e; }

/* ARIA Badge Mejorado */
.aria-badge {
  position: absolute;
  top: 10px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(0,0,0,0.3);
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.3s;
}

.aria-icon { font-size: 1.1rem; }
.aria-val { 
  font-size: 0.75rem; 
  font-weight: bold; 
  color: var(--text-secondary); 
}

.is-active .aria-badge {
  background: rgba(59, 130, 246, 0.2); /* Azulito */
  border-color: rgba(59, 130, 246, 0.5);
}
.is-active .aria-val { color: white; }

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
  display: flex;
  flex-direction: column;
  align-items: center;
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
  margin-top: -5px;
}

/* Pill de Resumen de Paradas */
.stop-summary-pill {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.15);
  padding: 4px 10px;
  border-radius: 20px;
  margin-top: 8px;
  font-weight: 500;
  border: 1px solid transparent;
}

.stop-summary-pill.has-apts {
  background: rgba(245, 158, 11, 0.15); /* Fondo naranja suave */
  color: #fbbf24; /* Texto naranja */
  border-color: rgba(245, 158, 11, 0.3);
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
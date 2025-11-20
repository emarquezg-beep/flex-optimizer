<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, required: true },
  selectedScenario: { type: String, required: true }
});

const emit = defineEmits(['update:selectedScenario']);

// Helper para Paradas
const getStopSummary = (data) => {
  const apts = data.apartment_count || 0;
  const downtown = data.downtown_count || 0;
  const totalApts = apts + downtown;
  const stops = data.numero_paradas || 0;
  let summary = `${stops} stops`;
  if (totalApts > 0) {
    summary += ` • ${totalApts} Apts`;
    if (downtown > 0) summary += ` (${downtown} DT)`;
  }
  return summary;
};

// Helper para ARIA
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
      <div class="aria-badge">
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

        <div class="calc-text" v-if="normalData.calculation_text">
          {{ normalData.calculation_text }}
        </div>
      </div>
      
      <div class="hero-metrics">
        <div class="eta-group">
          <div class="eta-row opt"><span>🟢 Opt:</span> <strong>{{ normalData.eta_optimista }}</strong></div>
          <div class="eta-row norm"><span>🟡 Nor:</span> <strong>{{ normalData.eta_normal }}</strong></div>
          <div class="eta-row pes"><span>🔴 Pes:</span> <strong>{{ normalData.eta_pesimista }}</strong></div>
        </div>

        <div class="metric-row">
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
    </div>

    <div 
      class="split-side inverse-side" 
      :class="{ 'is-active': selectedScenario === 'inverse' }"
      @click="emit('update:selectedScenario', 'inverse')"
    >
      <div class="aria-badge">
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

        <div class="calc-text" v-if="inverseData.calculation_text">
          {{ inverseData.calculation_text }}
        </div>
      </div>

      <div class="hero-metrics">
        <div class="eta-group">
          <div class="eta-row opt"><span>🟢 Opt:</span> <strong>{{ inverseData.eta_optimista }}</strong></div>
          <div class="eta-row norm"><span>🟡 Nor:</span> <strong>{{ inverseData.eta_normal }}</strong></div>
          <div class="eta-row pes"><span>🔴 Pes:</span> <strong>{{ inverseData.eta_pesimista }}</strong></div>
        </div>

        <div class="metric-row">
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
  justify-content: flex-start; 
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

/* ARIA Badge (Mejorado) */
.aria-badge {
  position: absolute;
  top: 8px;
  right: 5px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(0,0,0,0.3);
  padding: 3px 6px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
}
/* Cuando está activo: Azul sólido y letra blanca */
.is-active .aria-badge { background: var(--brand-primary); border-color: var(--brand-primary); }
.aria-icon { font-size: 0.9rem; }
.aria-val { font-size: 0.65rem; font-weight: bold; color: rgba(255,255,255,0.7); }
.is-active .aria-val { color: white; }

/* Radio */
.selection-indicator {
  margin-bottom: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.scenario-label { font-size: 0.65rem; font-weight: bold; color: var(--text-secondary); }
.radio-circle { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--text-secondary); display: flex; align-items: center; justify-content: center; }
.is-active .radio-circle { border-color: var(--brand-primary); }
.radio-dot { width: 6px; height: 6px; background-color: var(--brand-primary); border-radius: 50%; }

/* Score */
.hero-score { margin-bottom: 10px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.score-val { font-size: 2.2rem; font-weight: 800; line-height: 1; color: var(--text-primary); }
.score-max { font-size: 0.7rem; color: var(--text-secondary); }

.stop-summary-pill {
  font-size: 0.65rem; color: var(--text-secondary); background: rgba(0,0,0,0.15);
  padding: 2px 8px; border-radius: 20px; margin-top: 4px; font-weight: 600;
}
.stop-summary-pill.has-apts { background: rgba(217, 119, 6, 0.2); color: #fbbf24; }

/* TEXTO CÁLCULO */
.calc-text {
  font-size: 0.55rem; 
  color: var(--text-secondary);
  opacity: 0.7;
  margin-top: 5px;
  max-width: 90%;
  line-height: 1.1;
  text-align: center;
}

/* METRICS */
.hero-metrics { width: 100%; padding: 0 5px; display: flex; flex-direction: column; gap: 8px; }

/* 3 ETAS GROUP */
.eta-group {
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.eta-row { display: flex; justify-content: space-between; font-size: 0.7rem; }
.eta-row strong { font-size: 0.8rem; }
.opt { color: #4ade80; }
.norm { color: #fbbf24; }
.pes { color: #f87171; }

.metric-row { display: flex; justify-content: space-between; gap: 5px; }
.metric {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  background: rgba(0,0,0,0.1); padding: 4px; border-radius: 6px;
}
.metric .icon { font-size: 0.9rem; }
.metric .val { font-size: 0.75rem; font-weight: bold; color: var(--text-primary); }
</style>
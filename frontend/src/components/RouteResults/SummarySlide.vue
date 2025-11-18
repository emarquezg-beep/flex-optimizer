<script setup>
import { defineProps, defineEmits } from 'vue';

// Recibimos ambos escenarios y la selección actual
const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, required: true },
  selectedScenario: { type: String, required: true } // 'normal' o 'inverse'
});

const emit = defineEmits(['update:selectedScenario']);

const selectScenario = (scenario) => {
  emit('update:selectedScenario', scenario);
};
</script>

<template>
  <div class="slide-content split-layout">
    <div 
      class="split-side normal-side" 
      :class="{ 'is-active': selectedScenario === 'normal' }"
      @click="selectScenario('normal')"
    >
      <div class="selection-indicator">
        <div class="radio-circle">
          <div v-if="selectedScenario === 'normal'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">NORMAL (Start → End)</span>
      </div>

      <div class="hero-score">
        <span class="score-val">{{ normalData.route_score }}</span>
        <span class="score-max">/100</span>
      </div>
      
      <div class="hero-metrics">
        <div class="metric">
          <span class="icon">⏱️</span>
          <span class="val">{{ normalData.eta_normal }}</span>
          <span class="lbl">ETA</span>
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
      @click="selectScenario('inverse')"
    >
      <div class="selection-indicator">
        <div class="radio-circle">
          <div v-if="selectedScenario === 'inverse'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">INVERSA (End → Start)</span>
      </div>

      <div class="hero-score">
        <span class="score-val">{{ inverseData.route_score }}</span>
        <span class="score-max">/100</span>
      </div>

      <div class="hero-metrics">
        <div class="metric">
          <span class="icon">⏱️</span>
          <span class="val">{{ inverseData.eta_normal }}</span>
          <span class="lbl">ETA</span>
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
  flex-direction: row; /* Split vertical */
  padding: 0; /* Full width */
}

.split-side {
  flex: 1; /* 50% width cada uno */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px 5px;
  transition: all 0.3s ease;
  border-bottom: 4px solid transparent;
  cursor: pointer;
  background-color: var(--bg-secondary);
  opacity: 0.6; /* Dimmed by default */
}

/* Highlight logic */
.split-side.is-active {
  background-color: var(--bg-primary); /* Brighter bg */
  opacity: 1;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
}

.normal-side.is-active { border-bottom-color: #4facfe; }
.inverse-side.is-active { border-bottom-color: #ff9a9e; }

/* Radio styles */
.selection-indicator {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.scenario-label {
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.radio-circle {
  width: 20px;
  height: 20px;
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
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--brand-primary);
}

/* Hero Score */
.hero-score {
  margin-bottom: 20px;
  text-align: center;
}
.score-val {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
}
.score-max {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

/* Metrics */
.hero-metrics {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 0 10px;
}

.metric {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  background: rgba(0,0,0,0.2);
  padding: 6px 10px;
  border-radius: 8px;
}
.metric .icon { font-size: 1.1rem; }
.metric .val { font-weight: bold; margin-left: auto; }
.metric .lbl { font-size: 0.7rem; opacity: 0.7; }
</style>
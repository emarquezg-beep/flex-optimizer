<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, default: null }, 
  selectedScenario: { type: String, required: true }
});

const emit = defineEmits(['update:selectedScenario']);

const getStopSummary = (data) => {
  if (!data) return '';
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

const getAriaFactor = (data) => {
  if (!data) return '';
  const mult = data.aria_multiplier || 0.9;
  return `x${Number(mult).toFixed(2)}`;
};
</script>

<template>
  <div class="slide-content split-layout">
    
    <div 
      class="split-side normal-side" 
      :class="{ 
        'is-active': selectedScenario === 'normal',
        'is-solo': !inverseData || !inverseData.eta_normal // 🛡️ Check de seguridad
      }"
      @click="emit('update:selectedScenario', 'normal')"
    >
      <div class="selection-indicator">
        <div class="radio-circle" v-if="inverseData && inverseData.eta_normal">
          <div v-if="selectedScenario === 'normal'" class="radio-dot"></div>
        </div>
        <span class="scenario-label">NORMAL</span>
      </div>

      </div>

    <div 
      v-if="inverseData && inverseData.eta_normal"
      class="split-side alt-side" 
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
        <span class="scenario-label">{{ inverseData.label || 'AI ROUTE' }}</span>
      </div>

      </div>

  </div>
</template>

<style scoped>
/* ESTILOS BASE */
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
  justify-content: space-between; 
  padding: 15px 8px;
  transition: all 0.3s ease;
  border-bottom: 4px solid transparent;
  cursor: pointer;
  background-color: var(--bg-secondary);
  opacity: 0.6;
  position: relative;
}

.split-side.is-solo {
  opacity: 1;
  cursor: default;
  background-color: var(--bg-primary);
  border-bottom-color: transparent;
}

.split-side.is-active {
  background-color: var(--bg-primary);
  opacity: 1;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
}

/* Colores de Borde Activo */
.normal-side.is-active { border-bottom-color: #4facfe; }

/* ✅ CAMBIO: Renombrado de .inverse-side a .alt-side para ser agnóstico */
.alt-side.is-active { border-bottom-color: #8b5cf6; /* Violeta/Morado para IA */ }

/* Resto de estilos (Badge, Score, etc) igual que antes... */
.aria-badge {
  position: absolute;
  top: 10px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0,0,0,0.4);
  padding: 4px 8px;
  border-radius: 6px;
}
.is-active .aria-badge { background: var(--brand-primary); }
.aria-icon { font-size: 0.8rem; }
.aria-val { font-size: 0.7rem; font-weight: bold; color: white; }

.selection-indicator {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.scenario-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; color: var(--text-secondary); text-transform: uppercase; }
.radio-circle { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--text-secondary); display: flex; align-items: center; justify-content: center; }
.is-active .radio-circle { border-color: var(--brand-primary); }
.radio-dot { width: 8px; height: 8px; background-color: var(--brand-primary); border-radius: 50%; }

.hero-score {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.score-val { font-size: 3rem; font-weight: 900; line-height: 1; color: var(--text-primary); }
.score-max { font-size: 0.8rem; color: var(--text-secondary); margin-top: -5px; margin-bottom: 5px; }

.stop-summary-pill {
  font-size: 0.7rem;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.05);
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  border: 1px solid rgba(0,0,0,0.1);
}
.stop-summary-pill.has-apts {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706; 
  border-color: rgba(245, 158, 11, 0.3);
}

.calc-text {
  margin-top: 8px;
  font-size: 0.6rem;
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.05);
  padding: 4px 8px;
  border-radius: 4px;
  width: 90%;
  text-align: center;
  line-height: 1.2;
  border: 1px dashed rgba(0,0,0,0.1);
}

.hero-metrics {
  width: 100%;
  padding: 0 5px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.eta-group {
  background: transparent;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.eta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  padding: 2px 4px;
  border-bottom: 1px dashed rgba(0,0,0,0.1);
}
.eta-row:last-child { border-bottom: none; }

.eta-row span { font-weight: 500; opacity: 0.9; }
.eta-row strong { font-size: 0.85rem; font-weight: 700; }

.opt span { color: #16a34a; }
.norm span { color: #d97706; }
.pes span { color: #dc2626; }
.opt strong, .norm strong, .pes strong { color: var(--text-primary); } 

.metric-row {
  display: flex;
  gap: 8px;
}
.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0,0,0,0.05);
  padding: 6px;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.05);
}
.metric .icon { font-size: 1rem; margin-bottom: 2px; }
.metric .val { font-size: 0.85rem; font-weight: 800; color: var(--text-primary); }
</style>
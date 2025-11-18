<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({}) // Evita errores si llega vacío
  }
});
</script>

<template>
  <div class="slide-content">
    <div class="slide-header">
      <h3>💰 Financial Breakdown</h3>
      <p class="subtitle">Based on ${{ data.pago }} block payment</p>
    </div>

    <div class="metrics-grid">
      <div class="metric-card highlight">
        <span class="label">Real Hourly Rate</span>
        <span class="value text-green">${{ data.pago_real_por_hora }}/h</span>
        <span class="subtext">After expenses & taxes</span>
      </div>

      <div class="metric-card">
        <span class="label">⛽ Gas Cost</span>
        <span class="value text-red">-${{ data.gasto_de_gasolina }}</span>
      </div>

      <div class="metric-card">
        <span class="label">🔧 Vehicle Wear</span>
        <span class="value text-red">-${{ data.desgaste_vehiculo }}</span>
      </div>

      <div class="metric-card">
        <span class="label">🏛️ Est. Tax (15.3%)</span>
        <span class="value text-red">-${{ data.tax }}</span>
      </div>
      
      <div class="metric-card">
        <span class="label">📄 Tax Deduction</span>
        <span class="value text-blue">+{{ data.claim_por_milla }}</span>
        <span class="subtext">Not cash, but write-off</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-content {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-surface); /* Asegúrate que contraste */
}

.slide-header {
  text-align: center;
  margin-bottom: 20px;
}

.slide-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.subtitle {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  flex: 1;
}

.metric-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid transparent;
}

.metric-card.highlight {
  grid-column: span 2;
  background: rgba(79, 172, 254, 0.1);
  border-color: rgba(79, 172, 254, 0.3);
  align-items: center;
}

.metric-card.highlight .value {
  font-size: 2rem;
}

.label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.value {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--text-primary);
}

.text-green { color: #4ade80; }
.text-red { color: #f87171; }
.text-blue { color: #60a5fa; }

.subtext {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-top: 4px;
}
</style>
<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({})
  }
});
</script>

<template>
  <div class="slide-content">
    <div class="slide-header">
      <h3 class="title">Financial Breakdown</h3>
      <p class="subtitle">Based on ${{ data.pago }} block payment</p>
    </div>

    <div class="metrics-grid">
      <div class="metric-card highlight">
        <span class="label">Real Hourly Rate</span>
        <span class="value value-accent">${{ data.pago_real_por_hora }}/h</span>
        <span class="subtext">After expenses & taxes</span>
      </div>

      <div class="metric-card">
        <span class="label">Gas Cost</span>
        <span class="value value-muted">-${{ data.gasto_de_gasolina }}</span>
      </div>

      <div class="metric-card">
        <span class="label">Vehicle Wear</span>
        <span class="value value-muted">-${{ data.desgaste_vehiculo }}</span>
      </div>

      <div class="metric-card">
        <span class="label">Est. Tax (15.3%)</span>
        <span class="value value-muted">-${{ data.tax }}</span>
      </div>

      <div class="metric-card emphasis">
        <span class="label">Tax Deduction</span>
        <span class="value value-accent">+{{ data.claim_por_milla }}</span>
        <span class="subtext">Not cash, but write-off</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-content{
  padding: 14px 16px 0 16px; /* ↓ menos top padding */
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-surface);
}

.slide-header{
  text-align: center;
  margin-bottom: var(--slide-header-mb);
}

.title{
  margin: 0;
  font-size: var(--slide-title-size);
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.subtitle{
  margin: 4px 0 0;
  font-size: var(--slide-subtitle-size);
  color: var(--text-secondary);
}


.metrics-grid{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px; /* ↓ antes 15 */
  flex: 1;
}

.metric-card{
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14px;
  padding: 12px; /* ↓ antes 15 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.06);
}

.metric-card.highlight{
  grid-column: span 2;
  align-items: center;

  /* ✅ adiós azul; hola “Audible amber” */
  background: rgba(245, 158, 11, 0.10);
  border-color: rgba(245, 158, 11, 0.22);
}

.metric-card.emphasis{
  border-color: rgba(245, 158, 11, 0.14);
  background: rgba(255, 255, 255, 0.045);
}

.label{
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.value{
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.metric-card.highlight .value{
  font-size: 1.9rem;
}

.value-accent{
  color: var(--brand-primary);
  text-shadow: 0 6px 18px rgba(245, 158, 11, 0.18);
}

.value-muted{
  color: rgba(226, 232, 240, 0.78); /* muted (sin rojo fuerte) */
}

.subtext{
  font-size: 0.72rem;
  opacity: 0.72;
  margin-top: 4px;
}
</style>

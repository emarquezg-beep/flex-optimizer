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
      <div class="icon-header">⏱️</div>
      <h3>Time & Distance</h3>
      <p class="subtitle">Total Time: {{ data.tiempo_total }}h</p>
    </div>

    <div class="timeline-centered">
      
      <div class="time-block">
        <span class="time-label">Before Block</span>
        <span class="time-val">{{ data.antes_del_bloque }}h ({{ data.commute_1 }} mi)</span>
        <div class="connector-line"></div>
      </div>

      <div class="time-block highlight">
        <span class="time-label">Block Duration</span>
        <span class="time-val">{{ data.duracion_horas }}h ({{ data.millas_de_trabajo }} work mi)</span>
        <div class="connector-line"></div>
      </div>

      <div class="time-block">
        <span class="time-label">After Block</span>
        <span class="time-val">{{ data.despues_del_bloque }}h ({{ data.commute_2 }} mi)</span>
      </div>

    </div>

    <div class="summary-box">
      <div class="sum-item">
        <span class="lbl">Total Miles</span>
        <span class="val">{{ data.millas_totales }} mi</span>
      </div>
      <div class="sum-divider"></div>
      <div class="sum-item">
        <span class="lbl">Est. Arrival</span>
        <span class="val">{{ data.eta_normal }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-content {
  padding: 10px 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center; /* ✅ FUERZA EL CENTRADO */
  text-align: center;  /* ✅ TEXTO CENTRADO */
}

.slide-header { margin-bottom: 15px; }
.icon-header { font-size: 2rem; margin-bottom: 5px; }
.slide-header h3 { margin: 0; font-size: 1.4rem; color: var(--text-primary); font-weight: 700; }
.subtitle { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }

.timeline-centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 15px;
}

.time-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 5px;
  width: 100%;
}

.time-label { font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px; margin-bottom: 2px; }
.time-val { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
.time-block.highlight .time-val { font-size: 1.3rem; color: var(--brand-primary); }

.connector-line {
  height: 15px;
  width: 2px;
  background-color: var(--border-primary); /* Línea sutil */
  margin-top: 5px;
  margin-bottom: 5px;
  opacity: 0.3;
}

.summary-box {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.sum-item { display: flex; flex-direction: column; }
.sum-item .lbl { font-size: 0.75rem; color: var(--text-secondary); }
.sum-item .val { font-size: 1rem; font-weight: bold; color: var(--text-primary); }

.sum-divider { width: 1px; height: 30px; background: var(--border-primary); opacity: 0.3; }
</style>
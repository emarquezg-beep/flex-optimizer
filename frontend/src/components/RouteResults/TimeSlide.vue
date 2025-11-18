<script setup>
import { defineProps } from 'vue';

// No necesitamos emitir eventos aquí porque SlideContainer
// ya maneja los botones con slots o envolviéndolos, 
// pero como los pusimos dentro del slide en el código anterior,
// los datos solo son para mostrar info.
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
      <h3>⏱️ Time & Distance</h3>
      <p class="subtitle">Total Time: {{ data.tiempo_total }}h</p>
    </div>

    <div class="timeline-container">
      <div class="timeline-item">
        <div class="time-dot start"></div>
        <div class="time-content">
          <span class="time-label">Before Block (Prep + Commute 1)</span>
          <span class="time-val">{{ data.antes_del_bloque }}h ({{ data.commute_1 }} mi)</span>
        </div>
      </div>

      <div class="timeline-item">
        <div class="time-dot block"></div>
        <div class="time-content">
          <span class="time-label">Block Duration</span>
          <span class="time-val">{{ data.duracion_horas }}h ({{ data.millas_de_trabajo }} work mi)</span>
        </div>
      </div>

      <div class="timeline-item">
        <div class="time-dot end"></div>
        <div class="time-content">
          <span class="time-label">After Block (Commute 2)</span>
          <span class="time-val">{{ data.despues_del_bloque }}h ({{ data.commute_2 }} mi)</span>
        </div>
      </div>
    </div>

    <div class="summary-box">
      <div class="sum-row">
        <span>Total Miles:</span>
        <strong>{{ data.millas_totales }} mi</strong>
      </div>
      <div class="sum-row">
        <span>Est. Arrival:</span>
        <strong>{{ data.eta_normal }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-content {
  padding: 20px 20px 0 20px; /* Padding bottom es 0 porque los botones van abajo */
  flex: 1;
  display: flex;
  flex-direction: column;
}

.slide-header {
  text-align: center;
  margin-bottom: 20px;
}

.slide-header h3 { margin: 0; font-size: 1.5rem; color: var(--text-primary); }
.subtitle { margin: 5px 0 0; color: var(--text-secondary); }

.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  margin-left: 10px;
  padding-left: 20px;
  border-left: 2px dashed var(--text-secondary);
  margin-bottom: 20px;
}

.timeline-item {
  position: relative;
  padding-bottom: 20px;
}

.time-dot {
  position: absolute;
  left: -27px;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--bg-surface);
}

.time-dot.start { background-color: #fbbf24; }
.time-dot.block { background-color: #60a5fa; }
.time-dot.end { background-color: #34d399; }

.time-content {
  display: flex;
  flex-direction: column;
}

.time-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.time-val {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--text-primary);
}

.summary-box {
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
}

.sum-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 1rem;
}

.sum-row:last-child { margin-bottom: 0; }
</style>
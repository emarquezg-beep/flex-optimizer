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

    <div class="timeline-wrapper">
      <div class="timeline-container">
        
        <div class="timeline-item">
          <div class="time-dot start"></div>
          <div class="time-content">
            <span class="time-label">Before Block</span>
            <span class="time-val">{{ data.antes_del_bloque }}h ({{ data.commute_1 }} mi)</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="time-dot block"></div>
          <div class="time-content">
            <span class="time-label highlight">Block Duration</span>
            <span class="time-val highlight">{{ data.duracion_horas }}h ({{ data.millas_de_trabajo }} work mi)</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="time-dot end"></div>
          <div class="time-content">
            <span class="time-label">After Block</span>
            <span class="time-val">{{ data.despues_del_bloque }}h ({{ data.commute_2 }} mi)</span>
          </div>
        </div>

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
}

.slide-header { 
  text-align: center; 
  margin-bottom: 20px; 
}
.icon-header { font-size: 2rem; margin-bottom: 5px; }
.slide-header h3 { margin: 0; font-size: 1.4rem; color: var(--text-primary); font-weight: 700; }
.subtitle { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }

/* ENVOLTURA PARA CENTRAR LA TIMELINE */
.timeline-wrapper {
  display: flex;
  justify-content: center; /* Esto centra todo el bloque */
  margin-bottom: 20px;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 25px; /* Espacio para los puntos */
  border-left: 2px dashed var(--border-primary); /* La barrita */
  margin-left: 10px; /* Un pequeño margen visual */
}

.timeline-item {
  position: relative;
  padding-bottom: 25px;
}
.timeline-item:last-child { padding-bottom: 0; }

/* LOS PUNTOS VISUALES */
.time-dot {
  position: absolute;
  left: -32px; /* Ajustado para caer sobre la línea */
  top: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid var(--bg-surface); /* Efecto de recorte */
  box-shadow: 0 0 0 1px rgba(255,255,255,0.1);
}

.time-dot.start { background-color: #fbbf24; } /* Amarillo */
.time-dot.block { background-color: #3b82f6; } /* Azul */
.time-dot.end { background-color: #34d399; }   /* Verde */

.time-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Texto alineado a la izquierda de la línea */
}

.time-label { font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; }
.time-val { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }

.highlight { color: var(--brand-primary) !important; }

.summary-box {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 15px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-top: auto; /* Empuja esto hacia abajo antes de los botones */
  margin-bottom: 10px;
}

.sum-item { display: flex; flex-direction: column; align-items: center; }
.sum-item .lbl { font-size: 0.75rem; color: var(--text-secondary); }
.sum-item .val { font-size: 1.1rem; font-weight: bold; color: var(--text-primary); }

.sum-divider { width: 1px; height: 30px; background: var(--border-primary); opacity: 0.3; }
</style>
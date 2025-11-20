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

    <div v-if="data.mensaje" class="mindset-card" :style="{ borderLeftColor: data.color || '#3b82f6' }">
      <div class="mindset-header">
        <span class="mindset-icon">{{ data.icon }}</span>
        <span class="mindset-cat" :style="{ color: data.color || '#3b82f6' }">{{ data.categoria }}</span>
      </div>
      
      <blockquote class="mindset-quote">
        "{{ data.mensaje.frase }}"
      </blockquote>
      
      <div class="mindset-footer">
        <span class="mindset-author">— {{ data.mensaje.autor }}</span>
      </div>
      
      <div class="mindset-action">
        💡 {{ data.mensaje.accion }}
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
  margin-bottom: 15px; 
}
.icon-header { font-size: 1.8rem; margin-bottom: 2px; }
.slide-header h3 { margin: 0; font-size: 1.3rem; color: var(--text-primary); font-weight: 700; }
.subtitle { margin: 0; color: var(--text-secondary); font-size: 0.85rem; }

/* TIMELINE (Compactada un poco para dar espacio) */
.timeline-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 20px;
  border-left: 2px dashed var(--border-primary);
  margin-left: 10px;
}

.timeline-item {
  position: relative;
  padding-bottom: 15px; /* Menos espacio vertical */
}
.timeline-item:last-child { padding-bottom: 0; }

.time-dot {
  position: absolute;
  left: -27px;
  top: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.1);
}

.time-dot.start { background-color: #fbbf24; }
.time-dot.block { background-color: #3b82f6; }
.time-dot.end { background-color: #34d399; }

.time-content { display: flex; flex-direction: column; align-items: flex-start; }
.time-label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; }
.time-val { font-size: 1rem; font-weight: 600; color: var(--text-primary); }
.highlight { color: var(--brand-primary) !important; }

.summary-box {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-bottom: 15px;
}

.sum-item { display: flex; flex-direction: column; align-items: center; }
.sum-item .lbl { font-size: 0.7rem; color: var(--text-secondary); }
.sum-item .val { font-size: 1rem; font-weight: bold; color: var(--text-primary); }
.sum-divider { width: 1px; height: 25px; background: var(--border-primary); opacity: 0.3; }

/* --- MINDSET CARD (NUEVO ESTILO) --- */
.mindset-card {
  background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
  border-radius: 12px;
  padding: 15px;
  border-left: 4px solid #3b82f6; /* Color por defecto */
  margin-top: auto; /* Empuja hacia abajo */
  margin-bottom: 5px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.mindset-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mindset-icon { font-size: 1.2rem; }
.mindset-cat { 
  font-size: 0.75rem; 
  font-weight: 700; 
  text-transform: uppercase; 
  letter-spacing: 1px;
}

.mindset-quote {
  font-style: italic;
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.4;
  margin: 0 0 8px 0;
  opacity: 0.9;
}

.mindset-footer {
  text-align: right;
  margin-bottom: 10px;
}

.mindset-author {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.mindset-action {
  background: rgba(255,255,255,0.05);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-primary);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.4;
}
</style>
<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({})
  }
});

// Función simple para formatear minutos a "1h 20m" o "45m"
const formatMin = (minutes) => {
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};
</script>

<template>
  <div class="slide-content">
    <div class="slide-header">
      <div class="icon-header">⏱️</div>
      <h3>Time & Distance</h3>
      <p class="subtitle" v-if="data.tactical">
        Total Drive + Work: {{ formatMin(data.tactical.leg1.time + data.tactical.leg2.time + data.tactical.leg3.time) }}
      </p>
    </div>

    <div class="timeline-wrapper" v-if="data.tactical">
      <div class="timeline-container">
        
        <div class="timeline-item">
          <div class="time-dot start"></div>
          <div class="time-content">
            <span class="time-label">To 1st Stop</span>
            <span class="time-val">{{ formatMin(data.tactical.leg1.time) }} ({{ data.tactical.leg1.dist }} mi)</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="time-dot block"></div>
          <div class="time-content">
            <span class="time-label highlight">Route Execution (ARIA)</span>
            <span class="time-val highlight">{{ formatMin(data.tactical.leg2.time) }} ({{ data.tactical.leg2.dist }} mi)</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="time-dot end"></div>
          <div class="time-content">
            <span class="time-label">To Final Dest.</span>
            <span class="time-val">{{ formatMin(data.tactical.leg3.time) }} ({{ data.tactical.leg3.dist }} mi)</span>
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
      <blockquote class="mindset-quote">"{{ data.mensaje.frase }}"</blockquote>
      <div class="mindset-footer">
        <span class="mindset-author">— {{ data.mensaje.autor }}</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
.slide-content {
  padding: 14px 20px 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.slide-header { 
  text-align: center; 
  margin-bottom: 20px; 
}
.icon-header { font-size: 1.8rem; margin-bottom: 2px; }
.slide-header h3 { margin: 0; font-size: 1.3rem; color: var(--text-primary); font-weight: 700; }
.subtitle { margin: 0; color: var(--text-secondary); font-size: 0.85rem; }

/* TIMELINE (Audible-like) */
.timeline-wrapper {
  display: flex;
  justify-content: center;
  margin: 12px 0 18px;
}

.timeline-container {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  position: relative;
  padding-left: 22px;
}

/* Rail vertical suave */
.timeline-container::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: rgba(255,255,255,0.10);
  border-radius: 999px;
}

.timeline-item {
  position: relative;
  padding: 12px 12px 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
}

/* Dots */
.time-dot {
  position: absolute;
  left: 2px;
  top: 18px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid var(--bg-primary);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.08);
}

/* Tokens (sin hardcode) */
.time-dot.start { background: rgba(245, 158, 11, 0.95); } /* amber-like */
.time-dot.block { background: var(--brand-primary); }
.time-dot.end   { background: rgba(34, 197, 94, 0.95); }  /* green-like */

.time-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.time-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.time-val {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--text-primary);
}

.highlight {
  color: var(--brand-primary) !important;
  font-weight: 900;
}

/* SUMMARY BOX (2 mini cards) */
.summary-box {
  margin-top: auto; /* sigue empujando abajo */
  margin-bottom: 14px;

  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  background: transparent;
  border: none;
  padding: 0;
}

.sum-item {
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  padding: 12px 14px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.sum-item .lbl {
  font-size: 0.72rem;
  color: var(--text-secondary);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.sum-item .val {
  font-size: 1.15rem;
  font-weight: 950;
  color: var(--text-primary);
}

.sum-divider {
  display: none;
}

/* MINDSET CARD (lower priority than CTA) */
.mindset-card {
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;

  padding: 12px 15px;
  margin-bottom: 6px;

  border-left: 0;
  box-shadow: none;

  /* glow sutil con el color de categoría */
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--brand-primary) 22%, transparent);
}


.mindset-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.mindset-icon { font-size: 1.1rem; }
.mindset-cat { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.mindset-quote { font-style: italic; color: var(--text-primary); font-size: 0.85rem; line-height: 1.4; margin: 0 0 6px 0; opacity: 0.9; }
.mindset-footer { text-align: right; }
.mindset-author { font-size: 0.75rem; color: var(--text-secondary); }

/* Mobile: compact header to avoid scroll */
@media (max-width: 480px) {
  .slide-content {
    padding: 10px 16px 10px;
  }

  .slide-header {
    margin-bottom: 10px;
  }

  .icon-header {
    display: none; /* ✅ quita el reloj en móvil */
  }

  .slide-header h3 {
    font-size: 1.05rem;
    font-weight: 900;
  }

  .subtitle {
    font-size: 0.78rem;
  }
}

@media (max-width: 480px) {
  /* ✅ Reduce el “aire” final del slide para que el CTA quede más cerca */
  .slide-content {
    padding-bottom: 6px;
  }

  /* ✅ Si el quote crece, baja un poco el padding sin perder legibilidad */
  .mindset-card {
    padding: 10px 12px;
  }
}


</style>
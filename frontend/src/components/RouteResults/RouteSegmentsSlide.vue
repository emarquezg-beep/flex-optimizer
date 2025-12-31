<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({ segments: [] })
  }
});

// Helper para formatear duración
const formatDuration = (min) => {
  const minutes = Math.round(min);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};
</script>

<template>
  <div class="slide-content">
    <div class="slide-header">
      <h3 class="title">Route Logistics</h3>
      <p class="subtitle">{{ data.segments?.length || 0 }} segments</p>
    </div>

    <div class="segments-list">
      <div 
        v-for="(seg, index) in data.segments" 
        :key="index" 
        class="segment-card"
      >
        <div class="seg-header">
          <span class="seg-title">Segment {{ index + 1 }}</span>
          <span class="seg-stops-count">{{ seg.stopsCount }} stops</span>
        </div>

        <div class="seg-body">
          <div class="seg-metric">
            <span class="icon">⏱️</span>
            <span>{{ formatDuration(seg.duration) }}</span>
          </div>
          <div class="seg-metric">
            <span class="icon">📏</span>
            <span>{{ seg.distance }} mi</span>
          </div>
        </div>

        <div v-if="seg.aptCount > 0 || seg.downtownCount > 0" class="seg-footer">
          <span v-if="seg.aptCount > 0" class="badge apt">
            🏢 {{ seg.aptCount }} Apts
          </span>
          <span v-if="seg.downtownCount > 0" class="badge dt">
            🏙️ {{ seg.downtownCount }} DT
          </span>
        </div>
      </div>   
    </div>
  </div>
</template>

<style scoped>
.slide-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 0 16px;
}

.slide-header {
  text-align: center;
  margin-bottom: 10px;
  flex-shrink: 0; /* No encoger el header */
}
.icon-header { font-size: 1.8rem; margin-bottom: 5px; }
.slide-header h3 { margin: 0; font-size: 1.4rem; color: var(--text-primary); }
.title {
  margin: 0;
  font-size: clamp(1.05rem, 2.2vw, 1.2rem); /* fluid, más pequeño */
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -0.01em;
} /* clamp() permite tipografía fluida sin media queries. [web:145][web:146] */

.subtitle {
  margin: 2px 0 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem; /* ↓ antes 0.9 */
}

/* CONTENEDOR DE SCROLL */
.segments-list {
  flex: 1;
  min-height: 0;         /* clave para overflow en flex column [web:94][web:98] */
  overflow-y: auto;
  padding-right: 3px;    /* ↓ antes 5 */
  padding-bottom: 18px;  /* ✅ reemplaza el spacer */
  display: flex;
  flex-direction: column;
  gap: 8px;              /* ↓ antes 12 */
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary) transparent;
}

.segment-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 10px 12px; /* ↓ antes 12/15 */
  display: flex;
  flex-direction: column;
  gap: 6px; /* ↓ antes 8 */
}


.seg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 4px; /* ↓ antes 6 */
  margin-bottom: 0;   /* ↓ antes 2 */
}

.seg-title {
  font-weight: 800;
  color: var(--brand-primary);
  font-size: 0.82rem; /* ↓ antes 0.95 */
  text-transform: uppercase;
}

.seg-stops-count {
  font-size: 0.75rem; /* ↓ antes 0.8 */
  color: var(--text-secondary);
  background: rgba(255,255,255,0.05);
  padding: 2px 7px;   /* ↓ antes 2/8 */
  border-radius: 10px;
}

.seg-body {
  display: flex;
  gap: 14px; /* ↓ antes 20 */
}

.seg-metric {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem; /* ↓ antes 0.9 */
  color: var(--text-primary);
  font-weight: 600;
}
.seg-metric .icon { font-size: 1rem; }

.seg-footer {
  display: flex;
  gap: 6px;     /* ↓ antes 8 */
  margin-top: 2px; /* ↓ antes 4 */
}

.badge {
  font-size: 0.7rem;  /* ↓ antes 0.75 */
  padding: 2px 7px;   /* ↓ antes 3/8 */
  border-radius: 999px; /* más “pill”, menos ruido */
  font-weight: 700;
}

.badge.apt {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.badge.dt {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.spacer { height: 20px; }
</style>
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
      <div class="icon-header">📍</div>
      <h3>Route Logistics</h3>
      <p class="subtitle">{{ data.segments?.length || 0 }} Segments identified</p>
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
      
      <div class="spacer"></div>
    </div>
  </div>
</template>

<style scoped>
.slide-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 15px 20px 0 20px;
}

.slide-header {
  text-align: center;
  margin-bottom: 15px;
  flex-shrink: 0; /* No encoger el header */
}
.icon-header { font-size: 1.8rem; margin-bottom: 5px; }
.slide-header h3 { margin: 0; font-size: 1.4rem; color: var(--text-primary); }
.subtitle { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }

/* CONTENEDOR DE SCROLL */
.segments-list {
  flex: 1;
  overflow-y: auto; /* Scroll vertical activado */
  padding-right: 5px; /* Espacio para scrollbar */
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  /* Scrollbar bonita */
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary) transparent;
}

.segment-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 12px 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 6px;
  margin-bottom: 2px;
}

.seg-title {
  font-weight: 700;
  color: var(--brand-primary);
  font-size: 0.95rem;
  text-transform: uppercase;
}

.seg-stops-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
  background: rgba(255,255,255,0.05);
  padding: 2px 8px;
  border-radius: 10px;
}

.seg-body {
  display: flex;
  gap: 20px;
}

.seg-metric {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}
.seg-metric .icon { font-size: 1rem; }

.seg-footer {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.badge {
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 600;
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
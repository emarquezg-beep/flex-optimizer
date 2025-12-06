<script setup>
import { ref, computed, watch } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import 'swiper/css';
import 'swiper/css/pagination';
import { Pagination } from 'swiper/modules';
import { useRouter } from 'vue-router'; 

// Componentes
import SummarySlide from './SummarySlide.vue';
import FinancialSlide from './FinancialSlide.vue';
import RouteSegmentsSlide from './RouteSegmentsSlide.vue';
import DestinationSlide from './DestinationSlide.vue';
import TimeSlide from './TimeSlide.vue';

const props = defineProps({
  normalPayload: { type: Object, required: true },
  inversePayload: { type: Object, default: null } // 👈 CAMBIO 1: Ahora acepta null
});

const emit = defineEmits(['save-route']);
const router = useRouter();
const swiperModules = [Pagination];

// Estado de selección
const currentSelection = ref('normal');

// 🛡️ CAMBIO 2: Watcher de seguridad
// Si la ruta alternativa desaparece (o es null), forzamos volver a 'normal'
watch(() => props.inversePayload, (newVal) => {
  if (!newVal) {
    currentSelection.value = 'normal';
  }
}, { immediate: true });

// Computed para los datos a mostrar
const selectedData = computed(() => {
  if (currentSelection.value === 'inverse' && props.inversePayload) {
    return props.inversePayload;
  }
  return props.normalPayload;
});

// 🤖 CAMBIO 3: Texto dinámico para el botón
const saveButtonLabel = computed(() => {
  if (currentSelection.value === 'normal') {
    return '💾 Log Normal Route';
  }
  // Si estamos en la vista alternativa, usamos su etiqueta si existe (ej: "🤖 AI Suggestion")
  // o un fallback por defecto.
  const label = props.inversePayload?.label || 'Alternative Route';
  return `💾 Log ${label}`;
});

const handleSave = () => {
  emit('save-route', selectedData.value);
};

const goHome = () => {
  router.push('/'); 
};
</script>

<template>
  <div class="swiper-wrapper-custom">
    <swiper
      :modules="swiperModules"
      :slides-per-view="1"
      :space-between="20"
      :pagination="{ clickable: true }"
      class="my-swiper"
    >
      <swiper-slide>
        <SummarySlide 
          :normalData="normalPayload"
          :inverseData="inversePayload"
          :selectedScenario="currentSelection"
          @update:selectedScenario="val => currentSelection = val"
        />
      </swiper-slide>
      
      <swiper-slide>
        <DestinationSlide :data="selectedData" />
      </swiper-slide>

      <swiper-slide>
        <FinancialSlide :data="selectedData" />
      </swiper-slide>

      <swiper-slide>
        <RouteSegmentsSlide :data="selectedData" />
      </swiper-slide>

      <swiper-slide>
        <div class="slide-flex-col">
          <TimeSlide :data="selectedData" />
          
          <div class="action-footer">
            <button class="btn-save" @click="handleSave">
              {{ saveButtonLabel }}
            </button>
            <button class="btn-home" @click="goHome">
              🏠 Back to Home
            </button>
          </div>
        </div>
      </swiper-slide>
    </swiper>
  </div>
</template>

<style scoped>
/* TUS ESTILOS SE MANTIENEN IGUALES */
.swiper-wrapper-custom {
  height: auto;
  min-height: 680px; 
  width: 100%;
  background: var(--bg-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  padding-bottom: 40px; 
  position: relative;
}

.my-swiper {
  height: 100%;
  width: 100%;
  padding-bottom: 20px;
}

.slide-flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
}

.action-footer {
  margin-top: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: transparent;
  position: relative;
  z-index: 50; 
  margin-bottom: 25px; 
}

.btn-save {
  padding: 16px;
  background: var(--brand-primary);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4);
  transition: transform 0.2s;
  /* Añadido para manejar textos largos en móvil */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-save:active { transform: scale(0.98); }

.btn-home {
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-home:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-color: var(--text-primary);
}
</style>
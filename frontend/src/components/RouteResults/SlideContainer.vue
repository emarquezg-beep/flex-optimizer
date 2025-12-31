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
    return 'Log Normal Route';
  }
  // Si estamos en la vista alternativa, usamos su etiqueta si existe (ej: "🤖 AI Suggestion")
  // o un fallback por defecto.
  const label = props.inversePayload?.label || 'Alternative Route';
  return `Log ${label}`;
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
        <!-- ✅ TimeSlide SOLO contenido -->
        <TimeSlide :data="selectedData" />
      </swiper-slide>
    </swiper>

    <!-- ✅ Footer GLOBAL overlay (afuera del swiper) -->
    <div class="global-action-footer">
      <button class="btn-save" @click="handleSave">
        {{ saveButtonLabel }}
      </button>
      <button class="btn-home" @click="goHome">
        Back to Home
      </button>
    </div>
  </div>
</template>


<style scoped>
/* TUS ESTILOS SE MANTIENEN IGUALES */

.swiper-wrapper-custom {
  position: relative;
  height: 100%;
}
/* ✅ Reserva espacio para que el footer NO tape el contenido */
.my-swiper {
  height: 100%;
  padding-bottom: var(--global-footer-h, 120px);
  box-sizing: border-box;
}

/* Mantén tu regla de altura completa si hoy te funciona estable */
.swiper-wrapper-custom,
:deep(.swiper),
:deep(.swiper-wrapper),
:deep(.swiper-slide) {
  height: 100%;
}

/* ✅ Footer global visible en todos los slides */
.global-action-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;

  display: flex;
  flex-direction: column;
  gap: 10px;

  padding: 12px 16px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));

  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0),
    rgba(0,0,0,0.55) 30%,
    rgba(0,0,0,0.85)
  );
  backdrop-filter: blur(2px);

  z-index: 10;
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
  display: block;
  width: 100%;

  padding: 13px 16px;
  border-radius: 14px;

  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  color: var(--text-primary);

  font-size: 0.98rem;
  font-weight: 850;

  margin-top: 0 !important;
  cursor: pointer;
}

.btn-home:hover {
  background: rgba(255,255,255,0.06);
}
</style>
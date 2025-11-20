<script setup>
import { ref, computed } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import 'swiper/css';
import 'swiper/css/pagination';
import { Pagination } from 'swiper/modules';
import { useRouter } from 'vue-router'; // 👈 Importante para redirigir

// Componentes
import SummarySlide from './SummarySlide.vue';
import FinancialSlide from './FinancialSlide.vue';
import RouteSegmentsSlide from './RouteSegmentsSlide.vue';
import TimeSlide from './TimeSlide.vue';

const props = defineProps({
  normalPayload: { type: Object, required: true },
  inversePayload: { type: Object, required: true }
});

const emit = defineEmits(['save-route']); // Quitamos 'reset' porque ahora navegamos

const router = useRouter(); // Hook del router
const currentSelection = ref('normal');
const swiperModules = [Pagination];

const selectedData = computed(() => {
  return currentSelection.value === 'normal' 
    ? props.normalPayload 
    : props.inversePayload;
});

const handleSave = () => {
  emit('save-route', selectedData.value);
};

const goHome = () => {
  // 🏠 Redirige al inicio para forzar flujo de agenda
  router.push('/'); 
  // Si tu ruta home tiene otro nombre o path, ajústalo aquí. 
  // Ej: router.push({ name: 'Home' });
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
              💾 Log {{ currentSelection === 'normal' ? 'Normal' : 'Inverse' }} Route
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
.swiper-wrapper-custom {
  height: auto;
  min-height: 680px; /* Altura segura */
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

/* FOOTER CON Z-INDEX ALTO PARA QUE FUNCIONEN LOS CLICKS */
.action-footer {
  margin-top: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: transparent;
  
  /* 👇 ESTO ES CRÍTICO PARA QUE LOS BOTONES FUNCIONEN */
  position: relative;
  z-index: 50; 
  margin-bottom: 25px; /* Levanta los botones sobre los dots de paginación */
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
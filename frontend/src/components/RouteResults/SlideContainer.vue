<script setup>
import { ref, computed } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import 'swiper/css';
import 'swiper/css/pagination';
import { Pagination } from 'swiper/modules';

// Componentes de Slides
import SummarySlide from './SummarySlide.vue';
import FinancialSlide from './FinancialSlide.vue';
import TimeSlide from './TimeSlide.vue';

const props = defineProps({
  normalPayload: { type: Object, required: true },
  inversePayload: { type: Object, required: true }
});

const emit = defineEmits(['save-route', 'reset']);

// Estado local de la selección (Por defecto Normal)
const currentSelection = ref('normal');
const swiperModules = [Pagination];

// 🧠 COMPUTED MAGICA:
// Determina qué data mostrar en Slide 2 y 3 basándose en la selección del Slide 1
const selectedData = computed(() => {
  return currentSelection.value === 'normal' 
    ? props.normalPayload 
    : props.inversePayload;
});

const handleSave = () => {
  // Emitimos la data seleccionada para guardar
  emit('save-route', selectedData.value);
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
        <div class="slide-flex-col">
          <TimeSlide :data="selectedData" />
          
          <div class="action-footer">
            <button class="btn-save" @click="handleSave">
              💾 Log {{ currentSelection === 'normal' ? 'Normal' : 'Inverse' }} Route
            </button>
            <button class="btn-reset" @click="$emit('reset')">
              🔄 New Analysis
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
  min-height: 650px; /* ✅ Un poco más alto para dar aire */
  width: 100%;
  background: var(--bg-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  padding-bottom: 40px; /* ✅ Espacio para los dots del swiper */
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
  justify-content: space-between; /* Empuja el footer abajo */
}

.action-footer {
  margin-top: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  background: transparent; /* ✅ ADIÓS FONDO GRIS */
  
  /* ✅ ARREGLO DE CLICK: */
  position: relative; 
  z-index: 50; /* Pone los botones ENCIMA de la paginación */
  margin-bottom: 20px; /* Sube los botones para alejarlos de los dots */
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
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4); /* Sombra bonita */
  transition: transform 0.2s;
}

.btn-save:active {
  transform: scale(0.98);
}

.btn-reset {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-reset:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}
</style>
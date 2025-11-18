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
  height: 500px; /* Ajusta según necesites */
  width: 100%;
  background: var(--bg-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.my-swiper {
  height: 100%;
  width: 100%;
}

.slide-flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.action-footer {
  margin-top: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(0,0,0,0.2);
}

.btn-save {
  padding: 15px;
  background: var(--brand-primary);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
}

.btn-reset {
  padding: 10px;
  background: transparent;
  border: 1px solid var(--text-secondary);
  color: var(--text-secondary);
  border-radius: 8px;
}
</style>
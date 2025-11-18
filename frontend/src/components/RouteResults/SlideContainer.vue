<template>
  <div class="route-results-container">
    <!-- Swiper Container -->
    <swiper
      :modules="modules"
      :slides-per-view="1"
      :space-between="20"
      :pagination="{ clickable: true }"
      :navigation="true"
      class="route-swiper"
      @swiper="onSwiper"
      @slideChange="onSlideChange"
    >
      <!-- Slide 1: Hero Summary -->
      <swiper-slide>
        <SummarySlide :routeData="routeData" />
      </swiper-slide>

      <!-- Slide 2: Financial Breakdown -->
      <swiper-slide>
        <FinancialSlide :routeData="routeData" />
      </swiper-slide>

      <!-- Slide 3: Time & Mileage -->
      <swiper-slide>
        <TimeSlide :routeData="routeData" />
      </swiper-slide>
    </swiper>

    <!-- Slide Counter -->
    <div class="slide-counter">
      {{ currentSlide }} / {{ totalSlides }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

import SummarySlide from './SummarySlide.vue'
import FinancialSlide from './FinancialSlide.vue'
import TimeSlide from './TimeSlide.vue'

const props = defineProps({
  routeData: {
    type: Object,
    required: true
  }
})

const modules = [Navigation, Pagination]
const currentSlide = ref(1)
const totalSlides = ref(3)

const onSwiper = (swiper) => {
  console.log('Swiper initialized:', swiper)
}

const onSlideChange = (swiper) => {
  currentSlide.value = swiper.activeIndex + 1
}
</script>

<style scoped>
.route-results-container {
  width: 100%;
  height: calc(100vh - 180px); /* Ajusta según tu header/footer */
  position: relative;
  padding: 20px 0;
}

.route-swiper {
  width: 100%;
  height: 100%;
  padding-bottom: 50px; /* Espacio para pagination dots */
}

:deep(.swiper-slide) {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

:deep(.swiper-pagination-bullet) {
  background: #3b82f6;
  opacity: 0.3;
}

:deep(.swiper-pagination-bullet-active) {
  opacity: 1;
}

:deep(.swiper-button-next),
:deep(.swiper-button-prev) {
  color: #3b82f6;
  background: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

:deep(.swiper-button-next::after),
:deep(.swiper-button-prev::after) {
  font-size: 18px;
  font-weight: bold;
}

.slide-counter {
  position: absolute;
  top: 10px;
  right: 20px;
  background: rgba(59, 130, 246, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  z-index: 10;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .route-results-container {
    height: calc(100vh - 140px);
  }

  :deep(.swiper-slide) {
    padding: 16px;
  }

  :deep(.swiper-button-next),
  :deep(.swiper-button-prev) {
    width: 32px;
    height: 32px;
  }

  :deep(.swiper-button-next::after),
  :deep(.swiper-button-prev::after) {
    font-size: 14px;
  }
}
</style>
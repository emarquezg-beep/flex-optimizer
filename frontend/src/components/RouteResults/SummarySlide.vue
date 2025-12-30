<script setup>
import { computed, ref, watch } from 'vue'
import ScenarioCard from './ScenarioCard.vue'

import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, default: null },
  selectedScenario: { type: String, required: true }
})

const emit = defineEmits(['update:selectedScenario'])

const innerSwiper = ref(null)

const hasAlt = computed(() => !!(props.inverseData && props.inverseData.eta_normal))
const activeIndex = computed(() => (props.selectedScenario === 'inverse' ? 1 : 0))

const onInnerSwiper = (swiper) => {
  innerSwiper.value = swiper
  swiper.slideTo(activeIndex.value) // sync inicial [web:231]
}

const setScenario = (scenario) => {
  emit('update:selectedScenario', scenario)
  innerSwiper.value?.slideTo(scenario === 'inverse' ? 1 : 0) // sync UI [web:231]
}

watch(
  () => props.selectedScenario,
  (val) => {
    innerSwiper.value?.slideTo(val === 'inverse' ? 1 : 0)
  }
)
</script>

<template>
  <div class="summary">
    <!-- ✅ MOBILE: swipe Normal <-> AI dentro del slide -->
    <div v-if="hasAlt" class="summary__mobile">
      <!-- ✅ Toggle visible (descubrimiento + selección) -->
      <div class="summary__seg">
        <button
          class="seg-btn"
          :class="{ 'is-on': selectedScenario === 'normal' }"
          @click="setScenario('normal')"
          type="button"
        >
          Normal
        </button>

        <button
          class="seg-btn"
          :class="{ 'is-on': selectedScenario === 'inverse' }"
          @click="setScenario('inverse')"
          type="button"
        >
          IA
          <span class="seg-badge">Sugerida</span>
        </button>
      </div>

      <div class="summary__hint">
        Sugerencia IA disponible • Desliza o toca “IA”
      </div>

      <Swiper
        :modules="[Pagination]"
        :slides-per-view="1"
        :space-between="12"
        :nested="true"
        :touchMoveStopPropagation="true"
        :pagination="{ clickable: true }"
        @swiper="onInnerSwiper"
        @slideChange="(s) => emit('update:selectedScenario', s.activeIndex === 1 ? 'inverse' : 'normal')"
      >
        <SwiperSlide>
          <ScenarioCard
            kind="normal"
            :data="normalData"
            :isActive="selectedScenario === 'normal'"
            :isSolo="false"
            :hasChoice="true"
            @select="setScenario('normal')"
          />
        </SwiperSlide>

        <SwiperSlide>
          <ScenarioCard
            kind="alt"
            :data="inverseData"
            :isActive="selectedScenario === 'inverse'"
            :isSolo="false"
            :hasChoice="true"
            @select="setScenario('inverse')"
          />
        </SwiperSlide>
      </Swiper>
    </div>


    <!-- ✅ SOLO: solo normal -->
    <div v-else class="summary__solo">
      <ScenarioCard
        kind="normal"
        :data="normalData"
        :isActive="true"
        :isSolo="true"
        :hasChoice="false"
      />
    </div>

    <!-- ✅ DESKTOP: comparación lado a lado -->
    <div v-if="hasAlt" class="summary__desktop">
      <ScenarioCard
        kind="normal"
        :data="normalData"
        :isActive="selectedScenario === 'normal'"
        :isSolo="false"
        :hasChoice="true"
        @select="emit('update:selectedScenario', 'normal')"
      />
      <ScenarioCard
        kind="alt"
        :data="inverseData"
        :isActive="selectedScenario === 'inverse'"
        :isSolo="false"
        :hasChoice="true"
        @select="emit('update:selectedScenario', 'inverse')"
      />
    </div>
  </div>
</template>


<style scoped>
.summary__mobile {
  padding: 0 10px;
}

.summary__seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 6px 0 8px;
}

.seg-btn {
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.05);
  color: var(--text-secondary);
  font-weight: 900;
  letter-spacing: 0.4px;
}

.seg-btn.is-on {
  border-color: rgba(255,165,0,0.45);
  background: rgba(255,165,0,0.14);
  color: var(--text-primary);
}

.seg-badge {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 800;
  color: var(--brand-primary);
}

.summary__hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

/* Opcional: hacer bullets más “Audible” */
.summary__mobile :deep(.swiper-pagination-bullet) {
  background: rgba(255,255,255,0.25);
  opacity: 1;
}

.summary__mobile :deep(.swiper-pagination-bullet-active) {
  background: var(--brand-primary);
}

.summary {
  width: 100%;
}

/* default = móvil */
.summary__desktop {
  display: none;
}

.summary__mobile :deep(.swiper) {
  width: 100%;
}

/* Desktop/tablet */
@media (min-width: 900px) {
  .summary__mobile,
  .summary__solo {
    display: none;
  }

  .summary__desktop {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
}


</style>

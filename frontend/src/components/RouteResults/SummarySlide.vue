<script setup>
import { defineProps, defineEmits, computed } from 'vue'
import ScenarioCard from './ScenarioCard.vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, default: null },
  selectedScenario: { type: String, required: true }
})

const emit = defineEmits(['update:selectedScenario'])

const hasAlt = computed(() => !!(props.inverseData && props.inverseData.eta_normal))
const activeIndex = computed(() => (props.selectedScenario === 'inverse' ? 1 : 0))

</script>

<template>
  <div class="summary">
    <!-- ✅ MOBILE: swipe Normal <-> AI dentro del slide -->
    <div v-if="hasAlt" class="summary__mobile">
      <Swiper
        :slides-per-view="1"
        :space-between="12"
        :nested="true"
        :touchMoveStopPropagation="true"
        :initial-slide="activeIndex"
        @slideChange="(s) => emit('update:selectedScenario', s.activeIndex === 1 ? 'inverse' : 'normal')"
      >
        <SwiperSlide>
          <ScenarioCard
            kind="normal"
            :data="normalData"
            :isActive="selectedScenario === 'normal'"
            :isSolo="false"
            :hasChoice="true"
            @select="emit('update:selectedScenario', 'normal')"
          />
        </SwiperSlide>

        <SwiperSlide>
          <ScenarioCard
            kind="alt"
            :data="inverseData"
            :isActive="selectedScenario === 'inverse'"
            :isSolo="false"
            :hasChoice="true"
            @select="emit('update:selectedScenario', 'inverse')"
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
.summary {
  width: 100%;
  height: 100%;
}

/* default: móvil */
.summary__desktop {
  display: none;
}

.summary__mobile :deep(.swiper) {
  width: 100%;
}

.summary__mobile :deep(.swiper-slide) {
  display: flex;
  justify-content: center;
}

/* para que el card no quede pegado a bordes */
.summary__mobile {
  padding: 0 10px;
}

/* desktop */
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

<script setup>
import { defineProps, defineEmits, computed } from 'vue'
import ScenarioCard from './ScenarioCard.vue'

const props = defineProps({
  normalData: { type: Object, required: true },
  inverseData: { type: Object, default: null },
  selectedScenario: { type: String, required: true }
})

const emit = defineEmits(['update:selectedScenario'])

const hasAlt = computed(() => !!(props.inverseData && props.inverseData.eta_normal))
</script>

<template>
  <div class="summary" :class="{ 'summary--split': hasAlt, 'summary--solo': !hasAlt }">
    <ScenarioCard
      kind="normal"
      :data="normalData"
      :isActive="selectedScenario === 'normal'"
      :isSolo="!hasAlt"
      :hasChoice="hasAlt"
      @select="emit('update:selectedScenario', 'normal')"
    />

    <ScenarioCard
      v-if="hasAlt"
      kind="alt"
      :data="inverseData"
      :isActive="selectedScenario === 'inverse'"
      :isSolo="false"
      :hasChoice="true"
      @select="emit('update:selectedScenario', 'inverse')"
    />
  </div>
</template>

<style scoped>
.summary {
  width: 100%;
  height: 100%;
  padding: 0;
}

/* ✅ MÓVIL: swipe entre cards (Audible-like) */
.summary--split {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 100%;
  gap: 12px;

  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;

  /* opcional: un poco de padding lateral “premium” */
  padding: 0 10px 10px;
}

.summary--split :deep(.scenario) {
  scroll-snap-align: center;
}

/* Ocultar scrollbar (opcional) */
.summary--split::-webkit-scrollbar {
  display: none;
}

/* ✅ SOLO: 1 card normal */
.summary--solo {
  display: block;
}

/* ✅ DESKTOP/TABLET: split real 2 columnas */
@media (min-width: 900px) {
  .summary--split {
    display: grid;
    grid-auto-flow: initial;
    grid-template-columns: 1fr 1fr;
    overflow: visible;
    padding: 0;
  }
}
</style>

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
  display: grid;
  gap: 12px;
  padding: 0;
}

.summary--solo {
  grid-template-columns: 1fr;
}

.summary--split {
  grid-template-columns: 1fr 1fr;
}
</style>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  padding: {
    type: String,
    default: 'md', // none, sm, md, lg
    validator: (value) => ['none', 'sm', 'md', 'lg'].includes(value)
  },
  hoverable: Boolean,
  clickable: Boolean
})

const cardClasses = computed(() => {
  const classes = ['base-card']
  classes.push(`base-card--padding-${props.padding}`)
  if (props.hoverable) classes.push('base-card--hoverable')
  if (props.clickable) classes.push('base-card--clickable')
  return classes
})
</script>

<template>
  <div :class="cardClasses" v-bind="$attrs">
    <slot />
  </div>
</template>

<style scoped>
.base-card {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-base);
  overflow: hidden;
}

/* Padding variants */
.base-card--padding-none {
  padding: 0;
}

.base-card--padding-sm {
  padding: var(--space-3);
}

.base-card--padding-md {
  padding: var(--space-4);
}

.base-card--padding-lg {
  padding: var(--space-6);
}

/* Hoverable */
.base-card--hoverable:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

/* Clickable */
.base-card--clickable {
  cursor: pointer;
}

.base-card--clickable:active {
  transform: scale(0.99);
}
</style>
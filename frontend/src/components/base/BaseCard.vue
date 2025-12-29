<script setup>

//forzando commit
import { computed } from 'vue'

const props = defineProps({
  padding: {
    type: String,
    default: 'md', // none, sm, md, lg
    validator: (value) => ['none', 'sm', 'md', 'lg'].includes(value)
  },
  hoverable: Boolean,
  clickable: Boolean,
  elevated: Boolean, // 🆕 Para cards con más elevación
  flat: Boolean      // 🆕 Para cards sin sombra
})

const cardClasses = computed(() => {
  const classes = ['base-card']
  classes.push(`base-card--padding-${props.padding}`)
  if (props.hoverable) classes.push('base-card--hoverable')
  if (props.clickable) classes.push('base-card--clickable')
  if (props.elevated) classes.push('base-card--elevated')
  if (props.flat) classes.push('base-card--flat')
  return classes
})
</script>

<template>
  <div :class="cardClasses" v-bind="$attrs">
    <slot />
  </div>
</template>

<style scoped>
/* 🔥 Base card con sombra mejorada */
.base-card {
  background: var(--card-bg, var(--bg-secondary));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-base);
  overflow: hidden;
  border: 1px solid transparent;
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

/* 🔥 Hoverable con efecto de elevación mejorado */
.base-card--hoverable:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-3px);
  border-color: var(--border-primary);
}

/* Clickable */
.base-card--clickable {
  cursor: pointer;
}

.base-card--clickable:active {
  transform: scale(0.99);
  box-shadow: var(--shadow-sm);
}

/* 🆕 Elevated variant */
.base-card--elevated {
  box-shadow: var(--shadow-elevated);
  background: var(--card-bg-elevated, var(--bg-tertiary));
}

.base-card--elevated.base-card--hoverable:hover {
  box-shadow: var(--shadow-xl);
  transform: translateY(-4px);
}

/* 🆕 Flat variant (sin sombra) */
.base-card--flat {
  box-shadow: none;
  border: 1px solid var(--border-primary);
  background: var(--card-bg-flat, var(--bg-secondary));
}

.base-card--flat.base-card--hoverable:hover {
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}
</style>
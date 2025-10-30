<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary', // primary, secondary, ghost, danger
    validator: (value) => ['primary', 'secondary', 'ghost', 'danger'].includes(value)
  },
  size: {
    type: String,
    default: 'md', // sm, md, lg
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  disabled: Boolean,
  loading: Boolean,
  fullWidth: Boolean
})

const buttonClasses = computed(() => {
  const classes = ['base-button']
  classes.push(`base-button--${props.variant}`)
  classes.push(`base-button--${props.size}`)
  if (props.fullWidth) classes.push('base-button--full')
  if (props.loading) classes.push('base-button--loading')
  return classes
})
</script>

<template>
  <button 
    :class="buttonClasses"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="button-spinner"></span>
    <span :class="{ 'button-content--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-base);
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-base);
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.base-button:active:not(:disabled) {
  transform: scale(0.98);
}

/* Sizes */
.base-button--sm {
  height: var(--button-height-sm);
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
}

.base-button--md {
  height: var(--button-height-md);
  padding: 0 var(--space-4);
  font-size: var(--text-base);
}

.base-button--lg {
  height: var(--button-height-lg);
  padding: 0 var(--space-6);
  font-size: var(--text-lg);
}

/* Variants */
.base-button--primary {
  background-color: var(--brand-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.base-button--primary:hover:not(:disabled) {
  background-color: var(--brand-primary-hover);
  box-shadow: var(--shadow-md);
}

.base-button--primary:active:not(:disabled) {
  background-color: var(--brand-primary-active);
}

.base-button--secondary {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.base-button--secondary:hover:not(:disabled) {
  background-color: var(--bg-tertiary);
  border-color: var(--brand-primary);
}

.base-button--ghost {
  background-color: transparent;
  color: var(--text-primary);
}

.base-button--ghost:hover:not(:disabled) {
  background-color: var(--bg-secondary);
}

.base-button--danger {
  background-color: var(--error);
  color: white;
}

.base-button--danger:hover:not(:disabled) {
  background-color: #d93025;
}

/* Full width */
.base-button--full {
  width: 100%;
}

/* Disabled state */
.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading state */
.base-button--loading {
  pointer-events: none;
}

.button-spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.button-content--hidden {
  opacity: 0;
}
</style>
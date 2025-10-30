<script setup>
const props = defineProps({
  modelValue: [String, Number],
  type: {
    type: String,
    default: 'text'
  },
  placeholder: String,
  disabled: Boolean,
  error: String,
  label: String,
  helperText: String
})

const emit = defineEmits(['update:modelValue'])

function handleInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div class="base-input-wrapper">
    <label v-if="label" class="base-input-label">
      {{ label }}
    </label>
    
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="{ 'base-input--error': error }"
      class="base-input"
      @input="handleInput"
      v-bind="$attrs"
    />
    
    <p v-if="error" class="base-input-error">{{ error }}</p>
    <p v-else-if="helperText" class="base-input-helper">{{ helperText }}</p>
  </div>
</template>

<style scoped>
.base-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.base-input-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.base-input {
  height: var(--input-height);
  padding: 0 var(--space-4);
  font-size: var(--text-base);
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.base-input:hover:not(:disabled) {
  border-color: var(--brand-primary);
}

.base-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(91, 143, 196, 0.15);
}

.base-input--error {
  border-color: var(--error);
}

.base-input--error:focus {
  box-shadow: 0 0 0 3px rgba(234, 67, 53, 0.15);
}

.base-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--bg-secondary);
}

.base-input-error {
  font-size: var(--text-xs);
  color: var(--error);
  margin: 0;
}

.base-input-helper {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}
</style>
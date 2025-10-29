<script setup>
//nombre corregido
import { ref, onMounted } from 'vue';
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const USERS = [
  {name: 'Ernesto', id: 'b5a04a69-1e96-47c4-a0c8-972fec54c21d' },
  { name: 'Carmen Cecilia', id: 'b3aaad3a-5835-4796-aca7-ea634e150b5d' }
];
const selectedUserId = ref(USERS[0].id); // Ajusta esto si tienes un store de usuario
const hasPending = ref(false);
const pendingRoutes = ref([]);
const etaInputs = ref({});
const isSubmitting = ref(false);

onMounted(async () => {
  await checkPendingETAs();
});

async function checkPendingETAs() {
  try {
    const response = await fetch(`${backendUrl}/api/pending-eta/${selectedUserId.value}`);
    const result = await response.json();
    if (result.hasPending) {
      hasPending.value = true;
      pendingRoutes.value = result.routes;
    }
  } catch (error) {
    console.error('X Error checking pending ETAs:', error);
  }
}

async function submitETA(routeId) {
  const etaValue = etaInputs.value[routeId];
  if (!etaValue || !etaValue.trim()) {
    alert('Por favor, ingresa una hora válida');
    return;
  }
   // Validar formato básico (copiado de LiveETAView para consistencia)
  const timePattern = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
  if (!timePattern.test(etaValue.trim())) {
    alert('Formato inválido. Usa: "5:11 PM" o "11:30 AM"');
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await fetch(`${backendUrl}/api/complete-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId: routeId,
        etaReal: etaValue.trim()
      })
    });
    const result = await response.json();
    if (result.success) {
      // Remover de la lista
      pendingRoutes.value = pendingRoutes.value.filter(r => r.id !== routeId);
      if (pendingRoutes.value.length === 0) {
        hasPending.value = false;
      }
    } else {
      alert('Error guardando ETA: ' + result.message);
    }
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    isSubmitting.value = false;
  }
}

async function skipRoute(routeId) {
  if (!confirm('¿Seguro que no recuerdas la hora? No volveremos a preguntarte.')) {
    return;
  }
  try {
    const response = await fetch(`${backendUrl}/api/skip-eta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId })
    });
    const result = await response.json();
    if (result.success) {
      pendingRoutes.value = pendingRoutes.value.filter(r => r.id !== routeId);
      if (pendingRoutes.value.length === 0) {
        hasPending.value = false;
      }
    }
  } catch (error) {
    console.error('Error skipping:', error);
  }
}
</script>

<template>
  <div v-if="hasPending" class="pending-eta-banner">
    <div class="banner-header">
      <span class="banner-icon">⚠️</span>
      <h3>ACCIÓN PENDIENTE</h3>
    </div>
    <p class="banner-description">
      Tienes {{ pendingRoutes.length }} ruta(s) sin hora de llegada real.
      Esto nos ayuda a mejorar las predicciones.
    </p>
    <div class="pending-routes-list">
      <div
        v-for="route in pendingRoutes"
        :key="route.id"
        class="pending-route-item"
      >
        <div class="route-info">
          <strong>{{ route.warehouse }} - {{ route.primary_city }}</strong>
          <span>{{ route.fecha }} a las {{ route.hora }}</span>
          <span class="eta-hint">ETA Normal era: {{ route.eta_normal }}</span>
        </div>
        <div class="route-actions">
          <input
            type="text"
            v-model="etaInputs[route.id]"
            placeholder="Ej: 5:11 PM"
            :disabled="isSubmitting"
          />
          <button
            @click="submitETA(route.id)"
            class="button-save"
            :disabled="isSubmitting"
          >
            Guardar
          </button>
          <button
            @click="skipRoute(route.id)"
            class="button-skip"
            :disabled="isSubmitting"
          >
            No recuerdo
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-eta-banner {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 193, 7, 0.05) 100%);
  border: 2px solid #ffc107;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  animation: slideDown 0.5s ease;
}
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.banner-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.banner-icon {
  font-size: 2em;
}
.banner-header h3 {
  margin: 0;
  color: #ffc107;
  font-size: 1.3em;
}
.banner-description {
  color: var(--color-text-primary);
  margin-bottom: 20px;
  line-height: 1.6;
}
.pending-routes-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.pending-route-item {
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}
.route-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 200px;
}
.route-info strong {
  color: var(--color-text-primary);
  font-size: 1.1em;
}
.route-info span {
  color: var(--color-text-secondary);
  font-size: 0.9em;
}
.eta-hint {
  color: #ffc107 !important;
  font-weight: 600;
}
.route-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.route-actions input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text-primary);
  width: 120px;
}
.button-save,
.button-skip {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.button-save {
  background-color: var(--color-accent);
  color: var(--color-black);
}
.button-save:hover:not(:disabled) {
  background-color: #bad0b1;
}
.button-skip {
  background-color: var(--color-border);
  color: var(--color-text-primary);
}
.button-skip:hover:not(:disabled) {
  background-color: var(--color-surface);
}
.button-save:disabled,
.button-skip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 768px) {
  .pending-route-item {
    flex-direction: column;
    align-items: stretch;
  }
  .route-actions {
    width: 100%;
    flex-direction: column;
  }
  .route-actions input {
    width: 100%;
  }
}
</style>
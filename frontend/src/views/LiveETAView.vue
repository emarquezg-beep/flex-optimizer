<script setup>
import { ref, computed, onMounted } from 'vue';
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const USERS = [
  {name: 'Ernesto', id: 'b5a04a69-1e96-47c4-a0c8-972fec54c21d' },
  {name: 'Carmen Cecilia', id: 'b3aaad3a-5835-4796-aca7-ea634e150b5d' }
];
const selectedUserId = ref(USERS[0].id);

// Estados
const isLoading = ref(true);
const hasActiveRoute = ref(false);
const activeRoute = ref(null);
const currentStopInput = ref('');
const isCalculating = ref(false);
const liveETAs = ref(null);
const etaRealInput = ref("");
const isCompleting = ref(false);
const completionStatus = ref(null);

// Cargar ruta activa al montar componente
onMounted(async () => {
  await loadActiveRoute();
});

async function loadActiveRoute() {
  isLoading.value = true;
  try {
    const response = await fetch(`${backendUrl}/api/active-route/${selectedUserId.value}`);
    const result = await response.json();
    if (result.hasActiveRoute) {
      hasActiveRoute.value = true;
      activeRoute.value = result.route;
      console.log(' Ruta activa cargada:', activeRoute.value);
    } else {
      hasActiveRoute.value = false;
      console.log(' No hay ruta activa');
    }
  } catch (error) {
    console.error('X Error cargando ruta activa:', error);
    hasActiveRoute.value = false;
  } finally {
    isLoading.value = false;
  }
}

async function calculateLiveETA() {
  const stopNumber = parseInt(currentStopInput.value);
  if (!stopNumber || stopNumber < 2) {
    alert('Por favor, ingresa un número de parada válido (≥2)');
    return;
  }
  if (stopNumber > activeRoute.value.numero_paradas) {
    alert(`El número de parada no puede ser mayor a ${activeRoute.value.numero_paradas}`);
    return;
  }
  isCalculating.value = true;
  liveETAs.value = null;
  try {
    const response = await fetch(`${backendUrl}/api/calculate-live-eta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId: activeRoute.value.id,
        currentStopNumber: stopNumber
      })
    });
    const result = await response.json();
    if (result.success) {
      liveETAs.value = result;
      console.log(' ETAs en caliente calculados:', result);
    } else {
      throw new Error(result.error || 'Error calculando ETAs');
    }
  } catch (error) {
    console.error('X Error calculando live ETA:', error);
    alert(`Error: ${error.message}`);
  } finally {
    isCalculating.value = false;
  }
}

// REEMPLAZA ESTA FUNCIÓN COMPLETA

async function completeRoute() {
  if (!etaRealInput.value || !etaRealInput.value.trim()) {
    alert('Por favor, ingresa la hora real de llegada (ej: 5:11 PM)');
    return;
  }
  // Validar formato básico
  const timePattern = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
  if (!timePattern.test(etaRealInput.value.trim())) {
    alert('Formato inválido. Usa: "5:11 PM" o "11:30 AM"');
    return;
  }
  isCompleting.value = true;
  completionStatus.value = null;
  try {
    const response = await fetch(`${backendUrl}/api/complete-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId: activeRoute.value.id,
        etaReal: etaRealInput.value.trim()
      })
    });
    const result = await response.json();
    if (result.success) {
      completionStatus.value = {
        success: true,
        message: ' ¡Ruta completada! ETA real guardado.'
      };
      
      // --- INICIO DE LA CORRECCIÓN ---
      // Limpiar estado (con limpieza de "completionStatus")
      setTimeout(() => {
        hasActiveRoute.value = false;
        activeRoute.value = null;
        liveETAs.value = null;
        etaRealInput.value = "";
        currentStopInput.value = ""; // Limpiar también este input
        completionStatus.value = null; // Ocultar el mensaje de éxito
      }, 2000);
      // --- FIN DE LA CORRECCIÓN ---

    } else {
      throw new Error(result.message || 'Error completando ruta');
    }
  } catch (error) {
    console.error('X Error completando ruta:', error);
    completionStatus.value = {
      success: false,
      message: `Error: ${error.message}`
    };
  } finally {
    isCompleting.value = false;
  }
}

// Computed para progreso visual
const routeProgress = computed(() => {
  if (!activeRoute.value || !liveETAs.value) return 0;
  const remaining = liveETAs.value.remainingStops;
  const total = activeRoute.value.numero_paradas;
  return Math.round(((total - remaining) / total) * 100);
});

// Computed para validar si puede completar
const canComplete = computed(() => {
  return liveETAs.value !== null; // Solo puede completar si ya calculó en caliente
});
</script>

<template>
  <div class="live-eta-container">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando ruta activa...</p>
    </div>

    <div v-else-if="!hasActiveRoute" class="no-route-state">
      <div class="empty-icon">
        <h2>No hay ruta activa</h2>
      </div>
      <p>Aún no has iniciado ninguna ruta hoy.</p>
      <router-link to="/upload" class="button-primary">
        Crear Nueva Ruta
      </router-link>
    </div>

    <div v-else class="route-active">
      <div class="route-header">
        <div class="header-badge">
          <span class="badge-icon">📍</span>
          <div class="badge-info">
            <h1>RUTA EN VIVO</h1>
            <p>{{ activeRoute.warehouse }} - {{ activeRoute.primary_city }}</p>
          </div>
        </div>
        <div class="route-meta">
          <div class="meta-item">
            <span class="meta-label">Inicio:</span>
            <span class="meta-value">{{ activeRoute.hora }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Duración:</span>
            <span class="meta-value">{{ activeRoute.duracion_horas }}h</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Paradas:</span>
            <span class="meta-value">{{ activeRoute.numero_paradas }}</span>
          </div>
        </div>
      </div>

      <div v-if="liveETAs" class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: routeProgress + '%' }"></div>
        </div>
        <p class="progress-text">
          {{ routeProgress }}% completado
          ({{ activeRoute.numero_paradas - liveETAs.remainingStops }}/{{
            activeRoute.numero_paradas
          }}
          paradas)
        </p>
      </div>

      <div class="live-calc-section">
        <h2>Cálculo en Caliente</h2>
        <p class="section-description">
          Ingresa en qué parada estás para recalcular tu hora estimada de llegada.
        </p>
        <div class="input-group">
          <label for="current-stop">¿En qué parada estás?</label>
          <div class="input-with-button">
            <input
              type="number"
              id="current-stop"
              v-model="currentStopInput"
              :min="2"
              :max="activeRoute.numero_paradas"
              placeholder="Ej: 15"
              :disabled="isCalculating"
            />
            <button
              @click="calculateLiveETA"
              class="button-primary"
              :disabled="isCalculating"
            >
              {{ isCalculating ? 'Calculando...' : 'Calcular ETA' }}
            </button>
          </div>
        </div>
        
        <div v-if="liveETAs" class="live-results">
          <div class="result-header">
            <h3>Llegada Estimada Actualizada</h3>
            <div class="result-stats">
              <span>Paradas restantes: <strong>{{ liveETAs.remainingStops }}</strong></span>
              <span>Millas restantes: <strong>~{{ liveETAs.remainingMiles }} mi</strong></span>
            </div>
          </div>
          <div class="eta-grid">
            <div class="eta-card optimistic">
              <div class="eta-label">Optimista</div>
              <div class="eta-time">{{ liveETAs.etas.optimistic.eta }}</div>
              <div class="eta-duration">{{ liveETAs.etas.optimistic.totalMinutes }} min</div>
            </div>
            <div class="eta-card normal">
              <div class="eta-label">Normal</div>
              <div class="eta-time">{{ liveETAs.etas.normal.eta }}</div>
              <div class="eta-duration">{{ liveETAs.etas.normal.totalMinutes }} min</div>
            </div>
            <div class="eta-card pessimistic">
              <div class="eta-label">Pesimista</div>
              <div class="eta-time">{{ liveETAs.etas.pessimistic.eta }}</div>
              <div class="eta-duration">{{ liveETAs.etas.pessimistic.totalMinutes }} min</div>
            </div>
          </div>
          <details class="technical-breakdown">
            <summary>Ver Desglose Técnico</summary>
            <div class="breakdown-content">
              <p><strong>Drive Base:</strong> {{ liveETAs.breakdown.baseDriveMinutes }} min</p>
              <p><strong>Paradas:</strong> {{ liveETAs.breakdown.stopCount }}</p>
              <p><strong>Apartamentos:</strong> {{ liveETAs.breakdown.aptCount }}</p>
              <p><strong>Downtown:</strong> {{ liveETAs.breakdown.downtownCount }}</p>
            </div>
          </details>
        </div>
      </div>

      <hr class="section-divider" />

      <div class="complete-section">
        <h2>Completar Ruta</h2>
        <p class="section-description">
          Cuando termines todas las paradas, ingresa la hora REAL que te mostró tu GPS al llegar
          a tu destino final.
        </p>
        <div class="original-predictions">
          <h4>Predicciones Originales:</h4>
          <div class="predictions-row">
            <span>Optimista: <strong>{{ activeRoute.eta_optimista }}</strong></span>
            <span>Normal: <strong>{{ activeRoute.eta_normal }}</strong></span>
            <span>Pesimista: <strong>{{ activeRoute.eta_pesimista }}</strong></span>
          </div>
        </div>
        <div class="input-group">
          <label for="eta-real">¿A qué hora REALMENTE llegaste?</label>
          <div class="input-with-button">
            <input
              type="text"
              id="eta-real"
              v-model="etaRealInput"
              placeholder="Ej: 5:11 PM"
              :disabled="isCompleting || !canComplete"
            />
            <button
              @click="completeRoute"
              class="button-complete"
              :disabled="isCompleting || !canComplete"
            >
              {{ isCompleting ? 'Guardando...' : 'Guardar y Finalizar' }}
            </button>
          </div>
          <p v-if="!canComplete" class="helper-text warning">
            Primero calcula el ETA en caliente para habilitar esta opción
          </p>
          <p v-else class="helper-text">
            Formato: "5:11 PM" o "11:30 AM"
          </p>
        </div>
        <div v-if="completionStatus" :class="['completion-status', completionStatus.success ? 'success' : 'error']">
          {{ completionStatus.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-eta-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
/* Loading State */
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-primary);
}
.spinner {
  width: 50px;
  height: 50px;
  margin: 0 auto 20px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
/* No Route State */
.no-route-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-primary);
}
.empty-icon {
  font-size: 5em;
  margin-bottom: 20px;
}
.no-route-state h2 {
  margin-bottom: 10px;
  color: var(--color-text-primary);
}
.no-route-state p {
  color: var(--color-text-secondary);
  margin-bottom: 30px;
}
/* Route Header */
.route-header {
  background: linear-gradient(135deg, var(--color-surface) 0%, rgba(42, 62, 80, 0.5) 100%);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 25px;
}
.header-badge {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
.badge-icon {
  font-size: 3em;
}
.badge-info h1 {
  margin: 0;
  font-size: 1.8em;
  color: var(--color-primary);
}
.badge-info p {
  margin: 5px 0 0 0;
  color: var(--color-text-secondary);
  font-size: 1.1em;
}
.route-meta {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.meta-label {
  font-size: 0.85em;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.meta-value {
  font-size: 1.3em;
  font-weight: bold;
  color: var(--color-text-primary);
}
/* Progress Bar */
.progress-section {
  margin-bottom: 30px;
}
.progress-bar {
  width: 100%;
  height: 12px;
  background-color: var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 10px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-primary) 100%);
  transition: width 0.5s ease;
}
.progress-text {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.95em;
}
/* Sections */
.live-calc-section,
.complete-section {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
}
.live-calc-section h2,
.complete-section h2 {
  margin: 0 0 10px 0;
  color: var(--color-primary);
  font-size: 1.5em;
}
.section-description {
  color: var(--color-text-secondary);
  margin-bottom: 20px;
  line-height: 1.6;
}
.section-divider {
  border: none;
  border-top: 2px dashed var(--color-border);
  margin: 30px 0;
}
/* Input Groups */
.input-group {
  margin-bottom: 20px;
}
.input-group label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: 1.05em;
}
.input-with-button {
  display: flex;
  gap: 10px;
}
.input-with-button input {
  flex: 1;
  padding: 12px 15px;
  font-size: 1.1em;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background);
  color: var(--color-text-primary);
}
.input-with-button input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.input-with-button button {
  padding: 12px 25px;
  white-space: nowrap;
}
.helper-text {
  margin-top: 8px;
  font-size: 0.9em;
  color: var(--color-text-secondary);
}
.helper-text.warning {
  color: #ffc107;
}
/* Live Results */
.live-results {
  margin-top: 25px;
  padding: 20px;
  background-color: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}
.result-header h3 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}
.result-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.result-stats span {
  color: var(--color-text-secondary);
  font-size: 0.95em;
}
.result-stats strong {
  color: var(--color-text-primary);
}
/* ETA Grid */
.eta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}
.eta-card {
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 2px solid;
  transition: transform 0.2s ease;
}
.eta-card:hover {
  transform: translateY(-2px);
}
.eta-card.optimistic {
  background-color: rgba(40, 167, 69, 0.1);
  border-color: #28a745;
}
.eta-card.normal {
  background-color: rgba(255, 193, 7, 0.1);
  border-color: #ffc107;
}
.eta-card.pessimistic {
  background-color: rgba(220, 53, 69, 0.1);
  border-color: #dc3545;
}
.eta-label {
  font-size: 0.9em;
  margin-bottom: 10px;
  font-weight: 600;
}
.eta-card.optimistic .eta-label { color: #28a745; }
.eta-card.normal .eta-label { color: #ffc107; }
.eta-card.pessimistic .eta-label { color: #dc3545; }
.eta-time {
  font-size: 2em;
  font-weight: bold;
  color: var(--color-text-primary);
  margin-bottom: 5px;
}
.eta-duration {
  font-size: 0.9em;
  color: var(--color-text-secondary);
}
/* Technical Breakdown */
.technical-breakdown {
  margin-top: 15px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}
.technical-breakdown summary {
  cursor: pointer;
  color: var(--color-accent);
  font-weight: 600;
  user-select: none;
}
.technical-breakdown summary:hover {
  color: var(--color-primary);
}
.breakdown-content {
  margin-top: 15px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.breakdown-content p {
  margin: 0;
  padding: 10px;
  background-color: var(--color-surface);
  border-radius: 4px;
  color: var(--color-text-secondary);
}
.breakdown-content strong {
  color: var(--color-text-primary);
}
/* Original Predictions */
.original-predictions {
  background-color: var(--color-background);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
}
.original-predictions h4 {
  margin: 0 0 10px 0;
  color: var(--color-text-secondary);
  font-size: 0.95em;
}
.predictions-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.predictions-row span {
  color: var(--color-text-secondary);
  font-size: 0.95em;
}
.predictions-row strong {
  color: var(--color-text-primary);
  font-size: 1.1em;
}
/* Buttons */
.button-primary,
.button-complete {
  padding: 12px 25px;
  font-size: 1em;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.button-primary {
  background-color: var(--color-primary);
  color: white;
}
.button-primary:hover:not(:disabled) {
  background-color: #3a5a7a;
}
.button-complete {
  background-color: var(--color-accent);
  color: var(--color-black);
}
.button-complete:hover:not(:disabled) {
  background-color: #bad0b1;
}
.button-primary:disabled,
.button-complete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* Completion Status */
.completion-status {
  margin-top: 15px;
  padding: 15px;
  border-radius: 6px;
  font-weight: 600;
  text-align: center;
}
.completion-status.success {
  background-color: rgba(40, 167, 69, 0.2);
  color: #28a745;
  border: 1px solid #28a745;
}
.completion-status.error {
  background-color: rgba(220, 53, 69, 0.2);
  color: #dc3545;
  border: 1px solid #dc3545;
}
/* Mobile Responsive */
@media (max-width: 768px) {
  .route-meta {
    gap: 15px;
  }
  .meta-item {
    flex: 1 1 45%;
  }
  .input-with-button {
    flex-direction: column;
  }
  .input-with-button button {
    width: 100%;
  }
  .eta-grid {
    grid-template-columns: 1fr;
  }
  .predictions-row {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
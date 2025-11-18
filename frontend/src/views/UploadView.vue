<template>
  <div class="upload-view">
    <!-- Header -->
    <header class="view-header">
      <h1 class="view-title">📤 Upload Route</h1>
    </header>

    <!-- Main Content -->
    <div class="content-wrapper">
      <!-- Block Details Card (Always visible) -->
      <div class="card block-details-card">
        <div class="card-header">
          <h2 class="card-title">📋 Block Details</h2>
        </div>
        <div class="card-body">
          <div class="details-grid">
            <div class="detail-group">
              <label class="detail-label">WAREHOUSE</label>
              <p class="detail-value">{{ activeBlock?.warehouse || 'N/A' }}</p>
            </div>
            <div class="detail-group">
              <label class="detail-label">DATE</label>
              <p class="detail-value">{{ formatDate(activeBlock?.date) || 'N/A' }}</p>
            </div>
            <div class="detail-group">
              <label class="detail-label">START TIME</label>
              <p class="detail-value">{{ activeBlock?.start_time || 'N/A' }}</p>
            </div>
            <div class="detail-group">
              <label class="detail-label">DURATION</label>
              <p class="detail-value">{{ activeBlock?.duration || 'N/A' }}h</p>
            </div>
            <div class="detail-group">
              <label class="detail-label">PAYMENT</label>
              <p class="detail-value">${{ activeBlock?.payment || 'N/A' }}</p>
            </div>
            <div class="detail-group">
              <label class="detail-label">VEHICLE</label>
              <p class="detail-value">{{ activeBlock?.vehicleName || 'N/A' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Route Configuration Card -->
      <div class="card route-config-card">
        <div class="card-header">
          <h2 class="card-title">🎯 Route Configuration</h2>
        </div>
        <div class="card-body">
          <div class="config-grid">
            <div class="config-group">
              <label class="config-label">Departure Point</label>
              <select v-model="selectedDeparturePoint" class="config-select">
                <option
                  v-for="point in departurePoints"
                  :key="point.value"
                  :value="point.value"
                >
                  {{ point.label }}
                </option>
              </select>
            </div>
            <div class="config-group">
              <label class="config-label">Final Destination</label>
              <select v-model="selectedFinalDestination" class="config-select">
                <option
                  v-for="destination in finalDestinations"
                  :key="destination.value"
                  :value="destination.value"
                >
                  {{ destination.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload/Paste Section (Only show if no results yet) -->
      <div v-if="!showResults" class="card upload-card">
        <div class="card-body">
          <!-- Gemini Button -->
          <button @click="openGeminiLink" class="gemini-button">
            <span class="gemini-icon">✨</span>
            Open Gem to Process Screenshots
          </button>
          <p class="upload-instruction">
            Upload your route screenshots to the Gem, then paste the JSON below
          </p>

          <!-- JSON Paste Area -->
          <div class="paste-section">
            <div class="paste-header">
              <span class="paste-icon">📋</span>
              <span class="paste-title">Paste Route JSON</span>
            </div>
            <textarea
              v-model="routeJson"
              placeholder='{"city": "ORLANDO", ...}'
              class="json-textarea"
              rows="10"
            ></textarea>
            <div v-if="jsonError" class="json-error">
              <span class="error-icon">⚠️</span>
              <span>{{ jsonError }}</span>
            </div>
          </div>

          <!-- Evaluate Button -->
          <button
            @click="evaluateScenarios"
            :disabled="!routeJson || isEvaluating"
            class="evaluate-button"
            :class="{ 'button-loading': isEvaluating }"
          >
            <span v-if="!isEvaluating" class="button-icon">🚀</span>
            <span v-else class="button-spinner">⏳</span>
            {{ isEvaluating ? 'Evaluating...' : 'Evaluate Scenarios' }}
          </button>
        </div>
      </div>

      <!-- NUEVO: Results Section with Slides -->
      <div v-if="showResults" class="results-section">
        <SlideContainer :routeData="routeData" />
        
        <!-- Back Button to Edit -->
        <button @click="resetToEdit" class="back-button">
          ← Edit Route
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isEvaluating" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">Analyzing route scenarios...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBlocksStore } from '@/stores/blocks'
import SlideContainer from '@/components/RouteResults/SlideContainer.vue'

const router = useRouter()
const blocksStore = useBlocksStore()

// State
const routeJson = ref('')
const jsonError = ref('')
const isEvaluating = ref(false)
const showResults = ref(false)
const routeData = ref(null)

const selectedDeparturePoint = ref('warehouse')
const selectedFinalDestination = ref('home')

// Computed
const activeBlock = computed(() => blocksStore.activeBlock)

const departurePoints = computed(() => {
  if (!activeBlock.value?.warehouse) return []
  return [
    {
      label: `${activeBlock.value.warehouse} (${activeBlock.value.warehouseDistance?.toFixed(0) || 0} mi)`,
      value: 'warehouse'
    }
  ]
})

const finalDestinations = computed(() => [
  { label: 'Casa', value: 'home' }
])

// Methods
const openGeminiLink = () => {
  window.open(
    'https://aistudio.google.com/app/prompts/new_chat?model=gemini-2.0-flash-exp',
    '_blank'
  )
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toISOString().split('T')[0]
}

const evaluateScenarios = async () => {
  jsonError.value = ''
  isEvaluating.value = true

  try {
    // Parse JSON
    const parsedData = JSON.parse(routeJson.value)

    // Validate basic structure
    if (!parsedData.stops || !Array.isArray(parsedData.stops)) {
      throw new Error('Invalid JSON: missing "stops" array')
    }

    // Simulate API call (replace with real API)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock route data (REPLACE THIS with real API response)
    routeData.value = {
      // From activeBlock
      warehouse: activeBlock.value?.warehouse,
      fecha: activeBlock.value?.date,
      hora: activeBlock.value?.start_time,
      duracion_horas: parseFloat(activeBlock.value?.duration) || 0,
      pago: parseFloat(activeBlock.value?.payment) || 0,
      vehiculo: activeBlock.value?.vehicleName,

      // Calculated values (these should come from your API)
      pago_por_hora: (parseFloat(activeBlock.value?.payment) || 0) / (parseFloat(activeBlock.value?.duration) || 1),
      antes_del_bloque: 0.38, // Example: 23 min
      despues_del_bloque: 0.42, // Example: 25 min
      tiempo_total: (parseFloat(activeBlock.value?.duration) || 0) + 0.8,
      pago_real_por_hora: 18.5, // Example

      // Mileage
      commute_1: parseFloat(activeBlock.value?.warehouseDistance) || 0,
      commute_2: 25.2, // Example
      millas_de_trabajo: 32.5, // Example
      millas_totales: 80.7, // Example
      millas_por_hora: 20.2, // Example

      // Financial
      gasto_de_gasolina: 8.50, // Example
      desgaste_vehiculo: 12.10, // Example
      tax: 9.68, // Example

      // FRI & ETA
      route_score: 6.8, // Example: 0-10 scale
      eta_normal: '17:45:00',
      eta_real: '17:52:00',
      
      // Additional
      primary_city: parsedData.city || 'Orlando',
      numero_paradas: parsedData.stops?.length || 0
    }

    showResults.value = true

  } catch (error) {
    console.error('Evaluation error:', error)
    jsonError.value = error.message || 'Invalid JSON format'
  } finally {
    isEvaluating.value = false
  }
}

const resetToEdit = () => {
  showResults.value = false
  routeData.value = null
  // Keep the JSON in case user wants to re-evaluate
}

onMounted(() => {
  if (!activeBlock.value) {
    router.push('/blocks')
  }
})
</script>

<style scoped>
.upload-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding-bottom: 80px;
}

.view-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.view-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  text-align: center;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Card Styles */
.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 2px solid #f1f5f9;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.card-body {
  padding: 20px;
}

/* Block Details */
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

/* Route Config */
.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.config-select {
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.config-select:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Gemini Button */
.gemini-button {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 12px;
}

.gemini-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3);
}

.gemini-icon {
  font-size: 20px;
}

.upload-instruction {
  text-align: center;
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px 0;
}

/* Paste Section */
.paste-section {
  margin-bottom: 20px;
}

.paste-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.paste-icon {
  font-size: 20px;
}

.paste-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.json-textarea {
  width: 100%;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  resize: vertical;
  transition: border-color 0.2s;
}

.json-textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.json-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef2f2;
  border: 2px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 14px;
  margin-top: 12px;
}

.error-icon {
  font-size: 18px;
}

/* Evaluate Button */
.evaluate-button {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.evaluate-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.3);
}

.evaluate-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-icon {
  font-size: 20px;
}

.button-spinner {
  font-size: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Results Section */
.results-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.back-button {
  width: 100%;
  padding: 14px;
  margin-top: 20px;
  background: #f1f5f9;
  color: #475569;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 1000;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: white;
  font-size: 18px;
  font-weight: 600;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .details-grid,
  .config-grid {
    grid-template-columns: 1fr;
  }

  .content-wrapper {
    padding: 16px;
  }
}
</style>
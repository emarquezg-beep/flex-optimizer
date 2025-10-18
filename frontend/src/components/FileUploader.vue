<script setup>
import { ref, computed } from 'vue';
import Tesseract from 'tesseract.js';

// --- VARIABLES Y DATOS ---
const extractedAddresses = ref([]);
const isProcessing = ref(false);
const backendResponse = ref(null);
const warehouses = [
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL' },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL' },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL' },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL' },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL' },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL' },
];
const destinations = ref([
  { code: 'Casa', address: '513 Alafaya Woods Blvd Oviedo, FL' },
  ...warehouses,
  { code: 'Otro (especificar abajo)', address: 'custom' }
]);
const selectedWarehouse = ref(warehouses[0].address);
const selectedDestination = ref(destinations.value[0].address);
const customDestination = ref('');

// --- PROPIEDADES COMPUTADAS ---
const reportData = computed(() => { /* ... unchanged ... */ });
const scenarioETAs = computed(() => { /* ... unchanged ... */ });

// --- FUNCIONES PARA EDITAR LA LISTA ---
function removeAddress(index) { extractedAddresses.value.splice(index, 1); }
function addAddress() { extractedAddresses.value.push({ number: null, address: '', isDowntown: false }); }
function reorderList() { extractedAddresses.value.sort((a, b) => a.number - b.number); }

// --- FUNCIONES DE PROCESAMIENTO ---
function preprocessImage(file) { /* ... unchanged ... */ }
function parseAddresses(rawText) { /* ... unchanged v13 ... */ }

// --- handleFileChange CON LOGGING ---
async function handleFileChange(event) {
  console.log("handleFileChange triggered!"); // Log 1
  const files = event.target.files;
  if (!files || files.length === 0) {
      console.log("No files selected."); // Log 2
      return;
  }
  console.log(`Files selected: ${files.length}`); // Log 3

  try {
      isProcessing.value = true;
      console.log("isProcessing set to true"); // Log 4
      extractedAddresses.value = [];
      backendResponse.value = null;
      let allParsedStops = [];

      console.log("Starting file processing loop..."); // Log 5
      for (const [index, file] of Array.from(files).entries()) {
      console.log(`Processing file ${index + 1}/${files.length}: ${file.name}`); // Log 6
      // const processedImage = await preprocessImage(file); // <--- TEMPORARILY DISABLED
      // console.log(`File ${index + 1} preprocessed.`); // Log 7
      const { data: { text } } = await Tesseract.recognize(file, 'eng'); // <--- Tesseract uses ORIGINAL file
      console.log(`File ${index + 1} OCR complete.`); // Log 8
      // ... rest of the loop
      }
      console.log("File processing loop finished."); // Log 10

      // Lógica de Gaps (sin cambios)
      const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));
      let maxStopNumber = 0;
      uniqueStopsMap.forEach(stop => {
          if (stop.number > maxStopNumber) maxStopNumber = stop.number;
      });
      const fullListWithGaps = [];
      for (let i = 1; i <= maxStopNumber; i++) {
          if (uniqueStopsMap.has(i)) {
              fullListWithGaps.push(uniqueStopsMap.get(i));
          } else {
              fullListWithGaps.push({ number: i, address: '', isDowntown: false });
          }
      }
      console.log("Gap filling complete."); // Log 11

      extractedAddresses.value = fullListWithGaps;
      console.log("extractedAddresses updated."); // Log 12

  } catch (error) {
      console.error("Error during handleFileChange:", error); // Log de Error
  } finally {
      isProcessing.value = false;
      console.log("isProcessing set to false."); // Log 13
  }
}


function sanitizeAddress(address) { /* ... unchanged ... */ }
async function sendToBackend() { /* ... unchanged ... */ }
</script>

<template>
    <div class="uploader-container">
        <input type="file" multiple accept="image/*" @change="handleFileChange" id="file-input" :disabled="isProcessing">
        <div v-if="isProcessing" class="status"><h3>Procesando imágenes...</h3></div>

        <div v-if="extractedAddresses.length > 0 && !isProcessing">
            <div class="controls-container">
                 <div class="control-group">
                    <label for="warehouse-select">Punto de Partida</label>
                    <select id="warehouse-select" v-model="selectedWarehouse">
                        <option v-for="wh in warehouses" :key="wh.code" :value="wh.address">{{ wh.code }}</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="destination-select">Destino Final</label>
                    <select id="destination-select" v-model="selectedDestination">
                        <option v-for="dest in destinations" :key="dest.code" :value="dest.address">{{ dest.code }}</option>
                    </select>
                </div>
            </div>
            <div v-if="selectedDestination === 'custom'" class="custom-input-container">
                 <input type="text" v-model="customDestination" placeholder="Escribe la dirección de destino aquí">
            </div>

            <div class="address-list">
                <h2 v-if="!backendResponse">📝 Revisa y Edita las Paradas ({{ extractedAddresses.length }})</h2>
                <h2 v-else>🗺️ Ruta Calculada ({{ optimizedDisplayList.length }} paradas)</h2>
                <ol class="ordered-list">
                    <li v-for="(stop, index) in extractedAddresses" :key="index" class="editable-item" :class="{ 'missing-stop': !stop.address }">
                        <input type="number" v-model="stop.number" class="stop-number-input" placeholder="#" :disabled="!!stop.address">
                        <input type="text" v-model="stop.address" class="address-input" placeholder="Dirección faltante...">
                        <label class="downtown-label" title="Marcar si es Downtown">
                            <input type="checkbox" v-model="stop.isDowntown" class="downtown-checkbox"> DT
                        </label>
                        <button @click="removeAddress(index)" class="button-delete">🗑️</button>
                    </li>
                </ol>
                <div class="action-buttons">
                    <button @click="addAddress" class="button-add">➕ Añadir Parada Manual</button>
                    <button @click="reorderList" class="button-reorder">🔄 Reordenar Lista</button>
                </div>
                <button @click="sendToBackend" class="button-map" :disabled="!!backendResponse && backendResponse.status !== 'loading'">
                     {{ (!backendResponse || backendResponse.status === 'loading') ? 'Evaluar Escenarios' : 'Resultados Calculados' }}
                 </button>

                <div v-if="backendResponse">
                    <div v-if="backendResponse.status === 'loading'" class="backend-status">Evaluando escenarios...</div>
                    <div v-else-if="reportData" class="results-container">
                        </div>
                    <div v-else-if="backendResponse.error" class="backend-status error">{{ backendResponse.error }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    /* Los estilos completos y correctos */
    .uploader-container { margin-top: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .status { margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-left: 5px solid #2196f3; color: #333; }
    .controls-container { display: flex; justify-content: space-between; gap: 20px; margin-top: 20px; padding: 20px; background-color: #f5f5f5; border-radius: 8px; }
    .control-group { flex: 1; display: flex; flex-direction: column; }
    .control-group label { margin-bottom: 8px; font-weight: bold; color: #333; }
    .control-group select { padding: 10px; font-size: 1em; border-radius: 5px; border: 1px solid #ccc; }
    .custom-input-container { margin: 10px 20px; }
    .custom-input-container input { width: 100%; padding: 10px; font-size: 1em; border: 1px solid #ccc; border-radius: 5px; }
    .address-list { margin-top: 20px; padding: 20px; border: 1px solid #c8e6c9; border-radius: 8px; text-align: left; background-color: #f1f8e9; }
    .address-list h2 { margin-top: 0; color: #388e3c; }
    .ordered-list { list-style-type: none; padding-left: 0; }
    li.editable-item { margin-bottom: 12px; font-size: 1.1em; line-height: 1.5; color: #333; }
    .editable-item { display: flex; align-items: center; gap: 5px; }
    .missing-stop .address-input, .missing-stop .stop-number-input { border-color: #f8d7da; background-color: #fff3f4; }
    .stop-number-input { width: 50px; padding: 8px; font-size: 1em; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-weight: bold; }
    .address-input { flex-grow: 1; padding: 8px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; }
    .downtown-label { display: flex; align-items: center; cursor: pointer; font-size: 0.9em; color: #6c757d; padding: 0 5px; }
    .downtown-checkbox { margin-right: 3px; width: 18px; height: 18px; cursor: pointer;}
    .button-delete { padding: 8px 10px; font-size: 0.9em; border: none; border-radius: 4px; cursor: pointer; background-color: #f8d7da; color: #721c24; }
    .action-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
    .button-add { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; padding: 10px; flex-grow: 1; cursor: pointer; border-radius: 5px; }
    .button-reorder { background-color: #d1e7fd; color: #0c5460; border: 1px solid #bee5eb; padding: 10px; flex-grow: 1; cursor: pointer; font-weight: bold; }
    .button-map { display: block; width: 100%; padding: 15px; font-size: 1.2em; font-weight: bold; color: white; background-color: #1976d2; border: none; border-radius: 5px; cursor: pointer; }
    .button-map:disabled { background-color: #6c757d; cursor: not-allowed; }
    .backend-status { margin-top: 15px; padding: 10px; background-color: #eee; border-radius: 4px; text-align: center; }
    .results-container { margin-top: 20px; padding: 15px; background-color: #f7f9fc; border: 1px solid #e1e8ed; border-radius: 8px; color: #212529; }
    .result-block { padding: 20px 0 10px 0; }
    .result-block.inverse-block { background-color: #fffaf0; margin: 0 -15px -15px -15px; padding: 20px 15px 0px 15px; border-radius: 0 0 8px 8px;}
    .result-block h4 { margin: 0 0 15px 0; color: #495057; }
    .result-block p { margin: 5px 0; font-size: 1.1em; color: #212529; }
    .segment-breakdown { padding-left: 15px; border-left: 2px solid #dee2e6; margin-left: 5px; margin-top: 10px; }
    .calc-details { font-size: 0.85em; color: #6c757d; display: inline; }
    .total-time { font-size: 1.1em !important; border-top: 1px solid #ced4da; padding-top: 8px; margin-top: 8px; }
    .grand-total { font-size: 1.25em !important; color: #007bff; }
    .dotted-hr { border: none; border-top: 2px dotted #adb5bd; margin: 15px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
    .backend-status.error { background-color: #fdecea; color: #c51162; }
    .scenario-table { padding: 10px 0; }
    .scenario-table h4 { margin: 0 0 10px 0; color: #495057; }
    .scenario-table table { width: 100%; border-collapse: collapse; }
    .scenario-table th, .scenario-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    .scenario-table .highlight { background-color: #e7f5ff; }
    .savings { color: #28a745; }
    .eta-block { background-color: #e6f7ff; margin: 0 -15px -15px -15px; padding: 20px 15px 15px 15px; border-radius: 0 0 8px 8px; border-top: 1px solid #ddd;}
    .eta-block.inverse-eta { background-color: #fffaf0; }
    .eta-block h4 { color: #0056b3; }
    .eta-scenario { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #b0e0e6; }
    .eta-scenario:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .eta-label { display: inline-block; width: 100px; font-weight: bold; }
    .eta-label.optimistic { color: #28a745; }
    .eta-label.normal { color: #ffc107; }
    .eta-label.pessimistic { color: #dc3545; }
    .eta-time { font-size: 1.3em; font-weight: bold; color: #0056b3; margin-right: 10px; }
    .eta-duration { font-size: 0.9em; color: #6c757d; }
</style>
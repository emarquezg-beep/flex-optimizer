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
const adjustedWorkTime = computed(() => {
    if (!backendResponse.value || !backendResponse.value.scenarioData) { return null; }
    let totalStopTime = 0; let apartmentCount = 0;
    const stops = backendResponse.value.originalStops;
    const stopCount = stops.length;
    stops.forEach(address => {
        const upperCaseAddress = address.toUpperCase();
        totalStopTime += 1.5;
        if (upperCaseAddress.includes('APT') || upperCaseAddress.includes('UNIT') || upperCaseAddress.includes('#')) {
            apartmentCount++;
            totalStopTime += 1.5;
        }
    });
    const totalEstimatedDuration = backendResponse.value.scenarioData.tramoX.duration + totalStopTime;
    return {
        driveDuration: backendResponse.value.scenarioData.tramoX.duration,
        stopDuration: totalStopTime,
        totalDuration: Math.round(totalEstimatedDuration),
        stopCount: stopCount,
        apartmentCount: apartmentCount
    };
});
const scenarioResults = computed(() => {
    if (!backendResponse.value || !backendResponse.value.scenarioData) { return null; }
    const { tramoA, tramoB, tramoC, tramoD, tramoX } = backendResponse.value.scenarioData;
    const A = parseFloat(tramoA.distance); const B = parseFloat(tramoB.distance);
    const C = parseFloat(tramoC.distance); const D = parseFloat(tramoD.distance);
    const X = parseFloat(tramoX.distance);
    const normalTotal = A + X + B; const inverseTotal = C + X + D;
    const savings = normalTotal - inverseTotal;
    return {
        normal: normalTotal.toFixed(2),
        inverse: inverseTotal.toFixed(2),
        savings: savings.toFixed(2),
        blockMiles: X.toFixed(2),
    };
});

// --- FUNCIONES PARA EDITAR LA LISTA ---
function removeAddress(index) {
    extractedAddresses.value.splice(index, 1);
}
// ¡NUEVA FUNCIÓN MEJORADA!
function addAddress() {
    // Añade un objeto con campos vacíos para número y dirección.
    extractedAddresses.value.push({ number: null, address: '' });
}
// ¡NUEVA FUNCIÓN PARA REORDENAR!
function reorderList() {
    extractedAddresses.value.sort((a, b) => a.number - b.number);
}

// --- FUNCIONES DE PROCESAMIENTO ---
function preprocessImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader(); reader.onload = (e) => { const img = new Image(); img.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data; const contrast = 2.0; const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128; data[i+1] = factor * (data[i+1] - 128) + 128; data[i+2] = factor * (data[i+2] - 128) + 128;
      const avg = (data[i] + data[i+1] + data[i+2]) / 3; data[i] = avg; data[i+1] = avg; data[i+2] = avg;
    }
    ctx.putImageData(imageData, 0, 0); resolve(canvas.toDataURL('image/png'));
    }; img.src = e.target.result; }; reader.readAsDataURL(file);
  });
}
function parseAddresses(rawText) {
  const stops = []; const stopWords = ['Deliver', 'Current stop', 'Scheduled', 'ITINERARY']; let lastKnownCity = 'Orlando';
  const pattern = /\((\d+)\)([\s\S]*?)(?=\(\d+\)|$)/g;
  let match;
  while ((match = pattern.exec(rawText)) !== null) {
    const stopNumber = parseInt(match[1]);
    const textBlock = match[2];
    const addressPattern = /(\d{3,5}\s[A-Z].*)/;
    const addressMatch = textBlock.match(addressPattern);
    if (addressMatch) {
      let street = addressMatch[1].trim(); let city = '';
      const lines = textBlock.substring(textBlock.indexOf(street)).split('\n');
      if (lines.length > 1) {
        let nextLine = lines[1].trim();
        for (const word of stopWords) { if (nextLine.includes(word)) { nextLine = nextLine.substring(0, nextLine.indexOf(word)).trim(); } }
        if (nextLine.length > 3) { city = nextLine; lastKnownCity = city; }
      }
      if (!city) { city = lastKnownCity; }
      stops.push({ number: stopNumber, address: `${street} ${city}` });
    }
  }
  return stops;
}
async function handleFileChange(event) {
  const files = event.target.files; if (!files.length) return;
  isProcessing.value = true; extractedAddresses.value = []; backendResponse.value = null; 
  let allParsedStops = [];
  for (const file of files) {
    const processedImage = await preprocessImage(file);
    const { data: { text } } = await Tesseract.recognize(processedImage, 'eng');
    const stopsFromFile = parseAddresses(text);
    allParsedStops.push(...stopsFromFile);
  }
  const uniqueStops = Array.from(new Map(allParsedStops.map(stop => [stop.number, stop])).values());
  uniqueStops.sort((a, b) => a.number - b.number);
  extractedAddresses.value = uniqueStops;
  isProcessing.value = false;
}
function sanitizeAddress(address) {
    if (!address) return '';
    return address.replace(/[^a-zA-Z0-9\s#]/g, '').replace(/\s+/g, ' ').trim();
}
async function sendToBackend() {
  const addressesToSend = extractedAddresses.value.map(stop => stop.address);
  const sanitizedAddresses = addressesToSend.map(sanitizeAddress).filter(addr => addr && addr.trim() !== '');
  if (sanitizedAddresses.length === 0) { alert('No hay direcciones válidas para optimizar.'); return; }
  const finalDestination = selectedDestination.value === 'custom' ? sanitizeAddress(customDestination.value) : sanitizeAddress(selectedDestination.value);
  if (!finalDestination) { alert('Por favor, especifica un destino final.'); return; }
  const fullRoute = [sanitizeAddress(selectedWarehouse.value), ...sanitizedAddresses, finalDestination];
  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  backendResponse.value = { status: 'loading' }; 
  try {
    const response = await fetch(`${backendUrl}/api/optimize-route`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses: fullRoute }),
    });
    const result = await response.json();
    backendResponse.value = result;
  } catch (error) {
    backendResponse.value = { error: 'Error: No se pudo conectar al servidor.' };
  }
}
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
                <h2>📝 Revisa y Edita las Paradas ({{ extractedAddresses.length }})</h2>
                <ol class="ordered-list">
                    <li v-for="(stop, index) in extractedAddresses" :key="index" class="editable-item">
                        <input type="number" v-model="stop.number" class="stop-number-input" placeholder="#">
                        <input type="text" v-model="stop.address" class="address-input" placeholder="Dirección de la parada">
                        <button @click="removeAddress(index)" class="button-delete">🗑️</button>
                    </li>
                </ol>
                
                <div class="action-buttons">
                    <button @click="addAddress" class="button-add">➕ Añadir Parada</button>
                    <button @click="reorderList" class="button-reorder">🔄 Reordenar Lista</button>
                </div>
                
                <button @click="sendToBackend" class="button-map">Evaluar Escenarios</button>

                <div v-if="backendResponse">
                    <div v-if="backendResponse.status === 'loading'" class="backend-status">Evaluando escenarios...</div>
                    <div v-else-if="scenarioResults" class="results-container">
                        <div class="scenario-table">
                            <h4>📊 Comparación de Escenarios</h4>
                            <table>
                                <thead>
                                    <tr><th>Escenario</th><th>Millas Totales</th><th>Ahorro</th></tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Ruta Normal (1 → Fin)</td>
                                        <td>{{ scenarioResults.normal }} mi</td>
                                        <td>-</td>
                                    </tr>
                                    <tr class="highlight">
                                        <td><strong>Ruta Inversa (Fin → 1)</strong></td>
                                        <td><strong>{{ scenarioResults.inverse }} mi</strong></td>
                                        <td><strong class="savings">{{ scenarioResults.savings > 0 ? `-${scenarioResults.savings}` : `+${Math.abs(scenarioResults.savings)}` }} mi</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <hr>
                        <div class="result-block">
                            <h4>💼 Detalles del Bloque</h4>
                            <p class="main-metric">{{ scenarioResults.blockMiles }} mi (trabajo)</p>
                            <div v-if="adjustedWorkTime" class="time-breakdown">
                                <p>Tiempo de Conducción: <strong>{{ adjustedWorkTime.driveDuration }} min</strong></p>
                                <p class="adjustment-calc">+ Tiempo en Paradas: <strong>{{ adjustedWorkTime.stopDuration }} min</strong>
                                    <span class="calc-details">({{ adjustedWorkTime.stopCount }} paradas, {{ adjustedWorkTime.apartmentCount }} son aptos)</span>
                                </p>
                                <hr class="dotted-hr">
                                <p class="total-time">Tiempo Estimado Total: <strong>{{ adjustedWorkTime.totalDuration }} min</strong></p>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="backendResponse.error" class="backend-status error">{{ backendResponse.error }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
    .editable-item { display: flex; align-items: center; gap: 10px; }
    .stop-number-input {
        width: 60px;
        padding: 8px;
        font-size: 1em;
        text-align: center;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-weight: bold;
    }
    .address-input { flex-grow: 1; padding: 8px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; }
    .button-delete { padding: 8px 12px; font-size: 1em; border: none; border-radius: 4px; cursor: pointer; background-color: #f8d7da; color: #721c24; }
    
    .action-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
    .button-add { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; padding: 10px; flex-grow: 1; cursor: pointer; border-radius: 5px; }
    .button-reorder { background-color: #d1e7fd; color: #0c5460; border: 1px solid #bee5eb; padding: 10px; flex-grow: 1; cursor: pointer; border-radius: 5px; font-weight: bold;}
    
    .button-map { display: block; width: 100%; padding: 15px; font-size: 1.2em; font-weight: bold; color: white; background-color: #1976d2; border: none; border-radius: 5px; cursor: pointer; }
    .backend-status { margin-top: 15px; padding: 10px; background-color: #eee; border-radius: 4px; text-align: center; }
    .results-container { margin-top: 20px; padding: 15px; background-color: #f7f9fc; border: 1px solid #e1e8ed; border-radius: 8px; color: #212529; }
    .result-block { padding: 10px 0; }
    .result-block h4 { margin: 0 0 10px 0; color: #495057; }
    .result-block p { margin: 5px 0; font-size: 1.1em; color: #212529; }
    .main-metric { font-size: 1.4em !important; font-weight: bold; }
    .time-breakdown { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ced4da; }
    .adjustment-calc { font-size: 1em !important; }
    .calc-details { font-size: 0.85em; color: #6c757d; display: block; }
    .total-time { font-size: 1.2em !important; font-weight: bold; color: #007bff; }
    .dotted-hr { border: none; border-top: 2px dotted #adb5bd; margin: 8px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
    .backend-status.error { background-color: #fdecea; color: #c51162; }
    
    .scenario-table { padding: 10px 0; }
    .scenario-table h4 { margin: 0 0 10px 0; color: #495057; }
    .scenario-table table { width: 100%; border-collapse: collapse; }
    .scenario-table th, .scenario-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    .scenario-table th { font-size: 0.9em; color: #6c757d; }
    .scenario-table .highlight { background-color: #e7f5ff; }
    .savings { color: #28a745; }
</style>
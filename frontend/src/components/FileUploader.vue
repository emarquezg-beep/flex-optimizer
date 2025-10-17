<script setup>
import { ref, computed } from 'vue';
import Tesseract from 'tesseract.js';

// --- VARIABLES Y DATOS (sin cambios) ---
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

// --- PROPIEDADES COMPUTADAS (sin cambios) ---
const optimizedDisplayList = computed(() => {
  if (!backendResponse.value || !backendResponse.value.optimizedAddressList) {
    return extractedAddresses.value;
  }
  return backendResponse.value.optimizedAddressList;
});
const adjustedWorkTime = computed(() => {
    if (!backendResponse.value || !backendResponse.value.workDuration) { return null; }
    let totalStopTime = 0; let apartmentCount = 0;
    const stopCount = optimizedDisplayList.value.length;
    optimizedDisplayList.value.forEach(address => {
        const upperCaseAddress = address.toUpperCase();
        totalStopTime += 1.5;
        if (upperCaseAddress.includes('APT') || upperCaseAddress.includes('UNIT') || upperCaseAddress.includes('#')) {
            apartmentCount++;
            totalStopTime += 1.5;
        }
    });
    const totalEstimatedDuration = backendResponse.value.workDuration + totalStopTime;
    return {
        driveDuration: backendResponse.value.workDuration,
        stopDuration: totalStopTime,
        totalDuration: Math.round(totalEstimatedDuration),
        stopCount: stopCount,
        apartmentCount: apartmentCount
    };
});

// --- FUNCIONES PARA EDITAR LA LISTA (sin cambios) ---
function removeAddress(index) {
    const addressToRemove = optimizedDisplayList.value[index];
    const originalIndex = extractedAddresses.value.findIndex(addr => addr === addressToRemove);
    if (originalIndex > -1) {
        extractedAddresses.value.splice(originalIndex, 1);
    }
}
function addAddress() {
    extractedAddresses.value.push('');
}

// --- FUNCIONES DE PROCESAMIENTO (sin cambios) ---
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
  const finalAddresses = [];
  const lines = rawText.split('\n');
  const stopWords = ['Deliver', 'Current stop', 'Scheduled', 'ITINERARY'];
  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    const addressPattern = /(\d{3,5}\s[A-Z].*)/; 
    const match = currentLine.match(addressPattern);
    if (match) {
      let street = match[1].trim();
      let city = '';
      if (i + 1 < lines.length) {
        let nextLine = lines[i+1].trim();
        for (const word of stopWords) {
            if (nextLine.includes(word)) {
                nextLine = nextLine.substring(0, nextLine.indexOf(word)).trim();
            }
        }
        if (nextLine.length > 3) {
          city = nextLine;
        }
      }
      if (street && city) {
        finalAddresses.push(`${street} ${city}`);
      }
    }
  }
  return finalAddresses;
}

async function handleFileChange(event) {
  const files = event.target.files; if (!files.length) return;
  isProcessing.value = true; extractedAddresses.value = []; backendResponse.value = null; let allParsedAddresses = [];
  for (const file of files) {
    const processedImage = await preprocessImage(file);
    const { data: { text } } = await Tesseract.recognize(processedImage, 'eng');
    const addressesFromFile = parseAddresses(text);
    allParsedAddresses.push(...addressesFromFile);
  }
  const uniqueAddresses = [...new Set(allParsedAddresses)];
  extractedAddresses.value = uniqueAddresses;
  isProcessing.value = false;
}

function sanitizeAddress(address) {
    if (!address) return '';
    return address.replace(/[^a-zA-Z0-9\s#]/g, '').replace(/\s+/g, ' ').trim();
}

async function sendToBackend() {
  const sanitizedAddresses = extractedAddresses.value.map(sanitizeAddress).filter(addr => addr && addr.trim() !== '');
  if (sanitizedAddresses.length === 0) { alert('No hay direcciones válidas para optimizar.'); return; }
  const finalDestination = selectedDestination.value === 'custom' 
    ? sanitizeAddress(customDestination.value) 
    : sanitizeAddress(selectedDestination.value);
  if (!finalDestination) { alert('Por favor, especifica un destino final.'); return; }
  const fullRoute = [sanitizeAddress(selectedWarehouse.value), ...sanitizedAddresses, finalDestination];
  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  backendResponse.value = { status: 'loading' }; 
  try {
    const response = await fetch(`${backendUrl}/api/optimize-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: fullRoute }),
    });
    const result = await response.json();
    backendResponse.value = result;
  } catch (error) {
    console.error("Fetch error:", error);
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
                <h2 v-if="!backendResponse">📝 Revisa y Edita las Paradas ({{ extractedAddresses.length }})</h2>
                <h2 v-else>🗺️ Ruta Optimizada ({{ optimizedDisplayList.length }} paradas)</h2>
                
                <ol>
                    <li v-for="(address, index) in optimizedDisplayList" :key="index" class="editable-item">
                        <input type="text" v-model="optimizedDisplayList[index]" class="address-input">
                        <button v-if="!backendResponse" @click="removeAddress(index)" class="button-delete">🗑️</button>
                    </li>
                </ol>
                
                <button v-if="!backendResponse" @click="addAddress" class="button-add">➕ Añadir Parada</button>
                
                <button @click="sendToBackend" class="button-map">Calcular Ruta Optimizada</button>

                <div v-if="backendResponse">
                    <div v-if="backendResponse.status === 'loading'" class="backend-status">Optimizando ruta...</div>
                    <div v-else-if="backendResponse.workDistance" class="results-container">
                        <div class="result-block">
                            <h4>💼 Millas de Trabajo (Sin Peajes)</h4>
                            <p class="main-metric">{{ backendResponse.workDistance }} mi</p>
                            <div v-if="adjustedWorkTime" class="time-breakdown">
                                <p>Tiempo de Conducción: <strong>{{ adjustedWorkTime.driveDuration }} min</strong></p>
                                <p class="adjustment-calc">+ Tiempo en Paradas: <strong>{{ adjustedWorkTime.stopDuration }} min</strong>
                                    <span class="calc-details">({{ adjustedWorkTime.stopCount }} paradas, {{ adjustedWorkTime.apartmentCount }} son aptos)</span>
                                </p>
                                <hr class="dotted-hr">
                                <p class="total-time">Tiempo Estimado Total: <strong>{{ adjustedWorkTime.totalDuration }} min</strong></p>
                            </div>
                        </div>
                        <hr>
                        <div class="result-block commute">
                            <h4>🚗 Commute a Destino Final</h4>
                            <div class="option">
                                <span class="toll-tag with-toll">CON PEAJE</span>
                                <p>{{ backendResponse.commute.withTolls.distance }} mi / {{ backendResponse.commute.withTolls.duration }} min</p>
                                <p class="cost">Costo: <strong>{{ backendResponse.commute.withTolls.cost }}</strong></p>
                            </div>
                            <div class="option">
                                <span class="toll-tag no-toll">SIN PEAJE</span>
                                <p>{{ backendResponse.commute.withoutTolls.distance }} mi / {{ backendResponse.commute.withoutTolls.duration }} min</p>
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
    .uploader-container {
        margin-top: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .status {
        margin: 20px 0;
        padding: 15px;
        background-color: #e3f2fd;
        border-left: 5px solid #2196f3;
        color: #333;
    }
    .controls-container {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        margin-top: 20px;
        padding: 20px;
        background-color: #f5f5f5;
        border-radius: 8px;
    }
    .control-group {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    .control-group label {
        margin-bottom: 8px;
        font-weight: bold;
        color: #333;
    }
    .control-group select {
        padding: 10px;
        font-size: 1em;
        border-radius: 5px;
        border: 1px solid #ccc;
    }
    .custom-input-container {
        margin: 10px 20px;
    }
    .custom-input-container input {
        width: 100%;
        padding: 10px;
        font-size: 1em;
        border: 1px solid #ccc;
        border-radius: 5px;
    }
    .address-list {
        margin-top: 20px;
        padding: 20px;
        border: 1px solid #c8e6c9;
        border-radius: 8px;
        text-align: left;
        background-color: #f1f8e9;
    }
    .address-list h2 {
        margin-top: 0;
        color: #388e3c;
    }
    ol {
        padding-left: 25px;
    }
    li {
        margin-bottom: 12px;
        font-size: 1.1em;
        line-height: 1.5;
        color: #333;
    }
    .editable-item {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .address-input {
        flex-grow: 1;
        padding: 8px;
        font-size: 1em;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    .button-delete, .button-add {
        padding: 8px 12px;
        font-size: 1em;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background-color: #f8d7da;
        color: #721c24;
    }
    .button-add {
        background-color: #d4edda;
        color: #155724;
        display: block;
        width: 100%;
        margin-bottom: 20px;
    }
    .button-map {
        display: block;
        width: 100%;
        padding: 15px;
        margin-top: 20px;
        font-size: 1.2em;
        font-weight: bold;
        color: white;
        background-color: #1976d2;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
    }
    .button-map:hover {
        background-color: #1565c0;
    }
    .backend-status {
        margin-top: 15px;
        padding: 10px;
        background-color: #eee;
        border-radius: 4px;
        text-align: center;
    }
    .results-container {
        margin-top: 20px;
        padding: 15px;
        background-color: #f7f9fc;
        border: 1px solid #e1e8ed;
        border-radius: 8px;
        color: #212529;
    }
    .result-block {
        padding: 10px 0;
    }
    .result-block h4 {
        margin: 0 0 10px 0;
        color: #495057;
    }
    .result-block p {
        margin: 5px 0;
        font-size: 1.1em;
        color: #212529;
    }
    .main-metric {
        font-size: 1.4em !important;
        font-weight: bold;
    }
    .time-breakdown {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px dashed #ced4da;
    }
    .adjustment-calc {
        font-size: 1em !important;
    }
    .calc-details {
        font-size: 0.85em;
        color: #6c757d;
        display: block;
    }
    .total-time {
        font-size: 1.2em !important;
        font-weight: bold;
        color: #007bff;
    }
    .dotted-hr {
        border: none;
        border-top: 2px dotted #adb5bd;
        margin: 8px 0;
    }
    .commute .option {
        padding: 10px;
        border-radius: 5px;
        margin-bottom: 10px;
        border-left: 5px solid #eee;
    }
    .commute .option:first-of-type {
        border-left-color: #f44336;
    }
    .commute .option:last-of-type {
        border-left-color: #4caf50;
    }
    .commute .option p {
        color: #212529;
    }
    .cost {
        font-size: 1em !important;
        color: #495057;
    }
    .toll-tag {
        font-weight: bold;
        padding: 3px 8px;
        border-radius: 12px;
        color: white;
        font-size: 0.8em;
    }
    .toll-tag.with-toll {
        background-color: #f44336;
    }
    .toll-tag.no-toll {
        background-color: #4caf50;
    }
    hr {
        border: none;
        border-top: 1px solid #ddd;
        margin: 10px 0;
    }
    .backend-status.error {
        background-color: #fdecea;
        color: #c51162;
    }
</style>
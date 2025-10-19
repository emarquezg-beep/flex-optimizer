<script setup>
import { ref, computed } from 'vue';
import Tesseract from 'tesseract.js';

// --- STATE & DATA (Unchanged) ---
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

// --- COMPUTED PROPERTIES (CORRECTED DATA ACCESS) ---
const reportData = computed(() => {
    // Check if backend response has the scenario data AND original stops
    if (!backendResponse.value?.scenarioData || !backendResponse.value?.originalStops) {
        return null;
    }

    const { tramoA, tramoB, tramoC, tramoD, tramoX } = backendResponse.value.scenarioData;
    const originalStops = backendResponse.value.originalStops || []; // Get the original stops list

    let totalBlockStopTime = 0;
    let totalApartmentCount = 0;
    let totalDowntownCount = 0;
    const totalStopCount = originalStops.length;

    // Calculate stop times based on the ORIGINAL stops list
    originalStops.forEach(addr => {
        const stopData = extractedAddresses.value.find(s => s.address === addr); // Find data from editable list
        const isDowntown = stopData ? stopData.isDowntown : false;
        const isApartment = addr && addr.toUpperCase().match(/APT|UNIT|#/);

        totalBlockStopTime += 1.5; // Base stop time
        if (isDowntown) {
            totalDowntownCount++;
            totalBlockStopTime += 4.5; // Extra Downtown time
        } else if (isApartment) {
            totalApartmentCount++;
            totalBlockStopTime += 1.5; // Extra Regular Apartment time
        }
    });

    // Safely parse numbers from tramos
    const distA = parseFloat(tramoA?.distance || 0);
    const durA = parseFloat(tramoA?.duration || 0);
    const distB = parseFloat(tramoB?.distance || 0);
    const durB = parseFloat(tramoB?.duration || 0);
    const distC = parseFloat(tramoC?.distance || 0);
    const durC = parseFloat(tramoC?.duration || 0);
    const distD = parseFloat(tramoD?.distance || 0);
    const durD = parseFloat(tramoD?.duration || 0);
    const distX = parseFloat(tramoX?.distance || 0);
    const durX = parseFloat(tramoX?.duration || 0); // This is BLOCK DRIVE DURATION

    // Normal Route Calculations
    const totalWorkMiles = distA + distX;
    const totalWorkDuration = durA + durX + totalBlockStopTime; // Add calculated stop time
    const totalNormalMiles = totalWorkMiles + distB;
    const totalNormalDuration = totalWorkDuration + durB;

    // Inverse Route Calculations
    const totalInverseWorkMiles = distC + distX;
    const totalInverseWorkDuration = durC + durX + totalBlockStopTime; // Add calculated stop time
    const totalInverseMiles = totalInverseWorkMiles + distD;
    const totalInverseDuration = totalInverseWorkDuration + durD;

    // Prepare dummy segments structure for display (using block time only)
    // This part is simplified as the backend doesn't return segments anymore.
    // We display total block drive time and total stop time separately.
    const dummySegments = [{
        distance: distX.toFixed(2),
        duration: Math.round(durX),
        stopTime: totalBlockStopTime,
        aptCount: totalApartmentCount - totalDowntownCount,
        downtownCount: totalDowntownCount,
        stopsCount: totalStopCount
     }];


    return {
        savings: (totalNormalMiles - totalInverseMiles).toFixed(2),
        normal: {
            toStart: { distance: distA.toFixed(2), duration: Math.round(durA) },
            // Use dummy segment data for display consistency
            segments: dummySegments,
            toEnd: { distance: distB.toFixed(2), duration: Math.round(durB) },
            totalWorkMiles: totalWorkMiles.toFixed(2),
            totalWorkDuration: Math.round(totalWorkDuration),
            totalMiles: totalNormalMiles.toFixed(2),
            totalDuration: Math.round(totalNormalDuration),
            baseDriveDuration: durA + durX, // For ETA
            commuteDuration: durB, // For ETA
        },
        inverse: {
            toStart: { distance: distC.toFixed(2), duration: Math.round(durC) },
            segments: dummySegments, // Use dummy segment data
            toEnd: { distance: distD.toFixed(2), duration: Math.round(durD) },
            totalWorkMiles: totalInverseWorkMiles.toFixed(2),
            totalWorkDuration: Math.round(totalInverseWorkDuration),
            totalMiles: totalInverseMiles.toFixed(2),
            totalDuration: Math.round(totalInverseDuration),
            baseDriveDuration: durC + durX, // For ETA
            commuteDuration: durD, // For ETA
        },
        stopCount: totalStopCount,
        apartmentCount: totalApartmentCount,
        downtownCount: totalDowntownCount,
    };
});

// scenarioETAs now correctly accesses data via reportData
const scenarioETAs = computed(() => {
    if (!reportData.value?.normal?.baseDriveDuration || !reportData.value?.inverse?.baseDriveDuration) {
         return null;
    }
    const stopCount = Number(reportData.value.stopCount) || 0;
    const apartmentCount = Number(reportData.value.apartmentCount) || 0;
    const downtownCount = Number(reportData.value.downtownCount) || 0;
    const regularApartmentCount = apartmentCount - downtownCount;
    const now = new Date();
    const calculateScenario = (baseDrive, commute, multiplier) => {
        const baseStopTime = stopCount * multiplier;
        const extraTime = (regularApartmentCount * 1.5) + (downtownCount * 4.5);
        const totalDuration = (Number(baseDrive) || 0) + baseStopTime + extraTime + (Number(commute) || 0);
        if (isNaN(totalDuration)) { return { totalDuration: 'N/A', eta: 'Error' }; }
        const eta = new Date(now.getTime() + totalDuration * 60000);
        return {
            totalDuration: Math.round(totalDuration),
            eta: eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        };
    };
    const normalBaseDrive = Number(reportData.value.normal.baseDriveDuration) || 0;
    const normalCommute = Number(reportData.value.normal.commuteDuration) || 0;
    const inverseBaseDrive = Number(reportData.value.inverse.baseDriveDuration) || 0;
    const inverseCommute = Number(reportData.value.inverse.commuteDuration) || 0;
    return {
        normal: {
            optimistic: calculateScenario(normalBaseDrive, normalCommute, 0.90),
            normal: calculateScenario(normalBaseDrive, normalCommute, 1.10),
            pessimistic: calculateScenario(normalBaseDrive, normalCommute, 1.50)
        },
        inverse: {
            optimistic: calculateScenario(inverseBaseDrive, inverseCommute, 0.90),
            normal: calculateScenario(inverseBaseDrive, inverseCommute, 1.10),
            pessimistic: calculateScenario(inverseBaseDrive, inverseCommute, 1.50)
        }
    };
});


// --- EDITING FUNCTIONS (Unchanged) ---
function removeAddress(index) { extractedAddresses.value.splice(index, 1); }
function addAddress() { extractedAddresses.value.push({ number: null, address: '', isDowntown: false }); }
function reorderList() { extractedAddresses.value.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)); }

// --- PROCESSING FUNCTIONS (Unchanged) ---
function preprocessImage(file) { /* ... unchanged ... */ }
function parseAddresses(rawText) { /* ... unchanged ... */ }
async function handleFileChange(event) { /* ... unchanged ... */ }
function sanitizeAddress(address) { /* ... unchanged ... */ }
async function sendToBackend() {
  const invalidStop = extractedAddresses.value.find(stop => !stop.address || stop.address.trim() === '');
  if (invalidStop) {
      alert(`¡Epa! Parece que te falta completar la dirección para la parada #${invalidStop.number}. Por favor, revísala.`);
      return;
  }
  const addressesToSend = extractedAddresses.value.map(stop => stop.address);
  const sanitizedAddresses = addressesToSend.map(sanitizeAddress).filter(addr => addr);
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
     if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
     }
    backendResponse.value = result;
  } catch (error) {
    console.error("Fetch error:", error);
    backendResponse.value = { error: `Error: ${error.message || 'No se pudo conectar al servidor.'}` };
  }
}
</script>

<template>
    <div class="uploader-container">
        <input type="file" multiple accept="image/*" @change="handleFileChange" id="file-input" :key="fileInputKey" :disabled="isProcessing || !!backendResponse">
        <div v-if="isProcessing" class="status"><h3>Procesando imágenes...</h3></div>

         <button v-if="backendResponse && backendResponse.status !== 'loading'" @click="resetApp" class="button-reset">
             🔄 Nueva Ruta
         </button>

        <div v-if="extractedAddresses.length > 0 && !isProcessing">
            <div class="controls-container">
                 <div class="control-group">
                    <label for="warehouse-select">Punto de Partida</label>
                    <select id="warehouse-select" v-model="selectedWarehouse" :disabled="!!backendResponse">
                        <option v-for="wh in warehouses" :key="wh.code" :value="wh.address">{{ wh.code }}</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="destination-select">Destino Final</label>
                    <select id="destination-select" v-model="selectedDestination" :disabled="!!backendResponse">
                        <option v-for="dest in destinations" :key="dest.code" :value="dest.address">{{ dest.code }}</option>
                    </select>
                </div>
            </div>
            <div v-if="selectedDestination === 'custom'" class="custom-input-container">
                 <input type="text" v-model="customDestination" placeholder="Escribe la dirección de destino aquí" :disabled="!!backendResponse">
            </div>

            <div class="address-list">
                <h2 v-if="!backendResponse">📝 Revisa y Edita las Paradas ({{ extractedAddresses.length }})</h2>
                <h2 v-else>🗺️ Ruta Calculada ({{ extractedAddresses.length }})</h2>
                <ol class="ordered-list">
                    <li v-for="(stop, index) in extractedAddresses" :key="index" class="editable-item" :class="{ 'missing-stop': !stop.address }">
                        <input type="number" v-model="stop.number" class="stop-number-input" placeholder="#" :disabled="!!stop.address && stop.address !== '' || !!backendResponse">
                        <input type="text" v-model="stop.address" class="address-input" placeholder="Dirección faltante..." :disabled="!!backendResponse">
                        <label class="downtown-label" title="Marcar si es Downtown">
                            <input type="checkbox" v-model="stop.isDowntown" class="downtown-checkbox" :disabled="!!backendResponse"> DT
                        </label>
                        <button v-if="!backendResponse" @click="removeAddress(index)" class="button-delete">🗑️</button>
                    </li>
                </ol>
                <div v-if="!backendResponse" class="action-buttons">
                    <button @click="addAddress" class="button-add">➕ Añadir Parada Manual</button>
                    <button @click="reorderList" class="button-reorder">🔄 Reordenar Lista</button>
                </div>
                 <button v-if="!backendResponse || backendResponse.status === 'loading'" @click="sendToBackend" class="button-map" :disabled="backendResponse?.status === 'loading'">
                     {{ backendResponse?.status === 'loading' ? 'Calculando...' : 'Evaluar Escenarios' }}
                 </button>

                <div v-if="backendResponse">
                    <div v-if="backendResponse.status === 'loading'" class="backend-status">Evaluando escenarios...</div>
                    <div v-else-if="reportData" class="results-container">
                        <div class="scenario-table">
                            <h4>📊 Comparación Final</h4>
                            <table>
                                <tbody>
                                    <tr><td>Ruta Normal (1 → Fin)</td><td>{{ reportData.normal.totalMiles }} mi</td><td>-</td></tr>
                                    <tr class="highlight">
                                        <td><strong>Ruta Inversa (Fin → 1)</strong></td>
                                        <td><strong>{{ reportData.inverse.totalMiles }} mi</strong></td>
                                        <td><strong class="savings">{{ reportData.savings > 0 ? `-${reportData.savings}` : `+${Math.abs(reportData.savings)}` }} mi</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <hr>
                        <div class="result-block">
                            <h4>➡️ Desglose Ruta Normal</h4>
                            <p>Hacia 1ra Parada: <strong>{{ reportData.normal.toStart.duration }} min - {{ reportData.normal.toStart.distance }} mi</strong></p>
                            <div class="segment-breakdown">
                                <p>Bloque (Drive): <strong>{{ reportData.normal.segments[0].duration }} min - {{ reportData.normal.segments[0].distance }} mi</strong></p>
                                <p class="calc-details">Tiempo Paradas: +{{ reportData.normal.segments[0].stopTime }} min ({{ reportData.normal.stopCount }} paradas | {{ reportData.normal.apartmentCount - reportData.normal.downtownCount }} aptos | {{ reportData.normal.downtownCount }} DT)</p>
                            </div>
                            <hr class="dotted-hr">
                            <p class="total-time"><strong>Total Trabajo: {{ reportData.normal.totalWorkDuration }} min - {{ reportData.normal.totalWorkMiles }} mi</strong></p>
                            <p>Hacia Destino Final: <strong>{{ reportData.normal.toEnd.duration }} min - {{ reportData.normal.toEnd.distance }} mi</strong></p>
                            <hr class="dotted-hr">
                            <p class="total-time grand-total"><strong>Total Ruta: {{ reportData.normal.totalDuration }} min - {{ reportData.normal.totalMiles }} mi</strong></p>
                        </div>
                         <div v-if="scenarioETAs?.normal" class="result-block eta-block">
                             <h4>⏱️ Estimaciones Llegada (Ruta Normal)</h4>
                             <div class="eta-scenario"><span class="eta-label optimistic">Optimista:</span><strong class="eta-time">{{ scenarioETAs.normal.optimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.normal.optimistic.totalDuration }} min)</span></div>
                             <div class="eta-scenario"><span class="eta-label normal">Normal:</span><strong class="eta-time">{{ scenarioETAs.normal.normal.eta }}</strong><span class="eta-duration">({{ scenarioETAs.normal.normal.totalDuration }} min)</span></div>
                             <div class="eta-scenario"><span class="eta-label pessimistic">Pesimista:</span><strong class="eta-time">{{ scenarioETAs.normal.pessimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.normal.pessimistic.totalDuration }} min)</span></div>
                        </div>
                        <hr>
                         <div class="result-block inverse-block">
                            <h4>⬅️ Desglose Ruta Inversa</h4>
                            <p>Hacia Última Parada: <strong>{{ reportData.inverse.toStart.duration }} min - {{ reportData.inverse.toStart.distance }} mi</strong></p>
                            <div class="segment-breakdown">
                                <p>Bloque (Drive): <strong>{{ reportData.inverse.segments[0].duration }} min - {{ reportData.inverse.segments[0].distance }} mi</strong></p>
                                <p class="calc-details">Tiempo Paradas: +{{ reportData.inverse.segments[0].stopTime }} min ({{ reportData.stopCount }} paradas | {{ reportData.apartmentCount - reportData.downtownCount }} aptos | {{ reportData.downtownCount }} DT)</p>
                             </div>
                            <hr class="dotted-hr">
                            <p class="total-time"><strong>Total Trabajo: {{ reportData.inverse.totalWorkDuration }} min - {{ reportData.inverse.totalWorkMiles }} mi</strong></p>
                            <p>Desde 1ra Parada a Destino: <strong>{{ reportData.inverse.toEnd.duration }} min - {{ reportData.inverse.toEnd.distance }} mi</strong></p>
                            <hr class="dotted-hr">
                            <p class="total-time grand-total"><strong>Total Ruta: {{ reportData.inverse.totalDuration }} min - {{ reportData.inverse.totalMiles }} mi</strong></p>
                        </div>
                         <div v-if="scenarioETAs?.inverse" class="result-block eta-block inverse-eta">
                             <h4>⏱️ Estimaciones Llegada (Ruta Inversa)</h4>
                             <div class="eta-scenario"><span class="eta-label optimistic">Optimista:</span><strong class="eta-time">{{ scenarioETAs.inverse.optimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.inverse.optimistic.totalDuration }} min)</span></div>
                             <div class="eta-scenario"><span class="eta-label normal">Normal:</span><strong class="eta-time">{{ scenarioETAs.inverse.normal.eta }}</strong><span class="eta-duration">({{ scenarioETAs.inverse.normal.totalDuration }} min)</span></div>
                             <div class="eta-scenario"><span class="eta-label pessimistic">Pesimista:</span><strong class="eta-time">{{ scenarioETAs.inverse.pessimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.inverse.pessimistic.totalDuration }} min)</span></div>
                        </div>
                    </div>
                    <div v-else-if="backendResponse.error" class="backend-status error">{{ backendResponse.error }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    /* Styles remain unchanged */
    .uploader-container { margin-top: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .status { margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-left: 5px solid #2196f3; color: #333; }
    .button-reset { display: block; width: calc(100% - 40px); margin: 20px auto 0 auto; padding: 10px; font-size: 1.1em; font-weight: bold; color: white; background-color: #6c757d; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; }
    .button-reset:hover { background-color: #5a6268; }
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
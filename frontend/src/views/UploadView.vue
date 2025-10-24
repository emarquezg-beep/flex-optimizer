<script setup>
import { ref, computed, watch } from 'vue';
import Tesseract from 'tesseract.js';
// We might not need stringSimilarity here if findBestCityMatch isn't used in this version's calculatedLogEntry
// import stringSimilarity from 'string-similarity'; 

// ============================================
// BASE VARIABLES AND REFS (Dark Theme/ETA updates)
// ============================================

const extractedAddresses = ref([]);
const isProcessing = ref(false);
const backendResponse = ref(null);
const isSaving = ref(false);
const saveStatus = ref(null);
const fileInputRef = ref(null);
const selectedFileNames = ref([]);

const fileInputLabel = computed(() => {
  return isProcessing.value ? 'Processing...' : 'Choose Screenshots or Drag Here';
});

const VEHICULO_OPTIONS = ['Pontiac', 'Trax', 'Kia', 'Otro Carro'];
const DURACION_OPTIONS = [3, 3.5, 4, 4.5, 5];

const warehouses = ref([
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL', commuteMiles: 24 },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL', commuteMiles: 18 },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL', commuteMiles: 20 },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL', commuteMiles: 22 },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL', commuteMiles: 35 },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL', commuteMiles: 55 },
  { code: 'DFL5', address: '3000 Shelby Industrial Dr Apopka, FL', commuteMiles: 15 },
]);

const destinations = ref([
  { code: 'Casa', address: '513 Alafaya Woods Blvd Oviedo, FL' },
  ...warehouses.value,
  { code: 'Otro (especificar abajo)', address: 'custom' }
]);

const selectedWarehouseCode = ref(warehouses.value[0].code);
const selectedDestination = ref(destinations.value[0].address);
const customDestination = ref('');

const selectedScenarioForLog = ref('normal');
const blockData = ref({
  fecha: new Date().toISOString().split('T')[0],
  vehiculo: VEHICULO_OPTIONS[0],
  hora: '07:00',
  duracion_horas: DURACION_OPTIONS[1],
  pago: 0,
  antes_del_bloque: 30,
  commute_1_manual: warehouses.value[0].commuteMiles,
  retraso_almacen: 20
});

watch(selectedWarehouseCode, (newCode) => {
  const warehouse = warehouses.value.find(w => w.code === newCode);
  if (warehouse) {
    blockData.value.commute_1_manual = warehouse.commuteMiles;
  }
});

// ============================================
// ORIGINAL (Simpler) OCR Logic from `main`
// ============================================

function preprocessImage(file) {
  // --- This is your original v1.x/v2.0 preprocessing ---
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
  // --- This is your original v1.x/v2.0 parsing logic ---
  const stops = []; const stopWords = ['Deliver', 'Current stop', 'Scheduled', 'ITINERARY']; let lastKnownCity = 'Orlando';
  const pattern = /\((\d+)\)([\s\S]*?)(?=\(\d+\)|$)/g;
  let match;
  while ((match = pattern.exec(rawText)) !== null) {
    const stopNumber = parseInt(match[1]);
    const textBlock = match[2];
    // Uses the simpler address regex
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
      stops.push({ number: stopNumber, address: `${street} ${city}`, isDowntown: false });
    }
  }
  return stops;
}

async function handleFileChange(event) {
  // --- This is your original v1.x/v2.0 file handling logic ---
  const files = event.target.files;
  if (!files || files.length === 0) {
    selectedFileNames.value = [];
    return;
  }
  selectedFileNames.value = Array.from(files).map(f => f.name);

  isProcessing.value = true;
  extractedAddresses.value = [];
  backendResponse.value = null; // Clear previous results
  let allParsedStops = [];

  try {
    for (const file of files) {
      const processedImage = await preprocessImage(file); // Use original preprocess
      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng'); // Simple Tesseract call
      const stopsFromFile = parseAddresses(text); // Use original parse
      allParsedStops.push(...stopsFromFile);
    }

    // Gap filling logic (remains the same)
    const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));
    let maxStopNumber = 0; let minStopNumber = Infinity;
    uniqueStopsMap.forEach(stop => {
      if (stop.number > maxStopNumber) maxStopNumber = stop.number;
      if (stop.number < minStopNumber) minStopNumber = stop.number;
    });
    const fullListWithGaps = [];
    if (maxStopNumber > 0) {
      minStopNumber = Math.max(2, minStopNumber); 
      for (let i = minStopNumber; i <= maxStopNumber; i++) {
        if (uniqueStopsMap.has(i)) {
          fullListWithGaps.push(uniqueStopsMap.get(i));
        } else {
          // Add gap without confidence/needsReview
          fullListWithGaps.push({ number: i, address: '', isDowntown: false }); 
        }
      }
    }
    extractedAddresses.value = fullListWithGaps;

  } catch (error) {
    console.error("Error processing files:", error);
    alert("Hubo un error procesando las imágenes. Revisa la consola.");
  } finally {
    isProcessing.value = false;
    if (fileInputRef.value) { fileInputRef.value.value = ''; }
  }
}

// ============================================
// COMPUTED PROPERTIES (reportData, scenarioETAs, calculatedLogEntry)
// ============================================

// --- reportData (No changes needed) ---
const reportData = computed(() => {
    // ... (Your existing reportData logic)
     if (!backendResponse.value || !backendResponse.value.segments) { return null; }
    const { toFirstStop, segments, toFinalDestination, inverseRouteLegs } = backendResponse.value;
    let totalBlockMiles = 0; let totalBlockDriveDuration = 0; let totalBaseStopTime = 0;
    let totalExtraStopTime = 0; let totalApartmentCount = 0; let totalDowntownCount = 0;
    let totalStopCount = 0;
    const processedSegments = segments.map(seg => {
        let segmentBaseStopTime = 0; let segmentExtraStopTime = 0; let aptCount = 0;
        let downtownCount = 0; const currentStopCount = (seg.stops || []).length;
        totalStopCount += currentStopCount;
        (seg.stops || []).forEach(addr => {
            const stopData = extractedAddresses.value.find(s => s.address === addr); // Find based on original parsed address
            const isDowntown = stopData ? stopData.isDowntown : false;
            const isApartment = addr && addr.toUpperCase().match(/APT|UNIT|#/);
            segmentBaseStopTime += 1.5;
            if (isDowntown) { downtownCount++; segmentExtraStopTime += 4.5; }
            else if (isApartment) { aptCount++; segmentExtraStopTime += 1.5; }
        });
        totalBaseStopTime += segmentBaseStopTime; totalExtraStopTime += segmentExtraStopTime;
        totalApartmentCount += aptCount + downtownCount; totalDowntownCount += downtownCount;
        totalBlockMiles += parseFloat(seg.distance || 0);
        totalBlockDriveDuration += parseFloat(seg.duration || 0);
        return {
            distance: seg.distance, duration: seg.duration, stopsCount: currentStopCount,
            aptCount: aptCount, downtownCount: downtownCount
        };
    });
    const toFirstStopDist = parseFloat(toFirstStop.distance || 0);
    const toFirstStopDur = parseFloat(toFirstStop.duration || 0);
    const toFinalDestDist = parseFloat(toFinalDestination.distance || 0);
    const toFinalDestDur = parseFloat(toFinalDestination.duration || 0);
    const toLastStopDist = parseFloat(inverseRouteLegs.toLastStop.distance || 0);
    const toLastStopDur = parseFloat(inverseRouteLegs.toLastStop.duration || 0);
    const fromFirstStopDist = parseFloat(inverseRouteLegs.fromFirstStop.distance || 0);
    const fromFirstStopDur = parseFloat(inverseRouteLegs.fromFirstStop.duration || 0);
    const totalWorkMiles = toFirstStopDist + totalBlockMiles;
    const totalWorkDuration = toFirstStopDur + totalBlockDriveDuration + totalBaseStopTime + totalExtraStopTime;
    const totalNormalMiles = totalWorkMiles + toFinalDestDist;
    const totalNormalDuration = totalWorkDuration + toFinalDestDur;
    const totalInverseWorkMiles = toLastStopDist + totalBlockMiles;
    const totalInverseWorkDuration = toLastStopDur + totalBlockDriveDuration + totalBaseStopTime + totalExtraStopTime;
    const totalInverseMiles = totalInverseWorkMiles + fromFirstStopDist;
    const totalInverseDuration = totalInverseWorkDuration + fromFirstStopDur;
    return {
        savings: (totalNormalMiles - totalInverseMiles).toFixed(2),
        normal: {
            toStart: { distance: toFirstStopDist.toFixed(2), duration: Math.round(toFirstStopDur) },
            segments: processedSegments,
            toEnd: { distance: toFinalDestDist.toFixed(2), duration: Math.round(toFinalDestDur) },
            totalWorkMiles: totalWorkMiles.toFixed(2),
            totalWorkDuration: Math.round(totalWorkDuration),
            totalMiles: totalNormalMiles.toFixed(2),
            totalDuration: Math.round(totalNormalDuration),
            baseDriveDuration: toFirstStopDur + totalBlockDriveDuration,
            commuteDuration: toFinalDestDur,
        },
        inverse: {
            toStart: { distance: toLastStopDist.toFixed(2), duration: Math.round(toLastStopDur) },
            segments: processedSegments,
            toEnd: { distance: fromFirstStopDist.toFixed(2), duration: Math.round(fromFirstStopDur) },
            totalWorkMiles: totalInverseWorkMiles.toFixed(2),
            totalWorkDuration: Math.round(totalInverseWorkDuration),
            totalMiles: totalInverseMiles.toFixed(2),
            totalDuration: Math.round(totalInverseDuration),
            baseDriveDuration: toLastStopDist + totalBlockDriveDuration,
            commuteDuration: fromFirstStopDur,
        },
        stopCount: totalStopCount,
        apartmentCount: totalApartmentCount,
        downtownCount: totalDowntownCount,
    };
});

// --- scenarioETAs (With prep time - NO CHANGES NEEDED) ---
const scenarioETAs = computed(() => {
    // ... (Your existing scenarioETAs logic with prep time)
    if (!reportData.value?.normal || !blockData.value?.hora || blockData.value.retraso_almacen === undefined) {
         return null;
    }
    const stopCount = Number(reportData.value.stopCount) || 0;
    const apartmentCount = Number(reportData.value.apartmentCount) || 0;
    const downtownCount = Number(reportData.value.downtownCount) || 0;
    const regularApartmentCount = apartmentCount - downtownCount;
    const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
    const blockStartTime = new Date();
    blockStartTime.setHours(startHours, startMinutes, 0, 0);
    const prepTimeMinutes = Number(blockData.value.retraso_almacen) || 0;
    const estimatedDepartureTime = new Date(blockStartTime.getTime() + prepTimeMinutes * 60000);
    const calculateScenario = (baseDrive, commute, multiplier) => {
        const baseStopTime = stopCount * multiplier;
        const extraAptTime = (regularApartmentCount * 1.5) + (downtownCount * 4.5);
        const routeDurationMinutes = (Number(baseDrive) || 0) + baseStopTime + extraAptTime + (Number(commute) || 0);
        if (isNaN(routeDurationMinutes)) {
            return { totalDuration: 'N/A', eta: 'Error' };
        }
        const eta = new Date(estimatedDepartureTime.getTime() + routeDurationMinutes * 60000);
        return {
            totalDuration: Math.round(routeDurationMinutes),
            eta: eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        };
    };
    const normalBaseDrive = reportData.value.normal.baseDriveDuration;
    const normalCommute = reportData.value.normal.commuteDuration;
    const inverseBaseDrive = reportData.value.inverse.baseDriveDuration;
    const inverseCommute = reportData.value.inverse.commuteDuration;
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

// --- calculatedLogEntry (Updated for DB fields, uses simple city logic) ---
const calculatedLogEntry = computed(() => {
    if (!extractedAddresses.value || !reportData.value || !scenarioETAs.value) {
        return null;
    }
    const data = blockData.value;
    const pago = Number(data.pago) || 0;
    const duracion_horas = Number(data.duracion_horas) || 0;
    const scenarioKey = selectedScenarioForLog.value;
    const chosenReport = reportData.value[scenarioKey];
    const chosenETA = scenarioETAs.value[scenarioKey].normal;

    // --- Calculate Primary City (SIMPLER VERSION for original parser) ---
    let primary_city = null;
    if (extractedAddresses.value.length > 0) {
        const cityCounts = {};
        extractedAddresses.value.forEach(stop => {
            const addressParts = stop.address.split(' ');
            // Assumes city is the last word after simple parsing
            const city = addressParts[addressParts.length - 1]; 
            if (city && city.length > 2) { // Basic check
                 cityCounts[city] = (cityCounts[city] || 0) + 1;
            }
        });
        let maxCount = 0;
        for (const city in cityCounts) {
            if (cityCounts[city] > maxCount) {
                maxCount = cityCounts[city];
                primary_city = city;
            }
        }
        console.log("🏙️ Primary City Calculated (Simple):", primary_city, "Counts:", cityCounts);
    }
    // --- End City Calculation ---

    const first_stop_distance = Number(chosenReport.toStart.distance) || 0;
    const user_id = 'c130d2a8-6f96-48bc-b69a-68692797b5e6'; // Your UUID
    const antes_del_bloque_hrs = (Number(data.antes_del_bloque) || 0) / 60;
    let despues_del_bloque_hrs = 0;
    try {
        const [startHours, startMinutes] = data.hora.split(':').map(Number);
        const blockStart = new Date(); blockStart.setHours(startHours, startMinutes, 0, 0);
        const durationMs = duracion_horas * 3600 * 1000;
        const blockEnd = new Date(blockStart.getTime() + durationMs);
        const etaString = chosenETA.eta; const [time, ampm] = etaString.split(' ');
        let [etaHours, etaMinutes] = time.split(':').map(Number);
        if (ampm.toUpperCase() === 'PM' && etaHours !== 12) etaHours += 12;
        if (ampm.toUpperCase() === 'AM' && etaHours === 12) etaHours = 0;
        const etaTime = new Date(); etaTime.setHours(etaHours, etaMinutes, 0, 0);
        const diffMs = etaTime.getTime() - blockEnd.getTime();
        despues_del_bloque_hrs = diffMs / (3600 * 1000);
    } catch (e) { console.error("Error parsing time for logbook:", e); }
    const tiempo_total = antes_del_bloque_hrs + duracion_horas + despues_del_bloque_hrs;
    const commute_1 = Number(data.commute_1_manual) || 0;
    const commute_2 = Number(chosenReport.toEnd.distance) || 0;
    const millas_de_trabajo = (Number(chosenReport.totalMiles) || 0) - commute_1 - commute_2;
    const millas_totales = commute_1 + millas_de_trabajo + commute_2;
    const pago_por_hora = duracion_horas > 0 ? pago / duracion_horas : 0;
    const pago_real_por_hora = tiempo_total > 0 ? pago / tiempo_total : 0;
    const millas_por_hora = duracion_horas > 0 ? millas_de_trabajo / duracion_horas : 0;
    const gasto_de_gasolina = (millas_totales / 35) * 3.00;
    const desgaste_vehiculo = millas_totales * 0.25;
    const tax = pago * 0.153;
    const claim_por_milla = millas_de_trabajo * 0.70;
    return {
        fecha: data.fecha, vehiculo: data.vehiculo, warehouse: selectedWarehouseCode.value,
        hora: data.hora, duracion_horas: duracion_horas, pago: pago,
        pago_por_hora: pago_por_hora.toFixed(2), antes_del_bloque: antes_del_bloque_hrs.toFixed(2),
        despues_del_bloque: despues_del_bloque_hrs.toFixed(2), tiempo_total: tiempo_total.toFixed(2),
        pago_real_por_hora: pago_real_por_hora.toFixed(2), commute_1: commute_1.toFixed(2),
        conmute_2: commute_2.toFixed(2), millas_de_trabajo: millas_de_trabajo.toFixed(2),
        millas_totales: millas_totales.toFixed(2), millas_por_hora: millas_por_hora.toFixed(2),
        gasto_de_gasolina: gasto_de_gasolina.toFixed(2), desgaste_vehiculo: desgaste_vehiculo.toFixed(2),
        tax: tax.toFixed(2), claim_por_milla: claim_por_milla.toFixed(2),
        user_id: user_id, primary_city: primary_city, first_stop: first_stop_distance.toFixed(2)
    };
});

// ============================================
// BACKEND COMMUNICATION & UI HELPERS (Restored)
// ============================================

function sanitizeAddress(address) {
    // --- Restored sanitizeAddress ---
    if (!address) return '';
    return address.replace(/[^a-zA-Z0-9\s#]/g, '').replace(/\s+/g, ' ').trim();
}

async function sendToBackend() {
    // --- Restored sendToBackend ---
      const addressesToSend = extractedAddresses.value.map(stop => stop.address);
      const sanitizedAddresses = addressesToSend.map(sanitizeAddress).filter(addr => addr && addr.trim() !== '');
      if (sanitizedAddresses.length === 0) { alert('No hay direcciones válidas para optimizar.'); return; }
      const warehouse = warehouses.value.find(w => w.code === selectedWarehouseCode.value);
      if (!warehouse) { alert('Error: Warehouse no encontrado.'); return; }
      const warehouseAddress = sanitizeAddress(warehouse.address);
      const finalDestination = selectedDestination.value === 'custom' ? sanitizeAddress(customDestination.value) : sanitizeAddress(selectedDestination.value);
      if (!finalDestination) { alert('Por favor, especifica un destino final.'); return; }
      const fullRoute = [warehouseAddress, ...sanitizedAddresses, finalDestination];
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      backendResponse.value = { status: 'loading' };
      try {
        const response = await fetch(`${backendUrl}/api/optimize-route`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses: fullRoute }),
        });
        const result = await response.json();
        backendResponse.value = result;
        if (!response.ok) { throw new Error(result.message || `Error ${response.status}`); }
      } catch (error) {
        console.error("Error calling backend:", error);
        backendResponse.value = { error: `Error: ${error.message || 'No se pudo conectar al servidor.'}` };
      }
}

async function saveToLogbook() {
    // --- Restored saveToLogbook ---
    if (!calculatedLogEntry.value) { alert("No hay datos calculados para guardar."); return; }
    isSaving.value = true; saveStatus.value = null;
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    try {
        const response = await fetch(`${backendUrl}/api/log-route`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calculatedLogEntry.value)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            console.log("Respuesta del servidor:", result);
            saveStatus.value = { success: true, message: `¡Guardado con Éxito! (ID: ${result.data[0].id})` };
        } else { throw new Error(result.message || 'Error desconocido del servidor.'); }
    } catch (error) {
        console.error("Error al guardar en bitácora:", error);
        saveStatus.value = { success: false, message: `Error: ${error.message}` };
    } finally { isSaving.value = false; }
}

// UI Helpers (Restored, simple version)
function removeAddress(index) { extractedAddresses.value.splice(index, 1); }
function addAddress() {
    const nextNumber = extractedAddresses.value.length > 0
        ? Math.max(...extractedAddresses.value.map(s => s.number)) + 1
        : 2; 
    // Add gap without confidence/needsReview
    extractedAddresses.value.push({ number: nextNumber, address: '', isDowntown: false }); 
}
function reorderList() { extractedAddresses.value.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)); }

</script>

<template>
    <div class="view-container"><div class="uploader-container"></div>
        <div class="file-input-area">
            <label for="file-input" class="file-input-label">
                <span class="file-input-icon">📤</span>
                <span class="file-input-text">{{ fileInputLabel }}</span>
            </label>
    <input 
        type="file" 
        multiple 
        accept="image/*" 
        @change="handleFileChange" 
        id="file-input" 
        :disabled="isProcessing"
        ref="fileInputRef" 
    />
    <div v-if="selectedFileNames.length > 0" class="selected-files">
        Selected: {{ selectedFileNames.join(', ') }}
    </div>
    </div>
        <div v-if="isProcessing" class="status"><h3>Procesando imágenes...</h3></div>
        
        <div v-if="extractedAddresses.length > 0 && !isProcessing">
            <div class="controls-container">
                <div class="control-group">
                    <label for="warehouse-select">Punto de Partida</label>
                    <select id="warehouse-select" v-model="selectedWarehouseCode">
                        <option v-for="wh in warehouses" :key="wh.code" :value="wh.code">
                            {{ wh.code }} ({{ wh.commuteMiles }} mi)
                        </option>
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
                        <label class="downtown-label" title="Marcar si es Downtown">
                            <input type="checkbox" v-model="stop.isDowntown" class="downtown-checkbox"> DT
                        </label>
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
                    
                    <div v-else-if="reportData && calculatedLogEntry" class="results-container">
                        
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
                            <div v-for="(segment, index) in reportData.normal.segments" :key="`norm-seg-${index}`" class="segment-breakdown">
                                <p>Segmento {{ index + 1 }} (Drive): <strong>{{ segment.duration }} min - {{ segment.distance }} mi</strong> 
                                    <span class="calc-details">({{ segment.stopsCount }} paradas | {{ segment.aptCount }} aptos | {{ segment.downtownCount }} DT)</span>
                                </p>
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
                            <div v-for="(segment, index) in reportData.inverse.segments" :key="`inv-seg-${index}`" class="segment-breakdown">
                                <p>Segmento {{ index + 1 }} (Drive): <strong>{{ segment.duration }} min - {{ segment.distance }} mi</strong>
                                     <span class="calc-details">({{ segment.stopsCount }} paradas | {{ segment.aptCount }} aptos | {{ segment.downtownCount }} DT)</span>
                                </p>
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

                    <div v-if="reportData && calculatedLogEntry" class="logbook-form-container">
                        <h3>📓 Datos del Bloque para Bitácora</h3>
                        
                        <div class="logbook-scenario-selector">
                            <strong>Usar datos del escenario:</strong>
                            <label>
                                <input type="radio" v-model="selectedScenarioForLog" value="normal"> Normal
                            </label>
                            <label>
                                <input type="radio" v-model="selectedScenarioForLog" value="inverse"> Inverso
                            </label>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Fecha</label>
                                <input type="date" v-model="blockData.fecha">
                            </div>
                            <div class="form-group">
                                <label>Hora Inicio (24h)</label>
                                <input type="time" v-model="blockData.hora">
                            </div>
                            <div class="form-group">
                                <label>Vehículo</label>
                                <select v-model="blockData.vehiculo">
                                    <option v-for="v in VEHICULO_OPTIONS" :key="v" :value="v">{{ v }}</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Duración (Horas)</label>
                                <select v-model.number="blockData.duracion_horas">
                                    <option v-for="d in DURACION_OPTIONS" :key="d" :value="d">{{ d }} hrs</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Pago ($)</label>
                                <input type="number" v-model.number="blockData.pago" placeholder="Ej: 70.50">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Retraso Estimado en Almacén (min)</label>
                                <input type="number" v-model.number="blockData.retraso_almacen" step="5">
                            </div>
                            <div class="form-group"></div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Antes del Bloque (min)</label>
                                <input type="number" v-model.number="blockData.antes_del_bloque" step="5">
                            </div>
                            <div class="form-group">
                                <label>Conmute 1 (Millas)</label>
                                <input type="number" v-model.number="blockData.commute_1_manual" step="0.1">
                            </div>
                        </div>
                        
                        <div class="logbook-summary">
                            <h4>Resumen Calculado (para Guardar)</h4>
                            <p><strong>Pago/Hora Base:</strong> ${{ calculatedLogEntry.pago_por_hora }}</p>
                            <p><strong>Millas de Trabajo:</strong> {{ calculatedLogEntry.millas_de_trabajo }} mi</p>
                            <p><strong>Conmute 2 (API):</strong> {{ calculatedLogEntry.commute_2 }} mi</p>
                            <p><strong>Millas Totales:</strong> {{ calculatedLogEntry.millas_totales }} mi</p>
                            <hr>
                            <p><strong>Tiempo "Después Bloque":</strong> {{ calculatedLogEntry.despues_del_bloque }} hrs</p>
                            <p><strong>Tiempo Total Invertido:</strong> {{ calculatedLogEntry.tiempo_total }} hrs</p>
                            <p><strong>PAGO REAL POR HORA:</strong> ${{ calculatedLogEntry.pago_real_por_hora }}</p>
                            <hr>
                            <p><strong>Gasto Gasolina:</strong> -${{ calculatedLogEntry.gasto_de_gasolina }}</p>
                            <p><strong>Desgaste Vehículo:</strong> -${{ calculatedLogEntry.desgaste_vehiculo }}</p>
                            <p><strong>Impuestos (Tax):</strong> -${{ calculatedLogEntry.tax }}</p>
                            <p><strong>Claim por Milla:</strong> +${{ calculatedLogEntry.claim_por_milla }}</p>
                        </div>

                        <button @click="saveToLogbook" class="button-save-log" :disabled="isSaving">
                            {{ isSaving ? 'Guardando...' : '💾 Guardar en Bitácora' }}
                        </button>
                        
                        <div v-if="saveStatus" 
                             :class="['save-status', saveStatus.success ? 'success' : 'error']">
                            {{ saveStatus.message }}
                        </div>
                    </div> </div> </div> </div> </div> </template>

<style scoped>
    /* --- Base Styles (Keep as is) --- */
    .uploader-container { margin-top: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

    /* --- New File Input Styles (Keep as is) --- */
    .file-input-area { margin-bottom: 30px; text-align: center; }
    .file-input-area input[type="file"] { display: none; }
    .file-input-label { display: block; padding: 40px 20px; border: 2px dashed var(--color-border); border-radius: 8px; background-color: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease; }
    .file-input-label:hover { background-color: var(--color-border); border-color: var(--color-primary); color: var(--color-text-primary); }
    .file-input-icon { font-size: 2em; display: block; margin-bottom: 10px; }
    .file-input-text { font-weight: 500; }
    .selected-files { margin-top: 10px; font-size: 0.9em; color: var(--color-text-secondary); text-align: center; }

    /* --- Status Bar --- */
    .status {
        margin: 20px 0; padding: 15px;
        background-color: var(--color-surface);
        border-left: 5px solid var(--color-primary);
        color: var(--color-text-primary); /* Light text on dark surface */
    }

    /* --- Controls & Address List --- */
    .controls-container { display: flex; justify-content: space-between; gap: 20px; margin-top: 20px; padding: 20px; background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; }
    .control-group { flex: 1; display: flex; flex-direction: column; }
    .control-group label { margin-bottom: 8px; font-weight: bold; color: var(--color-text-secondary); } /* Lighter label text */
    /* Select inherits global dark style */

    .custom-input-container { margin: 10px 20px; }
    /* Input inherits global dark style */

    .address-list { margin-top: 20px; padding: 20px; border: 1px solid var(--color-border); border-radius: 8px; text-align: left; background-color: var(--color-surface); color: var(--color-text-primary); }
    .address-list h2 { margin-top: 0; color: var(--color-primary); }
    .ordered-list { list-style-type: none; padding-left: 0; }
    li.editable-item { margin-bottom: 12px; font-size: 1.1em; line-height: 1.5; color: var(--color-text-primary); display: flex; align-items: center; gap: 5px; }
    .stop-number-input { width: 50px; text-align: center; font-weight: bold; } /* Inherits global */
    .address-input { flex-grow: 1; } /* Inherits global */
    .downtown-label { display: flex; align-items: center; cursor: pointer; font-size: 0.9em; color: var(--color-text-secondary); padding: 0 5px; }
    .downtown-checkbox { /* Styles for custom checkbox */
      appearance: none; width: 18px; height: 18px; border: 1px solid var(--color-border);
      border-radius: 3px; cursor: pointer; position: relative; background-color: var(--color-background);
    }
    .downtown-checkbox:checked { background-color: var(--color-primary); border-color: var(--color-primary); }
    .downtown-checkbox:checked::after {
     content: '✓'; color: white; position: absolute; left: 50%; top: 50%;
     transform: translate(-50%, -50%); font-size: 14px; font-weight: bold;
    }
    .button-delete { padding: 8px 10px; font-size: 0.9em; border-radius: 4px; background-color: #6c2a32; color: var(--color-text-primary); border: none; cursor: pointer; }
    .button-delete:hover { background-color: #8b3640; }
    .action-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
    .button-add, .button-reorder { padding: 10px; flex-grow: 1; cursor: pointer; border-radius: 5px; } /* Use global button styles or specific ones */
    .button-add { background-color: var(--color-accent); color: var(--color-black); border: 1px solid var(--color-accent); }
    .button-add:hover { background-color: #bad0b1; }
    .button-reorder { background-color: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); }
    .button-reorder:hover { background-color: var(--color-border); }
    .button-map { display: block; width: 100%; padding: 15px; font-size: 1.2em; font-weight: bold; margin-top: 20px; /* Uses .button-primary from global */ }

    /* --- Results Container --- */
    .backend-status { margin-top: 15px; padding: 10px; background-color: var(--color-surface); border-radius: 4px; text-align: center; color: var(--color-text-primary); }
    .backend-status.error { background-color: #6c2a32; color: var(--color-text-primary); } /* Dark red background */

    .results-container { margin-top: 20px; padding: 15px; background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text-primary); } /* Base light text */
    .result-block { padding: 20px 0 10px 0; }
    /* Remove inverse block specific background for now */
    /* .result-block.inverse-block { background-color: #fffaf0; ... } */
    .result-block h4 { margin: 0 0 15px 0; color: var(--color-primary); } /* Primary color headings */
    .result-block p { margin: 5px 0; font-size: 1.1em; color: var(--color-text-primary); } /* Light text */
    .segment-breakdown { padding-left: 15px; border-left: 2px solid var(--color-border); margin-left: 5px; margin-top: 10px; }
    .calc-details { font-size: 0.85em; color: var(--color-text-secondary); display: inline; } /* Dimmer secondary text */
    .total-time { font-size: 1.1em !important; border-top: 1px solid var(--color-border); padding-top: 8px; margin-top: 8px; color: var(--color-text-primary); }
    .grand-total { font-size: 1.25em !important; color: var(--color-primary); font-weight: bold; } /* Primary color total */
    .dotted-hr { border: none; border-top: 2px dotted var(--color-border); margin: 15px 0; }
    hr { border: none; border-top: 1px solid var(--color-border); margin: 10px 0; }

    /* --- Scenario Table --- */
    .scenario-table { padding: 10px 0; }
    .scenario-table h4 { margin: 0 0 10px 0; color: var(--color-primary); }
    .scenario-table table { width: 100%; border-collapse: collapse; }
    .scenario-table td { padding: 12px; text-align: left; border-bottom: 1px solid var(--color-border); color: var(--color-text-primary); } /* Light text in table */
    .scenario-table .highlight { background-color: rgba(42, 62, 80, 0.5); } /* Darker highlight */
    .savings { color: var(--color-accent); font-weight: bold; } /* Accent color savings */

    /* --- ETA Block (FIXED CONTRAST) --- */
    .eta-block {
      /* background-color: #e6f7ff; REMOVED light background */
      background-color: var(--color-background); /* Darker background than surface */
      margin: 0 -15px -15px -15px; /* Keep negative margin */
      padding: 20px 15px 15px 15px;
      border-radius: 0 0 8px 8px;
      border-top: 1px solid var(--color-border);
    }
    /* Remove inverse eta specific background */
    /* .eta-block.inverse-eta { background-color: #fffaf0; } */
    .eta-block h4 { color: var(--color-primary); }
    .eta-scenario { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed var(--color-border); color: var(--color-text-primary); } /* Light text */
    .eta-scenario:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .eta-label { display: inline-block; width: 100px; font-weight: bold; } /* Keep colors */
    .eta-label.optimistic { color: #28a745; }
    .eta-label.normal { color: #ffc107; }
    .eta-label.pessimistic { color: #dc3545; }
    .eta-time { font-size: 1.3em; font-weight: bold; color: var(--color-text-primary); margin-right: 10px; } /* Light time */
    .eta-duration { font-size: 0.9em; color: var(--color-text-secondary); } /* Dimmer duration */

    /* --- Logbook Form --- */
    .logbook-form-container { margin-top: 30px; padding: 20px; background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; }
    .logbook-form-container h3 { margin-top: 0; color: var(--color-primary); border-bottom: 2px solid var(--color-border); padding-bottom: 10px; }
    .logbook-scenario-selector { background-color: var(--color-background); border: 1px solid var(--color-border); padding: 10px; border-radius: 5px; margin-bottom: 15px; color: var(--color-text-primary); } /* Dark background */
    .logbook-scenario-selector label { margin-left: 15px; font-weight: normal; cursor: pointer; color: var(--color-text-primary); }
    .form-row { display: flex; gap: 15px; margin-bottom: 15px; }
    .form-group { flex: 1; display: flex; flex-direction: column; }
    .form-group label { margin-bottom: 5px; font-weight: normal; color: var(--color-text-secondary); font-size: 0.9em; } /* Visible label */
    /* Inputs/Selects inherit global dark style */

    /* --- Logbook Summary (FIXED CONTRAST) --- */
    .logbook-summary {
      background-color: var(--color-background); /* Darker background */
      border: 1px solid var(--color-border);
      border-radius: 5px;
      padding: 15px;
      margin-top: 20px;
    }
    .logbook-summary h4 { margin: 0 0 10px 0; color: var(--color-primary); }
    .logbook-summary p { margin: 5px 0; font-size: 1.1em; display: flex; justify-content: space-between; color: var(--color-text-primary); } /* Light text */
    .logbook-summary p strong { color: var(--color-white); } /* Brighter bold text */

    .button-save-log { display: block; width: 100%; padding: 15px; font-size: 1.2em; font-weight: bold; color: var(--color-black); background-color: var(--color-accent); border: none; border-radius: 5px; cursor: pointer; margin-top: 20px; }
    .button-save-log:hover { background-color: #bad0b1; }
    .button-save-log:disabled { background-color: #555; cursor: not-allowed; color: #999; }

    /* --- Save Status --- */
    .save-status { margin-top: 15px; padding: 10px; border-radius: 5px; font-weight: bold; text-align: center; }
    .save-status.success { background-color: #1e4620; color: #a3d9a5; border: 1px solid #2a642d; } /* Dark green */
    .save-status.error { background-color: #6c2a32; color: #f8d7da; border: 1px solid #8b3640; } /* Dark red */

    /* --- Needs Review Highlight --- */
    .editable-item.needs-review {
      background-color: rgba(255, 193, 7, 0.1); /* Subtle yellow background */
      border-left: 4px solid #ffc107; /* Yellow border */
      padding-left: 10px;
      margin-left: -14px; /* Adjust based on padding */
    }
    .editable-item.needs-review .address-input {
      background-color: rgba(40, 38, 30, 0.5); /* Slightly yellow dark background */
      border-color: #ffc107;
    }
</style>
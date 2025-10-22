<script setup>
import { ref, computed, watch } from 'vue';
import Tesseract from 'tesseract.js';
import { matchCity } from '../utils/cityMatcher.js';

// --- VARIABLES Y DATOS (v1.5) ---
const extractedAddresses = ref([]);
const isProcessing = ref(false);
const backendResponse = ref(null);
const isSaving = ref(false);
const saveStatus = ref(null);

// VAMOS A USAR ESTOS VALORES
const VEHICULO_OPTIONS = ['Pontiac', 'Trax', 'Kia', 'Otro Carro'];
const DURACION_OPTIONS = [3, 3.5, 4, 4.5, 5];

// (1) WAREHOUSES ACTUALIZADOS con commuteMiles
const warehouses = ref([
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL', commuteMiles: 24 },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL', commuteMiles: 18 },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL', commuteMiles: 20 },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL', commuteMiles: 22 },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL', commuteMiles: 35 },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL', commuteMiles: 55 },
  { code: 'DFL5', address: '3000 Shelby Industrial Dr Apopka, FL', commuteMiles: 15 }, // Añadí DFL5 y un commute
]);

const destinations = ref([
  { code: 'Casa', address: '513 Alafaya Woods Blvd Oviedo, FL' },
  ...warehouses.value, // Usamos .value porque warehouses ahora es un ref
  { code: 'Otro (especificar abajo)', address: 'custom' }
]);

// (2) VARIABLES DE v1.5 (Estas te faltaban)
const selectedWarehouseCode = ref(warehouses.value[0].code); 
const selectedDestination = ref(destinations.value[0].address);
const customDestination = ref('');

// (3) REFS para el formulario de bitácora (Estos te faltaban)
const selectedScenarioForLog = ref('normal');
const blockData = ref({
  fecha: new Date().toISOString().split('T')[0],
  vehiculo: VEHICULO_OPTIONS[0],
  hora: '07:00',
  duracion_horas: DURACION_OPTIONS[1],
  pago: 0,
  antes_del_bloque: 30,
  commute_1_manual: warehouses.value[0].commuteMiles
});

// (4) WATCHER para actualizar Conmute_1 (Este te faltaba)
watch(selectedWarehouseCode, (newCode) => {
  const warehouse = warehouses.value.find(w => w.code === newCode);
  if (warehouse) {
    blockData.value.commute_1_manual = warehouse.commuteMiles;
  }
});

// --- PROPIEDADES COMPUTADAS (v1.5) ---
// (Tu lógica de reportData v1.2-con-downtown-v2. Está perfecta, la mantengo)
const reportData = computed(() => {
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
            const stopData = extractedAddresses.value.find(s => s.address === addr);
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

// (Tu lógica de scenarioETAs está perfecta, la mantengo)
const scenarioETAs = computed(() => {
    if (!reportData.value?.normal || !blockData.value?.hora) return null;
    const stopCount = Number(reportData.value.stopCount) || 0;
    const apartmentCount = Number(reportData.value.apartmentCount) || 0;
    const downtownCount = Number(reportData.value.downtownCount) || 0;
    const regularApartmentCount = apartmentCount - downtownCount;
    //const now = new Date();
    const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
    const startTime = new Date(); // Crea una fecha de "hoy"
    startTime.setHours(startHours, startMinutes, 0, 0); // La ajusta a la hora de inicio del bloque
    const calculateScenario = (baseDrive, commute, multiplier) => {
        const baseStopTime = stopCount * multiplier;
        const extraTime = (regularApartmentCount * 1.5) + (downtownCount * 4.5);
        const totalDuration = (Number(baseDrive) || 0) + baseStopTime + extraTime + (Number(commute) || 0);
        if (isNaN(totalDuration)) { return { totalDuration: 'N/A', eta: 'Error' }; }
        //const eta = new Date(now.getTime() + totalDuration * 60000);
        const eta = new Date(startTime.getTime() + totalDuration * 60000);
        return {
            totalDuration: Math.round(totalDuration),
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

// (5) --- PROPIEDAD COMPUTADA QUE FALTABA ---
// Aquí es donde ocurre la magia de tus cálculos
const calculatedLogEntry = computed(() => {
    if (!reportData.value || !scenarioETAs.value) return null;

    // --- A. Variables Base ---
    const data = blockData.value;
    const pago = Number(data.pago) || 0;
    const duracion_horas = Number(data.duracion_horas) || 0;
    
    // Elige el reporte (Normal o Inverso) basado en la selección
    const scenarioKey = selectedScenarioForLog.value; // 'normal' o 'inverse'
    const chosenReport = reportData.value[scenarioKey];
    const chosenETA = scenarioETAs.value[scenarioKey].normal; // Usamos la ETA "Normal" del escenario elegido

    // --- B. Métricas de Tiempo ---
    const antes_del_bloque_hrs = (Number(data.antes_del_bloque) || 0) / 60;

    // Cálculo complejo de "Despues_del_bloque"
    let despues_del_bloque_hrs = 0;
    try {
        const [startHours, startMinutes] = data.hora.split(':').map(Number);
        const blockStart = new Date();
        blockStart.setHours(startHours, startMinutes, 0, 0);

        const durationMs = duracion_horas * 3600 * 1000;
        const blockEnd = new Date(blockStart.getTime() + durationMs);

        // Parsear la ETA (ej: "10:15 AM")
        const etaString = chosenETA.eta;
        const [time, ampm] = etaString.split(' ');
        let [etaHours, etaMinutes] = time.split(':').map(Number);
        if (ampm.toUpperCase() === 'PM' && etaHours !== 12) etaHours += 12;
        if (ampm.toUpperCase() === 'AM' && etaHours === 12) etaHours = 0; // medianoche

        const etaTime = new Date();
        etaTime.setHours(etaHours, etaMinutes, 0, 0);

        const diffMs = etaTime.getTime() - blockEnd.getTime();
        despues_del_bloque_hrs = diffMs / (3600 * 1000); // Diferencia en horas decimales

    } catch (e) {
        console.error("Error parsing time for logbook:", e);
    }
    
    const tiempo_total = antes_del_bloque_hrs + duracion_horas + despues_del_bloque_hrs;

    // --- C. Métricas de Distancia ---
    const commute_1 = Number(data.commute_1_manual) || 0;
    const commute_2 = Number(chosenReport.toEnd.distance) || 0;
    const millas_de_trabajo = Number(chosenReport.totalWorkMiles) || 0;
    const millas_totales = commute_1 + millas_de_trabajo + commute_2;

    // --- D. Métricas Financieras ---
    const pago_por_hora = duracion_horas > 0 ? pago / duracion_horas : 0;
    const pago_real_por_hora = tiempo_total > 0 ? pago / tiempo_total : 0;
    const millas_por_hora = duracion_horas > 0 ? millas_de_trabajo / duracion_horas : 0;
    
    // Tus valores hardcoded
    const gasto_de_gasolina = (millas_totales / 35) * 3.00;
    const desgaste_vehiculo = millas_totales * 0.25;
    const tax = pago * 0.153; // 15.3%
    const claim_por_milla = millas_de_trabajo * 0.70;

    return {
        // Datos de Input (para guardar)
        fecha: data.fecha,
        vehiculo: data.vehiculo,
        warehouse: selectedWarehouseCode.value,
        hora: data.hora,
        duracion_horas: duracion_horas,
        pago: pago,
        antes_del_bloque: antes_del_bloque_hrs.toFixed(2), // Guardamos en horas decimales
        
        // Datos Calculados (para guardar)
        pago_por_hora: pago_por_hora.toFixed(2),
        despues_del_bloque: despues_del_bloque_hrs.toFixed(2),
        tiempo_total: tiempo_total.toFixed(2),
        pago_real_por_hora: pago_real_por_hora.toFixed(2),
        commute_1: commute_1.toFixed(2),
        commute_2: commute_2.toFixed(2),
        millas_de_trabajo: millas_de_trabajo.toFixed(2),
        millas_totales: millas_totales.toFixed(2),
        millas_por_hora: millas_por_hora.toFixed(2),
        gasto_de_gasolina: gasto_de_gasolina.toFixed(2),
        desgaste_vehiculo: desgaste_vehiculo.toFixed(2),
        tax: tax.toFixed(2),
        claim_por_milla: claim_por_milla.toFixed(2)
    };
});


// --- FUNCIONES ---
// (Tus funciones de OCR y parseo están bien, las mantengo)
function removeAddress(index) { extractedAddresses.value.splice(index, 1); }
function addAddress() { extractedAddresses.value.push({ number: null, address: '', isDowntown: false }); }
function reorderList() { extractedAddresses.value.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)); }
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
// REEMPLAZA ESTA FUNCIÓN COMPLETA
function parseAddresses(rawText) {
  const stops = [];
  let lastKnownCity = 'ORLANDO'; // Fallback final

  const pattern = /\((\d+)\)([\s\S]*?)(?=\(\d+\)|$)/g;
  let match;

  while ((match = pattern.exec(rawText)) !== null) {
    const stopNumber = parseInt(match[1]);
    let textBlock = match[2];

    // 1. Limpieza de Contaminación (como planeamos)
    const scheduledLinePattern = /.*Scheduled.*\n/i; 
    textBlock = textBlock.replace(scheduledLinePattern, '');

    // 2. RegEx Experto (como recomendó tu amigo)
    const addressPattern = /(\d{1,6}\s[A-Z0-9][A-Z0-9\s\.\-]+(?:ST|DR|CT|LN|RD|AVE|PKWY|PL|CIR|BLVD|WAY|TER|TRAIL|PARKWAY|COURT|LANE|ROAD|AVENUE|PLACE|CIRCLE)\b.*)/i;
    const addressMatch = textBlock.match(addressPattern);

    if (addressMatch) {
      const street = addressMatch[1].trim();
      let city = null;

      // 3. Extracción y Corrección de Ciudad (La Nueva Lógica)
      const lines = textBlock.substring(textBlock.indexOf(street)).split('\n');
      
      if (lines.length > 1) {
        // Asumimos que la ciudad está en la siguiente línea
        let ocrCityGuess = lines[1].trim();
        
        // Limpiamos "Deliver 1 package" de la línea
        const deliverMatch = ocrCityGuess.match(/DELIVER \d/i);
        if (deliverMatch) {
          ocrCityGuess = ocrCityGuess.substring(0, deliverMatch.index).trim();
        }

        // ¡Usamos el Fuzzy Matcher!
        city = matchCity(ocrCityGuess);
      }

      // 4. Fallback (si la línea 2 falló o estaba vacía)
      if (!city) {
        // Si no encontramos ciudad en la línea 2, probamos con el bloque entero
        // Esto es más lento pero puede salvar casos
        city = matchCity(textBlock);
      }

      // 5. Asignación final
      if (city) {
        lastKnownCity = city; // Actualizamos nuestro fallback
      } else {
        city = lastKnownCity; // Usamos el último bueno conocido
      }
      
      stops.push({ number: stopNumber, address: `${street} ${city}`.toUpperCase(), isDowntown: false });
    }
  }
  return stops;
}
// REEMPLAZA ESTA FUNCIÓN COMPLETA
async function handleFileChange(event) {
  const files = event.target.files; if (!files.length) return;
  isProcessing.value = true; extractedAddresses.value = []; backendResponse.value = null;
  let allParsedStops = [];
  try {
      for (const file of files) {
        const processedImage = await preprocessImage(file);
        
        // --- FASE 1: Page Segmentation Mode (Sugerencia del Experto) ---
        const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
          tessedit_pageseg_mode: 4 // Modo 4 = Columna única de texto
        });
        
        const stopsFromFile = parseAddresses(text);
        allParsedStops.push(...stopsFromFile);
      }
      const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));
      let maxStopNumber = 0;
      uniqueStopsMap.forEach(stop => { if (stop.number > maxStopNumber) maxStopNumber = stop.number; });

      // Crea la lista final con gaps, empezando desde el #2
      const fullListWithGaps = [];
      for (let i = 2; i <= maxStopNumber; i++) { // Bucle empieza en 2
          if (uniqueStopsMap.has(i)) { fullListWithGaps.push(uniqueStopsMap.get(i)); }
          else { fullListWithGaps.push({ number: i, address: '', isDowntown: false }); }
      }
      extractedAddresses.value = fullListWithGaps;
  } catch(error) {
      console.error("Error processing files:", error);
      alert("Hubo un error procesando las imágenes. Revisa la consola.");
  } finally {
      isProcessing.value = false;
  }
}
function sanitizeAddress(address) {
    if (!address) return '';
    return address.replace(/[^a-zA-Z0-9\s#]/g, '').replace(/\s+/g, ' ').trim();
}

// (6) sendToBackend (ACTUALIZADO para v1.5)
async function sendToBackend() {
  const addressesToSend = extractedAddresses.value.map(stop => stop.address);
  const sanitizedAddresses = addressesToSend.map(sanitizeAddress).filter(addr => addr && addr.trim() !== '');
  if (sanitizedAddresses.length === 0) { alert('No hay direcciones válidas para optimizar.'); return; }
  
  // --- ESTA PARTE CAMBIÓ ---
  // Encuentra la dirección del warehouse a partir del CÓDIGO seleccionado
  const warehouse = warehouses.value.find(w => w.code === selectedWarehouseCode.value);
  if (!warehouse) {
      alert('Error: Warehouse no encontrado.'); return;
  }
  const warehouseAddress = sanitizeAddress(warehouse.address);
  // --- FIN DEL CAMBIO ---

  const finalDestination = selectedDestination.value === 'custom' ? sanitizeAddress(customDestination.value) : sanitizeAddress(selectedDestination.value);
  if (!finalDestination) { alert('Por favor, especifica un destino final.'); return; }
  
  // Usamos la dirección encontrada
  const fullRoute = [warehouseAddress, ...sanitizedAddresses, finalDestination];
  
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

// (7) saveToLogbook (Tu función v1.5 está perfecta, la mantengo)
async function saveToLogbook() {
    if (!calculatedLogEntry.value) {
        alert("No hay datos calculados para guardar.");
        return;
    }
    
    isSaving.value = true;
    saveStatus.value = null;
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    try {
        const response = await fetch(`${backendUrl}/api/log-route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(calculatedLogEntry.value)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log("Respuesta del servidor:", result);
            saveStatus.value = { success: true, message: `¡Guardado con Éxito! (ID: ${result.data[0].id})` };
        } else {
            throw new Error(result.message || 'Error desconocido del servidor.');
        }

    } catch (error) {
        console.error("Error al guardar en bitácora:", error);
        saveStatus.value = { success: false, message: `Error: ${error.message}` };
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
    <div class="view-container"><div class="uploader-container"></div>
        <input type="file" multiple accept="image/*" @change="handleFileChange" id="file-input" :disabled="isProcessing">
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
    .stop-number-input { width: 50px; padding: 8px; font-size: 1em; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-weight: bold; }
    .address-input { flex-grow: 1; padding: 8px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; }
    .downtown-label { display: flex; align-items: center; cursor: pointer; font-size: 0.9em; color: #6c757d; padding: 0 5px; }
    .downtown-checkbox { margin-right: 3px; width: 18px; height: 18px; cursor: pointer;}
    .button-delete { padding: 8px 10px; font-size: 0.9em; border: none; border-radius: 4px; cursor: pointer; background-color: #f8d7da; color: #721c24; }
    .action-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
    .button-add { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; padding: 10px; flex-grow: 1; cursor: pointer; border-radius: 5px; }
    .button-reorder { background-color: #d1e7fd; color: #0c5460; border: 1px solid #bee5eb; padding: 10px; flex-grow: 1; cursor: pointer; font-weight: bold; }
    .button-map { display: block; width: 100%; padding: 15px; font-size: 1.2em; font-weight: bold; color: white; background-color: #1976d2; border: none; border-radius: 5px; cursor: pointer; }
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
    .button-save-log:disabled {
    background-color: #aaa;
    cursor: not-allowed;
}

.save-status {
    margin-top: 15px;
    padding: 10px;
    border-radius: 5px;
    font-weight: bold;
    text-align: center;
}
.save-status.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}
.save-status.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}
</style>
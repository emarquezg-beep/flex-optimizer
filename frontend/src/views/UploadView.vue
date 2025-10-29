<script setup>
// AGREGAR estos imports al inicio (alrededor de línea 3-4)
import { computeScoreV5 } from '@/utils/scoring';
import { 
  obtenerMensajeConsciente, 
  getIconForScore, 
  getColorForScore 
} from '@/constants/mensajesConscientes';
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
const USERS = [
  { name: 'Ernesto', id: 'b5a04a69-1e96-47c4-a0c8-972fec54c21d' },
  { name: 'Carmen Cecilia', id: 'b3aaad3a-5835-4796-aca7-ea634e150b5d' }
];
const selectedUserId = ref(USERS[0].id); // Default to Ernesto

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

const mostrarDetalles = ref(false);

const selectedScenarioForLog = ref('normal');
const blockData = ref({
  fecha: new Date().toISOString().split('T')[0],
  vehiculo: VEHICULO_OPTIONS[0],
  hora: '07:00',
  duracion_horas: DURACION_OPTIONS[1],
  pago: 0,
  antes_del_bloque: 45,
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

const jsonInput = ref(''); // Para el nuevo <textarea>

function calculateActualDelay() {
  try {
    const now = new Date();
    // Asegura que la hora del bloque tenga un valor
    if (!blockData.value.hora) {
      alert("Por favor, establece primero la 'Start Time (24h)' del bloque.");
      return;
    }
    
    const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
    
    const blockStartTime = new Date(); // Fecha de hoy
    blockStartTime.setHours(startHours, startMinutes, 0, 0); // Hora del bloque

    // Calcular diferencia en milisegundos
    const diffMs = now.getTime() - blockStartTime.getTime();
    
    // Convertir a minutos (max(0, ...) evita retrasos negativos si se calcula antes)
    const actualDelayMinutes = Math.max(0, Math.round(diffMs / 60000)); 
    
    // Actualizar el ref de blockData
    blockData.value.retraso_almacen = actualDelayMinutes;
    
    console.log(`⏱️ Retraso 'en caliente' calculado: ${actualDelayMinutes} minutos`);
    alert(`Retraso calculado y actualizado a: ${actualDelayMinutes} minutos.`);
    
  } catch (e) {
      console.error("Error calculating actual prep time:", e);
      alert(`Error al calcular la hora: ${e.message}. Asegúrate que 'Start Time' sea válido.`);
  }
}
  function resetAllInputs() {
  console.log('Resetting all inputs...');
  extractedAddresses.value = [];
  backendResponse.value = null;
  selectedFileNames.value = [];
  jsonInput.value = ''; // Limpiar el textarea también
  isProcessing.value = false;
  if (fileInputRef.value) {
    fileInputRef.value.value = ''; // Limpiar el input de archivo
  }
}

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

// ... (agrégala en <script setup>)

async function processJsonInput() {
  if (!jsonInput.value) {
    alert('Por favor, pega el JSON en el área de texto.');
    return;
  }

  isProcessing.value = true;
  
  // Usamos un setTimeout para que el UI se actualice a "Processing..."
  await new Promise(resolve => setTimeout(resolve, 50)); 

  try {
    // 1. Parsear el JSON
    const parsedData = JSON.parse(jsonInput.value);

    // 2. Validar que es un array
    if (!Array.isArray(parsedData)) {
      throw new Error('El JSON debe ser un array (una lista) de paradas.');
    }

    // 3. Mapear al formato interno de extractedAddresses
    const mappedStops = parsedData.map(item => {
      // AQUÍ ESTÁ LA MAGIA: Combinamos los campos de tu JSON en un solo string "address"
      const fullAddress = [
        item.street_address,
        item.apartment,
        item.city
      ].filter(Boolean).join(' ').trim(); // filter(Boolean) elimina nulos o strings vacíos

      return {
        number: item.stop_number || 0, // Usar 0 o algun default si no existe
        address: fullAddress,
        isDowntown: false // Asumimos false por defecto. El usuario puede marcarlo.
      };
    });

    // 4. Resetear estados y asignar data
    resetAllInputs(); // Limpia todo
    extractedAddresses.value = mappedStops; // Asigna las nuevas paradas
    
    console.log('Paradas cargadas desde JSON:', extractedAddresses.value);

  } catch (error) {
    console.error("Error procesando JSON:", error);
    alert(`Error al procesar el JSON: ${error.message}`);
    isProcessing.value = false; // Detener el procesamiento si hay error
  }
  // isProcessing se pondrá en false automáticamente por el resetAllInputs si todo va bien
}

async function handleFileChange(event) {
  // --- File selection logic ---
  const files = event.target.files;
  if (!files || files.length === 0) {
    selectedFileNames.value = [];
    return;
  }
  selectedFileNames.value = Array.from(files).map(f => f.name);

   // --- Reset state ---
  resetAllInputs();
  isProcessing.value = true;
  let allParsedStops = []; // Array to hold stops from all images

  // --- Declare range variables OUTSIDE try ---
  let maxStopNumber = 0;
  let minStopNumber = Infinity;
  // --- End declarations ---

  try {
    // --- OCR Loop ---
    for (const file of files) {
      console.log(`📸 Procesando archivo: ${file.name}`); // Log which file is being processed
      const processedImage = await preprocessImage(file);
      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng');
      console.log(`📝 Texto OCR para ${file.name}:`, text); // Log raw OCR text
      const stopsFromFile = parseAddresses(text);
      console.log(`🔍 Paradas encontradas en ${file.name}:`, stopsFromFile); // Log parsed stops for this file
      allParsedStops.push(...stopsFromFile);
    }
    // --- End OCR Loop ---

    console.log('📦 Total de paradas extraídas (antes de gaps):', allParsedStops);

    // --- Calculate Min/Max Stop Numbers ---
    // This MUST happen AFTER the loop finishes and BEFORE the gap filling
    const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));

    // Re-calculate min/max here using the final map
    minStopNumber = Infinity; // Reset before calculating
    maxStopNumber = 0;      // Reset before calculating
    uniqueStopsMap.forEach(stop => {
      if (stop.number > maxStopNumber) maxStopNumber = stop.number;
      if (stop.number < minStopNumber) minStopNumber = stop.number;
    });
    console.log(`📍 Rango de paradas detectado: ${minStopNumber} - ${maxStopNumber}`);
    // --- End Min/Max Calculation ---

    // --- Gap Filling Logic ---
    const fullListWithGaps = [];
    if (maxStopNumber > 0 && minStopNumber !== Infinity) { // Check if we found any valid stops
        const loopStart = 2; // Always start checking from stop #2
        console.log(`[DEBUG] Gap filling range: ${loopStart} to ${maxStopNumber}`);

        for (let i = loopStart; i <= maxStopNumber; i++) {
            console.log(`[DEBUG] Checking for stop number: ${i}`);
            if (uniqueStopsMap.has(i)) {
                console.log(`[DEBUG] Found stop ${i} in map. Adding it.`);
                fullListWithGaps.push(uniqueStopsMap.get(i));
            } else {
                console.log(`[DEBUG] Stop ${i} NOT found. Adding GAP.`);
                fullListWithGaps.push({ number: i, address: '', isDowntown: false });
            }
        }
    } else {
        console.log("[DEBUG] No valid stops found by OCR to fill gaps.");
    }
    // --- End Gap Filling ---

    console.log('[DEBUG] Final list with gaps (before assignment):', JSON.stringify(fullListWithGaps));
    extractedAddresses.value = fullListWithGaps;

  } catch (error) {
    console.error("Error processing images:", error);
    // Use error.message for a more specific alert
    alert(`Error procesando imágenes: ${error.message || 'Error desconocido'}`);
  } finally {
    isProcessing.value = false;
    // Reset file input to allow re-uploading the same file
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}
// --- END OF NEW BLOCK ---

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
    
    // ✅ VALIDATE scenario exists
    const chosenReport = reportData.value[scenarioKey];
    if (!chosenReport) {
        console.error(`Scenario "${scenarioKey}" not found in reportData`);
        return null;
    }
    
    const chosenETA = scenarioETAs.value[scenarioKey]?.normal;
    if (!chosenETA) {
        console.error(`ETA for scenario "${scenarioKey}" not found`);
        return null;
    }
    
    const user_id = selectedUserId.value;
    
   
// --- Calculate Primary City (IMPROVED) ---
let primary_city = null;
if (extractedAddresses.value.length > 0) {
    const cityCounts = {};
    
    extractedAddresses.value.forEach(stop => {
        if (!stop.address) return;
        
        // Remove common suffixes and parse
        let addr = stop.address.toUpperCase();
        
        // Remove apartment indicators
        addr = addr.replace(/\b(APT|UNIT|#)\s*\d+[A-Z]?\b/gi, '');
        
        // Remove state abbreviations at end
        addr = addr.replace(/\b(FL|FLORIDA)\s*$/i, '');
        
        // Split and get potential city (usually second-to-last or last word)
        const parts = addr.trim().split(/\s+/);
        
        // Common pattern: "123 MAIN ST ORLANDO" or "123 MAIN ST ORLANDO FL"
        // City is usually after street name
        let potentialCity = null;
        
        if (parts.length >= 3) {
            // Try to find city (skip numbers and short words)
            for (let i = parts.length - 1; i >= 0; i--) {
                const word = parts[i];
                // Skip if: number, or common street suffix, or too short
                if (!/^\d+$/.test(word) && 
                    !/^(ST|RD|AVE|BLVD|DR|LN|CT|WAY|PL|TER|CIR)$/i.test(word) &&
                    word.length > 2) {
                    potentialCity = word;
                    break;
                }
            }
        }
        
        if (potentialCity && potentialCity.length > 2) {
            cityCounts[potentialCity] = (cityCounts[potentialCity] || 0) + 1;
        }
    });
    

    // Find most common city
    let maxCount = 0;
    for (const city in cityCounts) {
        if (cityCounts[city] > maxCount) {
            maxCount = cityCounts[city];
            primary_city = city;
        }
    }
    
    // Capitalize properly (title case)
    if (primary_city) {
        primary_city = primary_city
            .split(' ')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }
    
    console.log("🏙️ Primary City Calculated:", primary_city, "Counts:", cityCounts);
}
// --- End City Calculation ---

    const first_stop_distance = Number(chosenReport.toStart.distance) || 0;
    
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
    const millas_de_trabajo = Number(chosenReport.totalWorkMiles) || 0;
    const millas_totales = commute_1 + millas_de_trabajo + commute_2;
    const pago_por_hora = duracion_horas > 0 ? pago / duracion_horas : 0;
    const pago_real_por_hora = tiempo_total > 0 ? pago / tiempo_total : 0;
    const millas_por_hora = duracion_horas > 0 ? millas_de_trabajo / duracion_horas : 0;
    const gasto_de_gasolina = (millas_totales / 35) * 3.00;
    const desgaste_vehiculo = millas_totales * 0.25;
    const tax = pago * 0.153;
    const claim_por_milla = millas_de_trabajo * 0.70;
    const numero_paradas = extractedAddresses.value.filter(s => s.address && s.address.trim() !== '').length;
    // Inside calculatedLogEntry computed property

    // ... (all the calculations for commute_1, commute_2, millas_de_trabajo, etc.)

// --- REPLACE THIS LOG ---
    console.log('[DEBUG] Data for Commute 2:', {
        scenarioKey: scenarioKey,
        // Log the specific distance property
        chosenReport_toEnd_distance: chosenReport?.toEnd?.distance, 
        calculated_commute_2: commute_2 
    });
    // --- END LOG ---
    return {
        fecha: data.fecha, vehiculo: data.vehiculo, warehouse: selectedWarehouseCode.value,
        hora: data.hora, duracion_horas: duracion_horas, pago: pago,
        pago_por_hora: pago_por_hora.toFixed(2), antes_del_bloque: antes_del_bloque_hrs.toFixed(2),
        despues_del_bloque: despues_del_bloque_hrs.toFixed(2), tiempo_total: tiempo_total.toFixed(2),
        pago_real_por_hora: pago_real_por_hora.toFixed(2), commute_1: commute_1.toFixed(2),
        commute_2: commute_2.toFixed(2), millas_de_trabajo: millas_de_trabajo.toFixed(2),
        millas_totales: millas_totales.toFixed(2), millas_por_hora: millas_por_hora.toFixed(2),
        gasto_de_gasolina: gasto_de_gasolina.toFixed(2), desgaste_vehiculo: desgaste_vehiculo.toFixed(2),
        tax: tax.toFixed(2), claim_por_milla: claim_por_milla.toFixed(2),
        user_id: user_id, primary_city: primary_city, first_stop: first_stop_distance.toFixed(2), numero_paradas: numero_paradas
    };
});

const routeScore = computed(() => {
  if (!calculatedLogEntry.value) return null;
  
  const scoreResult = computeScoreV5(calculatedLogEntry.value);
  const mensaje = obtenerMensajeConsciente(scoreResult.total);
  
  return {
    ...scoreResult,
    mensaje,
    icon: getIconForScore(scoreResult.total),
    color: getColorForScore(scoreResult.total),
    categoria: mensaje.categoria
  };
});

const chosenETA = computed(() => {
  if (!scenarioETAs.value || !selectedScenarioForLog.value) return null;
  return scenarioETAs.value[selectedScenarioForLog.value]?.normal;
});

// ============================================
// BACKEND COMMUNICATION & UI HELPERS (Restored)
// ============================================

function sanitizeAddress(address) {
    // --- Restored sanitizeAddress ---
    if (!address) return '';
    return address.replace(/[^a-zA-Z0-9\s#]/g, '').replace(/\s+/g, ' ').trim();
}

function startManualEntry() {
  console.log('Starting manual entry...');
  resetAllInputs(); // Limpia todo (archivos, JSON, etc.)
  
  // Inicia con una parada vacía
  extractedAddresses.value = [{ number: 2, address: '', isDowntown: false }];
}

async function sendToBackend() {
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
      
      // 🆕 ASIGNAR RESULTADO (CON O SIN ERRORES)
      backendResponse.value = result;
      
      // 🆕 SI HAY ERRORES, HACER SCROLL AUTOMÁTICO A LA ADVERTENCIA
      if (result.hasErrors) {
        console.error('❌ Errores detectados en la ruta:', result.failedAddresses);
        // Esperar un tick para que el DOM se actualice
        await new Promise(resolve => setTimeout(resolve, 100));
        const errorSection = document.querySelector('.address-errors');
        if (errorSection) {
          errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      
      if (!response.ok && !result.hasErrors) { 
        throw new Error(result.message || `Error ${response.status}`); 
      }
    } catch (error) {
      console.error("Error calling backend:", error);
      backendResponse.value = { error: `Error: ${error.message || 'No se pudo conectar al servidor.'}`, hasErrors: true };
    }
}

// Pega esto SOBREESCRIBIENDO tu función saveToLogbook() existente

async function saveToLogbook() {
    // 🆕 VALIDAR QUE NO HAYA ERRORES DE DIRECCIONES
    if (backendResponse.value?.hasErrors) {
        alert("❌ No puedes guardar la ruta porque hay direcciones inválidas. Por favor, corrígelas primero.");
        return;
    }
    
    if (!calculatedLogEntry.value || !routeScore.value) { 
        alert("No hay datos calculados o score para guardar.");
        return; 
    }
    
    isSaving.value = true; 
    saveStatus.value = null;
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    
    // --- ⬇️ AQUÍ ESTÁ EL CAMBIO IMPORTANTE ⬇️ ---
    const dataToSend = { 
      ...calculatedLogEntry.value,
      route_score: routeScore.value.total,
      
      // AGREGAR ESTOS CAMPOS (Según Fase 6 del Informe)
      stops_json: extractedAddresses.value, // Array completo sin encriptar //[cite: 496]
      eta_optimista: scenarioETAs.value[selectedScenarioForLog.value].optimistic.eta, 
      eta_normal: scenarioETAs.value[selectedScenarioForLog.value].normal.eta, 
      eta_pesimista: scenarioETAs.value[selectedScenarioForLog.value].pessimistic.eta 
    };
    // --- ⬆️ FIN DEL CAMBIO ⬆️ ---

    try {
        const response = await fetch(`${backendUrl}/api/log-route`, { //[cite: 500]
            method: 'POST', //[cite: 501]
            headers: { 'Content-Type': 'application/json' }, //[cite: 502]
            body: JSON.stringify(dataToSend) //[cite: 503]
        });
        
        const result = await response.json(); //[cite: 504]
        if (response.ok && result.success) { //[cite: 505]
            console.log("Respuesta del servidor:", result); //[cite: 506]
            saveStatus.value = { success: true, message: `¡Guardado con Éxito! (ID: ${result.data[0].id})` }; //[cite: 507-510]
        } else { 
          throw new Error(result.message || 'Error desconocido del servidor.'); //[cite: 513]
        }
    } catch (error) {
        console.error("Error al guardar en bitácora:", error); //[cite: 515]
        saveStatus.value = { success: false, message: `Error: ${error.message}` }; //[cite: 516-518]
    } finally { 
      isSaving.value = false; //[cite: 521]
    }
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
  <div class="view-container">
    <div class="uploader-container">

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

<div class="file-input-area">
        </div>

        <div class="gem-link-container">
        <a 
          href="https://gemini.google.com/gem/11PCFo5tGT1kWc0fd9PvoPz6uQryQUzTu?usp=sharing" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="gem-link"
        >
          🤖 Abrir el Gem para procesar direcciones
        </a>
      </div>
      <div class="json-paste-container">
        <textarea 
          v-model="jsonInput" 
          placeholder="... O pega el JSON de las paradas aquí"
          rows="8"
          class="json-textarea"
          :disabled="isProcessing"
        ></textarea>
        <button @click="processJsonInput" class="button-secondary" :disabled="isProcessing">
          Procesar JSON
        </button>
      </div>
      <div class="manual-entry-container">
          <button @click="startManualEntry" class="button-secondary" :disabled="isProcessing">
              📝 Enter Stops Manually
          </button>
      </div>

      <div v-if="isProcessing" class="status"><h3>Processing images...</h3></div>
      
      <div v-if="extractedAddresses.length > 0 && !isProcessing">
        
        <div class="controls-container">
          <div class="control-group">
            <label for="warehouse-select">Departure Point</label>
            <select id="warehouse-select" v-model="selectedWarehouseCode">
              <option v-for="wh in warehouses" :key="wh.code" :value="wh.code">
                {{ wh.code }} ({{ wh.commuteMiles }} mi)
              </option>
            </select>
          </div>
          <div class="control-group">
            <label for="destination-select">Final Destination</label>
            <select id="destination-select" v-model="selectedDestination">
              <option v-for="dest in destinations" :key="dest.code" :value="dest.address">{{ dest.code }}</option>
            </select>
          </div>
        </div>
        <div v-if="selectedDestination === 'custom'" class="custom-input-container">
          <input type="text" v-model="customDestination" placeholder="Enter custom destination address">
        </div>

        <div class="block-details-container">
            <h3>Block Details</h3>
            <div class="form-group">
              <label for="user-select">Conductor</label>
              <select id="user-select" v-model="selectedUserId">
                <option v-for="user in USERS" :key="user.id" :value="user.id">
                  {{ user.name }}
                </option>
              </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" v-model="blockData.fecha">
                </div>
                <div class="form-group">
                    <label>Start Time (24h)</label>
                    <input type="time" v-model="blockData.hora">
                </div>
                <div class="form-group">
                    <label>Vehicle</label>
                    <select v-model="blockData.vehiculo">
                        <option v-for="v in VEHICULO_OPTIONS" :key="v" :value="v">{{ v }}</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Duration (Hours)</label>
                    <select v-model.number="blockData.duracion_horas">
                        <option v-for="d in DURACION_OPTIONS" :key="d" :value="d">{{ d }} hrs</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Payment ($)</label>
                    <input type="number" v-model.number="blockData.pago" placeholder="e.g., 70.50">
                </div>
            </div>
             <div class="form-row">
                <div class="form-group">
                    <label>Time Before Block (min)</label>
                    <input type="number" v-model.number="blockData.antes_del_bloque" step="5">
                </div>
                <div class="form-group">
                    <label>Commute 1 (Miles)</label>
                    <input type="number" v-model.number="blockData.commute_1_manual" step="0.1">
                </div>
                <!-- Warehouse Delay -->
                 <div class="form-group">
                    <label class="label-with-button">
                      <span>Warehouse Delay (min)</span>
                      <button @click.prevent="calculateActualDelay" class="button-tertiary">Ahora</button>
                    </label>
                    <input type="number" v-model.number="blockData.retraso_almacen" step="5">
                  </div>
        </div>
</div>

        <div class="address-list">
          <h2>📝 Review and Edit Stops ({{ extractedAddresses.length }})</h2>
          <ol class="ordered-list">
            <li v-for="(stop, index) in extractedAddresses" :key="index" class="editable-item">
              <input type="number" v-model.number="stop.number" class="stop-number-input" placeholder="#">
              <input type="text" v-model="stop.address" class="address-input" placeholder="Stop address">
              <label class="downtown-label" title="Mark if Downtown">
                <input type="checkbox" v-model="stop.isDowntown" class="downtown-checkbox"> DT
              </label>
              <button @click="removeAddress(index)" class="button-delete">🗑️</button>
            </li>
          </ol>
          <div class="action-buttons">
            <button @click="addAddress" class="button-add">➕ Add Stop</button>
            <button @click="reorderList" class="button-reorder">🔄 Reorder List</button>
          </div>
        </div> 
        
        <button @click="sendToBackend" class="button-map button-primary">Evaluate Scenarios</button>

        <div v-if="backendResponse">
          <div v-if="backendResponse.status === 'loading'" class="backend-status">Evaluating scenarios...</div>
          
          <div v-else-if="reportData && calculatedLogEntry" class="results-container">
<div class="scenario-table">
              <h4>📊 Final Comparison</h4>
              <table>
                <tbody>
                  <tr><td>Normal Route (1 → End)</td><td>{{ reportData.normal.totalMiles }} mi</td><td>-</td></tr>
                  <tr class="highlight">
                    <td><strong>Inverse Route (End → 1)</strong></td>
                    <td><strong>{{ reportData.inverse.totalMiles }} mi</strong></td>
                    <td><strong class="savings">{{ reportData.savings >= 0 ? `-${reportData.savings}` : `+${Math.abs(reportData.savings)}` }} mi</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <hr>
            <div class="result-block">
              <h4>➡️ Normal Route Breakdown</h4>
              <p>To 1st Stop: <strong>{{ reportData.normal.toStart.duration }} min - {{ reportData.normal.toStart.distance }} mi</strong></p>
              <div v-for="(segment, index) in reportData.normal.segments" :key="`norm-seg-${index}`" class="segment-breakdown">
                <p>Segment {{ index + 1 }} (Drive): <strong>{{ segment.duration }} min - {{ segment.distance }} mi</strong>
                  <span class="calc-details">({{ segment.stopsCount }} stops | {{ segment.aptCount }} apts | {{ segment.downtownCount }} DT)</span>
                </p>
              </div>
              <hr class="dotted-hr">
              <p class="total-time"><strong>Total Work: {{ reportData.normal.totalWorkDuration }} min - {{ reportData.normal.totalWorkMiles }} mi</strong></p>
              <p>To Final Destination: <strong>{{ reportData.normal.toEnd.duration }} min - {{ reportData.normal.toEnd.distance }} mi</strong></p>
              <hr class="dotted-hr">
              <p class="total-time grand-total"><strong>Total Route: {{ reportData.normal.totalDuration }} min - {{ reportData.normal.totalMiles }} mi</strong></p>
            </div>
            <div v-if="scenarioETAs?.normal" class="result-block eta-block">
              <h4>⏱️ Arrival Estimates (Normal Route)</h4>
              <div class="eta-scenario"><span class="eta-label optimistic">Optimista:</span><strong class="eta-time">{{ scenarioETAs.normal.optimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.normal.optimistic.totalDuration }} min)</span></div>
              <div class="eta-scenario"><span class="eta-label normal">Normal:</span><strong class="eta-time">{{ scenarioETAs.normal.normal.eta }}</strong><span class="eta-duration">({{ scenarioETAs.normal.normal.totalDuration }} min)</span></div>
              <div class="eta-scenario"><span class="eta-label pessimistic">Pessimista:</span><strong class="eta-time">{{ scenarioETAs.normal.pessimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.normal.pessimistic.totalDuration }} min)</span></div>
            </div>
            <hr>
            <div class="result-block inverse-block">
              <h4>⬅️ Inverse Route Breakdown</h4>
              <p>To Last Stop: <strong>{{ reportData.inverse.toStart.duration }} min - {{ reportData.inverse.toStart.distance }} mi</strong></p>
              <div v-for="(segment, index) in reportData.inverse.segments" :key="`inv-seg-${index}`" class="segment-breakdown">
                <p>Segment {{ index + 1 }} (Drive): <strong>{{ segment.duration }} min - {{ segment.distance }} mi</strong>
                  <span class="calc-details">({{ segment.stopsCount }} stops | {{ segment.aptCount }} apts | {{ segment.downtownCount }} DT)</span>
                </p>
              </div>
              <hr class="dotted-hr">
              <p class="total-time"><strong>Total Work: {{ reportData.inverse.totalWorkDuration }} min - {{ reportData.inverse.totalWorkMiles }} mi</strong></p>
              <p>From 1st Stop to Destination: <strong>{{ reportData.inverse.toEnd.duration }} min - {{ reportData.inverse.toEnd.distance }} mi</strong></p>
              <hr class="dotted-hr">
              <p class="total-time grand-total"><strong>Total Route: {{ reportData.inverse.totalDuration }} min - {{ reportData.inverse.totalMiles }} mi</strong></p>
            </div>
            <div v-if="scenarioETAs?.inverse" class="result-block eta-block inverse-eta">
              <h4>⏱️ Arrival Estimates (Inverse Route)</h4>
              <div class="eta-scenario"><span class="eta-label optimistic">Optimista:</span><strong class="eta-time">{{ scenarioETAs.inverse.optimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.inverse.optimistic.totalDuration }} min)</span></div>
              <div class="eta-scenario"><span class="eta-label normal">Normal:</span><strong class="eta-time">{{ scenarioETAs.inverse.normal.eta }}</strong><span class="eta-duration">({{ scenarioETAs.inverse.normal.totalDuration }} min)</span></div>
              <div class="eta-scenario"><span class="eta-label pessimistic">Pessimista:</span><strong class="eta-time">{{ scenarioETAs.inverse.pessimistic.eta }}</strong><span class="eta-duration">({{ scenarioETAs.inverse.pessimistic.totalDuration }} min)</span></div>
            </div>


<!-- 🆕 SECCIÓN DE ERRORES DE DIRECCIONES -->
<div v-if="backendResponse?.hasErrors && backendResponse?.failedAddresses" class="address-errors">
  <h3>⚠️ Advertencia: Direcciones No Encontradas</h3>
  <p class="error-intro">
    Google Maps no pudo encontrar rutas para las siguientes direcciones. 
    Por favor, verifica que estén escritas correctamente antes de continuar.
  </p>
  
  <div class="error-list">
    <div 
      v-for="(failed, index) in backendResponse.failedAddresses" 
      :key="index"
      class="error-item"
    >
      <div class="error-header">
        <span class="error-icon">🚫</span>
        <strong>{{ failed.type }}</strong>
      </div>
      <div class="error-details">
        <p><strong>Desde:</strong> {{ failed.from }}</p>
        <p><strong>Hasta:</strong> {{ failed.to }}</p>
        <p v-if="failed.waypoints && failed.waypoints.length > 0">
          <strong>Waypoints:</strong> {{ failed.waypoints.join(', ') }}
        </p>
        <p class="error-type">
          <strong>Tipo de Error:</strong> 
          <span class="error-badge">{{ failed.errorType }}</span>
        </p>
      </div>
    </div>
  </div>
  
  <div class="error-actions">
    <p>✏️ <strong>Acción requerida:</strong> Corrige las direcciones arriba y vuelve a hacer clic en "Evaluate Scenarios".</p>
  </div>
</div>
            <!-- LOGBOOK FORM CON NUEVO DISEÑO -->
<div v-if="reportData && calculatedLogEntry && routeScore" class="logbook-form-container">
  
  <!-- RESUMEN CONSCIENTE (SIEMPRE VISIBLE) -->
  <div class="resumen-consciente">
    
    <!-- Header con Score -->
    <div class="score-header">
      <div class="score-badge" :style="{ backgroundColor: routeScore.color }">
        <span class="score-icon">{{ routeScore.icon }}</span>
        <div class="score-info">
          <span class="score-value">{{ routeScore.total }}/100</span>
          <span class="score-label">{{ routeScore.categoria }}</span>
        </div>
      </div>
    </div>

    <!-- Métricas Clave -->
    <div class="metricas-clave">
      <div class="metrica">
        <div class="metrica-icon">⏱️</div>
        <div class="metrica-content">
          <span class="metrica-label">Hora Estimada de Llegada</span>
          <span class="metrica-value">{{ chosenETA?.eta || 'N/A' }}</span>
        </div>
      </div>
      
      <div class="metrica">
        <div class="metrica-icon">🛣️</div>
        <div class="metrica-content">
          <span class="metrica-label">Millas Totales a Conducir</span>
          <span class="metrica-value">{{ calculatedLogEntry.millas_totales }} mi</span>
        </div>
      </div>
      
      <div class="metrica">
        <div class="metrica-icon">💰</div>
        <div class="metrica-content">
          <span class="metrica-label">Pago Real por Hora</span>
          <span class="metrica-value">${{ calculatedLogEntry.pago_real_por_hora }}/h</span>
        </div>
      </div>
    </div>

    <!-- Mensaje Consciente -->
    <div class="mensaje-consciente">
      <blockquote class="frase">
        "{{ routeScore.mensaje.frase }}"
        <cite>— {{ routeScore.mensaje.autor }}</cite>
      </blockquote>
      
      <div class="accion">
        <strong>💡 Reflexión:</strong>
        <p>{{ routeScore.mensaje.accion }}</p>
      </div>
    </div>

    <!-- Botón Expandir Detalles -->
    <button 
      @click="mostrarDetalles = !mostrarDetalles" 
      class="button-toggle-details"
    >
      {{ mostrarDetalles ? '▲ Ocultar Detalles Técnicos' : '▼ Mostrar Detalles Técnicos' }}
    </button>
  </div>

  <!-- DETALLES EXPANDIBLES -->
  <transition name="expand">
    <div v-if="mostrarDetalles" class="detalles-tecnicos">
      
      <!-- User & Scenario Selection -->
      <h3>📋 Datos del Bloque</h3>
      <div class="form-row">

        <div class="form-group">
          <label>Escenario Usado</label>
          <div class="scenario-pills">
            <label class="pill-option">
              <input type="radio" v-model="selectedScenarioForLog" value="normal">
              <span>Normal</span>
            </label>
            <label class="pill-option">
              <input type="radio" v-model="selectedScenarioForLog" value="inverse">
              <span>Inversa</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Breakdown Detallado -->
      <div class="breakdown-section">
        <h4>📊 Desglose Financiero</h4>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">Pago Base del Bloque:</span>
            <span class="breakdown-value">${{ calculatedLogEntry.pago }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Pago/Hora (Bloque):</span>
            <span class="breakdown-value">${{ calculatedLogEntry.pago_por_hora }}</span>
          </div>
          <div class="breakdown-item negative">
            <span class="breakdown-label">Gasto de Gasolina:</span>
            <span class="breakdown-value">-${{ calculatedLogEntry.gasto_de_gasolina }}</span>
          </div>
          <div class="breakdown-item negative">
            <span class="breakdown-label">Desgaste de Vehículo:</span>
            <span class="breakdown-value">-${{ calculatedLogEntry.desgaste_vehiculo }}</span>
          </div>
          <div class="breakdown-item negative">
            <span class="breakdown-label">Impuestos (15.3%):</span>
            <span class="breakdown-value">-${{ calculatedLogEntry.tax }}</span>
          </div>
          <div class="breakdown-item positive">
            <span class="breakdown-label">Deducción por Milla:</span>
            <span class="breakdown-value">+${{ calculatedLogEntry.claim_por_milla }}</span>
          </div>
        </div>
      </div>

      <div class="breakdown-section">
        <h4>🛣️ Desglose de Distancias</h4>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">Commute 1 (Casa → Warehouse):</span>
            <span class="breakdown-value">{{ calculatedLogEntry.commute_1 }} mi</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Primera Parada:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.first_stop }} mi</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Millas de Trabajo:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.millas_de_trabajo }} mi</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Millas/Hora (Trabajo):</span>
            <span class="breakdown-value">{{ calculatedLogEntry.millas_por_hora }} mi/h</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Commute 2 (Última → Destino):</span>
            <span class="breakdown-value">{{ calculatedLogEntry.commute_2 }} mi</span>
          </div>
          <div class="breakdown-item highlight">
            <span class="breakdown-label">Total de Millas:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.millas_totales }} mi</span>
          </div>
        </div>
      </div>

      <div class="breakdown-section">
        <h4>⏱️ Desglose de Tiempos</h4>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">Antes del Bloque:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.antes_del_bloque }} h</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Duración del Bloque:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.duracion_horas }} h</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Después del Bloque:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.despues_del_bloque }} h</span>
          </div>
          <div class="breakdown-item highlight">
            <span class="breakdown-label">Tiempo Total Invertido:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.tiempo_total }} h</span>
          </div>
        </div>
      </div>

      <div class="breakdown-section">
        <h4>📍 Información Adicional</h4>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">Ciudad Principal:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.primary_city || 'N/A' }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Warehouse:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.warehouse }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Vehículo:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.vehiculo }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Número de Paradas:</span>
            <span class="breakdown-value">{{ calculatedLogEntry.numero_paradas }}</span>
          </div>
        </div>
      </div>

      <!-- Red Flags Section -->
      <div v-if="routeScore.redFlags && routeScore.redFlags.length > 0" class="breakdown-section red-flags">
        <h4>⚠️ Alertas Detectadas</h4>
        <div class="flags-list">
          <div 
            v-for="(flag, index) in routeScore.redFlags" 
            :key="index"
            :class="['flag-item', flag.nivel.toLowerCase()]"
          >
            <span class="flag-badge">{{ flag.nivel }}</span>
            <span class="flag-mensaje">{{ flag.mensaje }}</span>
            <span class="flag-penalty">{{ flag.penalizacion }} pts</span>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- Botón de Guardar -->
  <button @click="saveToLogbook" class="button-save-log" :disabled="isSaving">
    {{ isSaving ? 'Guardando...' : '💾 Guardar en Bitácora' }}
  </button>
  
  <div v-if="saveStatus" :class="['save-status', saveStatus.success ? 'success' : 'error']">
    {{ saveStatus.message }}
  </div>
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
    .manual-entry-container {
  text-align: center;
  margin-bottom: 20px;
    }

    .block-details-container {
      margin-top: 20px;
      margin-bottom: 20px;
      padding: 20px;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
    }

    .block-details-container h3 {
      margin-top: 0;
      color: var(--color-primary);
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 10px;
      margin-bottom: 15px;
    }

    /* Ensure address list only appears after details are shown */
    .address-list {
      /* margin-top is already there, looks fine */
    }

    /* --- JSON Paste Area --- */
.json-paste-container {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.json-textarea {
  width: 100%;
  padding: 10px;
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9em;
  background-color: var(--color-background); /* Fondo oscuro */
  color: var(--color-text-primary); /* Texto claro */
  border: 1px solid var(--color-border);
  border-radius: 5px;
  resize: vertical;
}

.json-textarea:disabled {
  background-color: var(--color-border);
  cursor: not-allowed;
}

/* Asumimos que .button-secondary es un estilo global o similar */
.json-paste-container .button-secondary {
  width: 100%;
  text-align: center;
  padding: 12px;
  font-weight: 500;
  font-size: 1em;
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  cursor: pointer;
}
.json-paste-container .button-secondary:hover {
  background-color: var(--color-border);
}
.json-paste-container .button-secondary:disabled {
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}
/* ============================================ */
/* =            ESTILOS PARA MÓVIL            = */
/* ============================================ */
@media (max-width: 768px) {

  /* --- 1. Arregla el formulario "Block Details" --- */
  /* Forzamos a que los grupos de campos se apilen verticalmente */
  .form-row {
    flex-direction: column; /* Apila los campos */
    gap: 15px; /* Mantiene el espacio entre ellos */
  }
  
  /* El .form-group ya tiene 'flex: 1', 
     así que tomará 100% de ancho automáticamente.
     ¡Esto arregla el campo "Vehicle"! */


  /* --- 2. Arregla la lista de direcciones --- */
  
  /* Reducimos el tamaño de todo en la fila de la dirección */
  .editable-item {
    gap: 8px; /* Un poco menos de espacio entre elementos */
  }

  /* Hacemos la fuente de la dirección más pequeña para que quepa más texto */
  .address-input {
    font-size: 0.5em;  /* <-- ESTA ES LA CLAVE! */
    padding: 10px 8px; /* Ajustamos un poco el padding */
  }

  /* Achicamos un poco los elementos de los lados */
  .stop-number-input {
    width: 40px;
    font-size: 0.5em;
  }

  .downtown-label {
    font-size: 0.8em;
  }

  .button-delete {
    padding: 8px;
  }
}
/* --- Link al Gem --- */
.gem-link-container {
  margin-bottom: 20px;
  text-align: center;
}
.gem-link {
  display: inline-block;
  padding: 10px 15px;
  background-color: var(--color-surface);
  color: var(--color-accent); /* Usamos el color 'accent' para que resalte */
  border: 1px solid var(--color-border);
  border-radius: 5px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}
.gem-link:hover {
  background-color: var(--color-border);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}
/* ========================================
   RESUMEN CONSCIENTE
   ======================================== */

.resumen-consciente {
  background: linear-gradient(135deg, var(--color-surface) 0%, rgba(42, 62, 80, 0.5) 100%);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
}

.score-header {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.score-badge {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px 30px;
  border-radius: 50px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.score-icon {
  font-size: 3em;
}

.score-info {
  display: flex;
  flex-direction: column;
  color: white;
}

.score-value {
  font-size: 2em;
  font-weight: bold;
  line-height: 1;
}

.score-label {
  font-size: 0.9em;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Métricas Clave */
.metricas-clave {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.metrica {
  display: flex;
  align-items: center;
  gap: 15px;
  background-color: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  transition: transform 0.2s ease;
}

.metrica:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.metrica-icon {
  font-size: 2.5em;
  opacity: 0.8;
}

.metrica-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.metrica-label {
  font-size: 0.85em;
  color: var(--color-text-secondary);
  margin-bottom: 5px;
}

.metrica-value {
  font-size: 1.4em;
  font-weight: bold;
  color: var(--color-text-primary);
}

/* Mensaje Consciente */
.mensaje-consciente {
  background: linear-gradient(135deg, rgba(165, 201, 151, 0.1) 0%, rgba(165, 201, 151, 0.05) 100%);
  border-left: 4px solid var(--color-accent);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.frase {
  font-style: italic;
  color: var(--color-text-primary);
  font-size: 1.15em;
  line-height: 1.7;
  margin: 0 0 15px 0;
  padding: 0;
  border: none;
}

.frase cite {
  display: block;
  margin-top: 12px;
  font-size: 0.9em;
  color: var(--color-accent);
  font-style: normal;
  font-weight: 600;
}

.accion {
  background-color: rgba(165, 201, 151, 0.15);
  padding: 15px;
  border-radius: 6px;
  margin-top: 15px;
}

.accion strong {
  color: var(--color-accent);
  display: block;
  margin-bottom: 8px;
  font-size: 0.95em;
}

.accion p {
  margin: 0;
  color: var(--color-text-primary);
  line-height: 1.6;
  font-size: 1.05em;
}

/* Botón Toggle */
.button-toggle-details {
  width: 100%;
  padding: 12px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.3s ease;
}

.button-toggle-details:hover {
  background-color: var(--color-border);
  border-color: var(--color-primary);
}

/* ========================================
   DETALLES TÉCNICOS
   ======================================== */

.detalles-tecnicos {
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 25px;
  margin-top: 20px;
  margin-bottom: 20px;
}

.detalles-tecnicos h3 {
  color: var(--color-primary);
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--color-border);
}

.detalles-tecnicos h4 {
  color: var(--color-accent);
  margin-top: 25px;
  margin-bottom: 15px;
  font-size: 1.1em;
}

/* Scenario Pills */
.scenario-pills {
  display: flex;
  gap: 10px;
}

.pill-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 15px;
  background-color: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill-option input[type="radio"] {
  display: none;
}

.pill-option:has(input:checked) {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.pill-option:hover {
  border-color: var(--color-primary);
}

/* Breakdown Sections */
.breakdown-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-top: 15px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.breakdown-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border);
}

.breakdown-label {
  font-size: 0.95em;
  color: var(--color-text-secondary);
}

.breakdown-value {
  font-weight: bold;
  font-size: 1.1em;
  color: var(--color-text-primary);
}

.breakdown-item.negative .breakdown-value {
  color: #ff5722;
}

.breakdown-item.positive .breakdown-value {
  color: var(--color-accent);
}

.breakdown-item.highlight {
  background-color: rgba(165, 201, 151, 0.1);
  border-color: var(--color-accent);
}

.breakdown-item.highlight .breakdown-value {
  color: var(--color-accent);
  font-size: 1.2em;
}

/* Red Flags */
.red-flags {
  background-color: rgba(255, 87, 34, 0.05);
  border: 1px solid rgba(255, 87, 34, 0.3);
  border-radius: 8px;
  padding: 20px;
}

.flags-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flag-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border-left: 4px solid;
}

.flag-item.critico {
  border-left-color: #dc3545;
}

.flag-item.severo {
  border-left-color: #ff9800;
}

.flag-item.advertencia {
  border-left-color: #ffc107;
}

.flag-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.flag-item.critico .flag-badge {
  background-color: #dc3545;
  color: white;
}

.flag-item.severo .flag-badge {
  background-color: #ff9800;
  color: white;
}

.flag-item.advertencia .flag-badge {
  background-color: #ffc107;
  color: #333;
}

.flag-mensaje {
  flex: 1;
  color: var(--color-text-primary);
  font-size: 0.95em;
}

.flag-penalty {
  font-weight: bold;
  color: #ff5722;
  font-size: 0.9em;
}

/* Expand Transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 3000px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}
/* --- Estilos para el botón 'Ahora' en el label --- */
.label-with-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.button-tertiary {
  padding: 3px 8px;
  font-size: 0.8em;
  font-weight: 500;
  background-color: var(--color-surface);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.2;
}
.button-tertiary:hover {
  background-color: rgba(165, 201, 151, 0.1);
  color: var(--color-text-primary);
}
/* ========================================
   ERRORES DE DIRECCIONES
   ======================================== */

.address-errors {
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(220, 53, 69, 0.05) 100%);
  border: 2px solid #dc3545;
  border-radius: 12px;
  padding: 25px;
  margin: 20px 0;
  animation: pulseError 2s ease-in-out infinite;
}

@keyframes pulseError {
  0%, 100% { border-color: #dc3545; }
  50% { border-color: #ff5722; }
}

.address-errors h3 {
  color: #dc3545;
  margin: 0 0 15px 0;
  font-size: 1.3em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-intro {
  color: var(--color-text-primary);
  margin-bottom: 20px;
  font-size: 1.05em;
  line-height: 1.6;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.error-item {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(220, 53, 69, 0.3);
  border-radius: 8px;
  padding: 15px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}

.error-icon {
  font-size: 1.5em;
}

.error-header strong {
  color: #dc3545;
  font-size: 1.1em;
}

.error-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-details p {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 0.95em;
}

.error-details strong {
  color: var(--color-text-secondary);
  margin-right: 8px;
}

.error-type {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
}

.error-badge {
  display: inline-block;
  padding: 4px 12px;
  background-color: rgba(220, 53, 69, 0.2);
  border: 1px solid #dc3545;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
  color: #ff5722;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.error-actions {
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 15px;
  margin-top: 20px;
}

.error-actions p {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.05em;
  line-height: 1.6;
}

/* Modificar el botón de guardar cuando hay errores */
.button-save-log:disabled {
  background-color: #6c2a32 !important;
  cursor: not-allowed !important;
  opacity: 0.6 !important;
}
</style>
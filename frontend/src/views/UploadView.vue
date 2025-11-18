<script setup>
// ============================================
// IMPORTS
// ============================================
import { computeScoreV5 } from '@/utils/scoring';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useVehicles } from '@/composables/useVehicles';
import { fetchWithAuth } from '@/lib/api';
import { 
  obtenerMensajeConsciente, 
  getIconForScore, 
  getColorForScore 
} from '@/constants/mensajesConscientes';
import { ref, computed, watch, onMounted } from 'vue';
import Tesseract from 'tesseract.js';

// ============================================
// VARIABLES Y REFS
// ============================================
const route = useRoute();
const extractedAddresses = ref([]);
const isProcessing = ref(false);
const backendResponse = ref(null);
const isSaving = ref(false);
const saveStatus = ref(null);
const fileInputRef = ref(null);
const selectedFileNames = ref([]);
// Variables para detección de downtown
const showDowntownModal = ref(false);
const orlandoApartments = ref([]);
const downtownSelection = ref({});

// 🤖 ARIA: Datos del sistema inteligente
const ariaData = ref(null);

// ✅ Usuario autenticado
const { userId } = useAuth();
// 🚗 Vehículos dinámicos
const { vehicles, fetchActiveVehicles } = useVehicles();
const fileInputLabel = computed(() => {
  return isProcessing.value ? 'Processing...' : 'Choose Screenshots or Drag Here';
});

const DURACION_OPTIONS = [1, 1.5,2, 3, 3.5, 4, 4.5, 5];

const warehouses = ref([
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL', commuteMiles: 23 },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL', commuteMiles: 28 },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL', commuteMiles: 20 },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL', commuteMiles: 18 },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL', commuteMiles: 47 },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL', commuteMiles: 50 },
  { code: 'DFL5', address: '3000 Shelby Industrial Dr Apopka, FL', commuteMiles: 24 },
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

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const selectedScenarioForLog = ref('normal');
const blockData = ref({
  fecha: getLocalDateString(),
  vehiculo: '',  // ← Ahora será un UUID (se carga desde route.query)
  hora: '07:00',
  duracion_horas: DURACION_OPTIONS[1],
  pago: 0,
  antes_del_bloque: 45,
  commute_1_manual: warehouses.value[0].commuteMiles,
  retraso_almacen: 20
});

const jsonInput = ref('');

watch(selectedWarehouseCode, (newCode) => {
  const warehouse = warehouses.value.find(w => w.code === newCode);
  if (warehouse) {
    blockData.value.commute_1_manual = warehouse.commuteMiles;
  }
});

// ============================================
// FUNCIONES HELPER (ANTES DE onMounted)
// ============================================

function getCommuteForWarehouse(warehouseCode) {
  const warehouse = warehouses.value.find(w => w.code === warehouseCode);
  return warehouse ? warehouse.commuteMiles : warehouses.value[0].commuteMiles;
}

function getVehicleNickname(vehicleId) {
  if (!vehicleId) return 'No especificado';
  const vehicle = vehicles.value.find(v => v.id === vehicleId);
  return vehicle ? vehicle.nickname : 'Vehículo desconocido';
}
// ============================================
// onMounted - PRE-FILL DESDE BLOQUE AGENDADO
// ============================================

onMounted(() => {
  console.log('🚀 UploadView montado');
  console.log('📋 route.query:', route.query);
  
  // ✅ Pre-llenar si viene de bloque agendado
  if (route.query.blockId) {
    console.log('📦 Pre-llenando desde bloque:', route.query.blockId);
    
    try {
      blockData.value = {
        fecha: route.query.fecha || getLocalDateString(),
        vehiculo: route.query.vehicle_id || '',  // ← UUID del vehículo
        hora: route.query.hora?.substring(0, 5) || '07:00',
        duracion_horas: parseFloat(route.query.duracion) || DURACION_OPTIONS[1],
        pago: parseFloat(route.query.pago) || 0,
        antes_del_bloque: 45,
        commute_1_manual: getCommuteForWarehouse(route.query.warehouse),
        retraso_almacen: 20
      };
      
      const warehouseCode = route.query.warehouse;
      if (warehouseCode) {
        selectedWarehouseCode.value = warehouseCode;
      }
      
      console.log('✅ Pre-fill completado:', blockData.value);
    } catch (error) {
      console.error('❌ Error en pre-fill:', error);
    }
  }
});


// ============================================
// FUNCIONES DE DETECCIÓN DE DOWNTOWN
// ============================================

function isInOrlando(address) {
  if (!address) return false;
  return /\bORLANDO\b/i.test(address);
}

function detectOrlandoApartments() {
  return extractedAddresses.value.filter(stop => 
    stop.address && 
    stop.isApartment && // ✅ Usa el campo del objeto
    isInOrlando(stop.address)
  );
}

function showDowntownDetection() {
  const apartments = detectOrlandoApartments();
  
  if (apartments.length === 0) {
    return false; // No hay apartamentos en Orlando, continuar
  }
  
  // Preparar datos para el modal
  orlandoApartments.value = apartments;
  downtownSelection.value = {};
  apartments.forEach(apt => {
    downtownSelection.value[apt.number] = false;
  });
  
  showDowntownModal.value = true;
  return true; // Mostrar modal
}

function confirmDowntownSelection() {
  // Aplicar selección a extractedAddresses
  Object.keys(downtownSelection.value).forEach(stopNumber => {
    const stop = extractedAddresses.value.find(s => s.number === parseInt(stopNumber));
    if (stop) {
      stop.isDowntown = downtownSelection.value[stopNumber];
    }
  });
  
  showDowntownModal.value = false;
  
  // Continuar con evaluación
  proceedWithEvaluation();
}

function skipDowntownSelection() {
  // Marcar todos como NO downtown
  orlandoApartments.value.forEach(apt => {
    const stop = extractedAddresses.value.find(s => s.number === apt.number);
    if (stop) {
      stop.isDowntown = false;
    }
  });
  
  showDowntownModal.value = false;
  proceedWithEvaluation();
}

async function proceedWithEvaluation() {
  // Continuar con el proceso normal de evaluación
  await sendToBackend();
}
// ============================================
// FUNCIÓN PRINCIPAL: EVALUAR RUTA
// ============================================

async function evaluateRoute() {
  // Si no hay direcciones procesadas, primero procesar el JSON
  if (extractedAddresses.value.length === 0) {
    if (!jsonInput.value) {
      alert('Please paste the JSON from the Gem first.');
      return;
    }

    isProcessing.value = true;
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const parsedData = JSON.parse(jsonInput.value);

      if (!Array.isArray(parsedData)) {
        throw new Error('JSON must be an array of stops.');
      }

      const mappedStops = parsedData.map(item => {
        const fullAddress = [
          item.street_address,
          item.apartment,
          item.city
        ].filter(Boolean).join(' ').trim();

        return {
          number: item.stop_number || 0,
          address: fullAddress,
          isDowntown: false,
          isApartment: item.apartment != null // ✅ NUEVO
        };
      });

      extractedAddresses.value = mappedStops;
      
      console.log('✅ Stops loaded from JSON:', extractedAddresses.value.length);
      
      // Pequeña pausa para mostrar el contador de stops
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // ✅ Resetear isProcessing antes de detectar downtown
      isProcessing.value = false;
      
    } catch (error) {
      console.error("Error processing JSON:", error);
      alert(`Error processing JSON: ${error.message}`);
      isProcessing.value = false;
      return;
    }
  }

  // 🔍 NUEVA LÓGICA: Detectar apartamentos en Orlando
  const needsDowntownCheck = showDowntownDetection();
  
  if (needsDowntownCheck) {
    // Modal se muestra automáticamente, esperar confirmación del usuario
    return; // No continuar hasta que usuario responda
  }
  
  // Si no necesita check o ya se confirmó, evaluar
  await proceedWithEvaluation();
}

// ============================================
// FUNCIONES OCR (COMENTADAS - No se usan)
// ============================================

/*
function calculateActualDelay() {
  try {
    const now = new Date();
    if (!blockData.value.hora) {
      alert("Por favor, establece primero la 'Start Time (24h)' del bloque.");
      return;
    }
    
    const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
    const blockStartTime = new Date();
    blockStartTime.setHours(startHours, startMinutes, 0, 0);
    const diffMs = now.getTime() - blockStartTime.getTime();
    const actualDelayMinutes = Math.max(0, Math.round(diffMs / 60000));
    blockData.value.retraso_almacen = actualDelayMinutes;
    
    console.log(`⏱️ Retraso calculado: ${actualDelayMinutes} minutos`);
    alert(`Retraso calculado: ${actualDelayMinutes} minutos.`);
  } catch (e) {
    console.error("Error calculating delay:", e);
    alert(`Error: ${e.message}`);
  }
}

function resetAllInputs() {
  console.log('Resetting all inputs...');
  extractedAddresses.value = [];
  backendResponse.value = null;
  selectedFileNames.value = [];
  jsonInput.value = '';
  isProcessing.value = false;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

function preprocessImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const contrast = 2.0;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        for (let i = 0; i < data.length; i += 4) {
          data[i] = factor * (data[i] - 128) + 128;
          data[i+1] = factor * (data[i+1] - 128) + 128;
          data[i+2] = factor * (data[i+2] - 128) + 128;
          const avg = (data[i] + data[i+1] + data[i+2]) / 3;
          data[i] = avg;
          data[i+1] = avg;
          data[i+2] = avg;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function parseAddresses(rawText) {
  const stops = [];
  const stopWords = ['Deliver', 'Current stop', 'Scheduled', 'ITINERARY'];
  let lastKnownCity = 'Orlando';
  const pattern = /\((\d+)\)([\s\S]*?)(?=\(\d+\)|$)/g;
  let match;
  
  while ((match = pattern.exec(rawText)) !== null) {
    const stopNumber = parseInt(match[1]);
    const textBlock = match[2];
    const addressPattern = /(\d{3,5}\s[A-Z].*)/;
    const addressMatch = textBlock.match(addressPattern);
    
    if (addressMatch) {
      let street = addressMatch[1].trim();
      let city = '';
      const lines = textBlock.substring(textBlock.indexOf(street)).split('\n');
      
      if (lines.length > 1) {
        let nextLine = lines[1].trim();
        for (const word of stopWords) {
          if (nextLine.includes(word)) {
            nextLine = nextLine.substring(0, nextLine.indexOf(word)).trim();
          }
        }
        if (nextLine.length > 3) {
          city = nextLine;
          lastKnownCity = city;
        }
      }
      
      if (!city) {
        city = lastKnownCity;
      }
      
      stops.push({ number: stopNumber, address: `${street} ${city}`, isDowntown: false });
    }
  }
  return stops;
}

async function processJsonInput() {
  if (!jsonInput.value) {
    alert('Por favor, pega el JSON en el área de texto.');
    return;
  }

  isProcessing.value = true;
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const parsedData = JSON.parse(jsonInput.value);

    if (!Array.isArray(parsedData)) {
      throw new Error('El JSON debe ser un array de paradas.');
    }

    const mappedStops = parsedData.map(item => {
      const fullAddress = [
        item.street_address,
        item.apartment,
        item.city
      ].filter(Boolean).join(' ').trim();

      return {
        number: item.stop_number || 0,
        address: fullAddress,
        isDowntown: false
      };
    });

    resetAllInputs();
    extractedAddresses.value = mappedStops;
    
    console.log('Paradas cargadas desde JSON:', extractedAddresses.value);
  } catch (error) {
    console.error("Error procesando JSON:", error);
    alert(`Error al procesar el JSON: ${error.message}`);
    isProcessing.value = false;
  }
}

async function handleFileChange(event) {
  const files = event.target.files;
  if (!files || files.length === 0) {
    selectedFileNames.value = [];
    return;
  }
  selectedFileNames.value = Array.from(files).map(f => f.name);

  resetAllInputs();
  isProcessing.value = true;
  let allParsedStops = [];
  let maxStopNumber = 0;
  let minStopNumber = Infinity;

  try {
    for (const file of files) {
      console.log(`📸 Procesando: ${file.name}`);
      const processedImage = await preprocessImage(file);
      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng');
      console.log(`📄 Texto OCR:`, text);
      const stopsFromFile = parseAddresses(text);
      console.log(`📍 Paradas encontradas:`, stopsFromFile);
      allParsedStops.push(...stopsFromFile);
    }

    console.log('📦 Total paradas extraídas:', allParsedStops);

    const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));

    minStopNumber = Infinity;
    maxStopNumber = 0;
    uniqueStopsMap.forEach(stop => {
      if (stop.number > maxStopNumber) maxStopNumber = stop.number;
      if (stop.number < minStopNumber) minStopNumber = stop.number;
    });
    console.log(`📊 Rango: ${minStopNumber} - ${maxStopNumber}`);

    const fullListWithGaps = [];
    if (maxStopNumber > 0 && minStopNumber !== Infinity) {
      const loopStart = 2;
      console.log(`[DEBUG] Gap filling: ${loopStart} to ${maxStopNumber}`);

      for (let i = loopStart; i <= maxStopNumber; i++) {
        if (uniqueStopsMap.has(i)) {
          fullListWithGaps.push(uniqueStopsMap.get(i));
        } else {
          fullListWithGaps.push({ number: i, address: '', isDowntown: false });
        }
      }
    }

    console.log('[DEBUG] Lista final con gaps:', fullListWithGaps);
    extractedAddresses.value = fullListWithGaps;

  } catch (error) {
    console.error("Error processing images:", error);
    alert(`Error procesando imágenes: ${error.message || 'Error desconocido'}`);
  } finally {
    isProcessing.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

function startManualEntry() {
  extractedAddresses.value = [{ number: 2, address: '', isDowntown: false }];
}
*/

// ============================================
// FUNCIÓN PARA CALCULAR DELAY (aún se usa en advanced settings)
// ============================================

function calculateActualDelay() {
  try {
    const now = new Date();
    if (!blockData.value.hora) {
      alert("Please set the 'Start Time' first.");
      return;
    }
    
    const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
    const blockStartTime = new Date();
    blockStartTime.setHours(startHours, startMinutes, 0, 0);
    const diffMs = now.getTime() - blockStartTime.getTime();
    const actualDelayMinutes = Math.max(0, Math.round(diffMs / 60000));
    blockData.value.retraso_almacen = actualDelayMinutes;
    
    console.log(`⏱️ Calculated delay: ${actualDelayMinutes} minutes`);
    alert(`Calculated delay: ${actualDelayMinutes} minutes.`);
  } catch (e) {
    console.error("Error calculating delay:", e);
    alert(`Error: ${e.message}`);
  }
}

// ============================================
// COMPUTED PROPERTIES
// ============================================

const reportData = computed(() => {
  if (!backendResponse.value || !backendResponse.value.segments) {
    return null;
  }
  
  const { toFirstStop, segments, toFinalDestination, inverseRouteLegs } = backendResponse.value;
  let totalBlockMiles = 0;
  let totalBlockDriveDuration = 0;
  let totalBaseStopTime = 0;
  let totalExtraStopTime = 0;
  let totalApartmentCount = 0;
  let totalDowntownCount = 0;
  let totalStopCount = 0;
  
  const processedSegments = segments.map(seg => {
    let segmentBaseStopTime = 0;
    let segmentExtraStopTime = 0;
    let aptCount = 0;
    let downtownCount = 0;
    const currentStopCount = (seg.stops || []).length;
    totalStopCount += currentStopCount;
    
    (seg.stops || []).forEach(addr => {
      const stopData = extractedAddresses.value.find(s => s.address === addr);
      const isDowntown = stopData ? stopData.isDowntown : false;
// ✅ FIX: Usar stopData.isApartment como única fuente de verdad
      const isApartment = stopData ? stopData.isApartment : false;
      
      // ✅ NUEVO: No sumamos tiempo base aquí, se suma con multiplier en scenarioETAs
      // segmentBaseStopTime += 1.5;  ← ELIMINADO
      
      if (isDowntown) {
        downtownCount++;
        segmentExtraStopTime += 3;  // Downtown sigue siendo +3 min fijo
      } else if (isApartment) {
        aptCount++;
        segmentExtraStopTime += 0.75;  // ✅ NUEVO: Apartamentos +0.75 min
      }
    });
    
    // ✅ NUEVO: Solo acumulamos extras, NO el tiempo base
    // totalBaseStopTime += segmentBaseStopTime;  ← ELIMINADO
    totalExtraStopTime += segmentExtraStopTime;
    totalApartmentCount += aptCount + downtownCount;
    totalDowntownCount += downtownCount;
    totalBlockMiles += parseFloat(seg.distance || 0);
    totalBlockDriveDuration += parseFloat(seg.duration || 0);
    
    return {
      distance: seg.distance,
      duration: seg.duration,
      stopsCount: currentStopCount,
      aptCount: aptCount,
      downtownCount: downtownCount
    };
  });
  
  //const toFirstStopDist = parseFloat(toFirstStop.distance || 0);
  const toFirstStopDur = parseFloat(toFirstStop.duration || 0);
  const toFinalDestDist = parseFloat(toFinalDestination.distance || 0);
  const toFinalDestDur = parseFloat(toFinalDestination.duration || 0);
  const toLastStopDist = parseFloat(inverseRouteLegs.toLastStop.distance || 0);
  const toLastStopDur = parseFloat(inverseRouteLegs.toLastStop.duration || 0);
  const fromFirstStopDist = parseFloat(inverseRouteLegs.fromFirstStop.distance || 0);
  const fromFirstStopDur = parseFloat(inverseRouteLegs.fromFirstStop.duration || 0);
  
  // ═══════════════════════════════════════════════════════════════
  // 🆕 NUEVO CÓDIGO - PROCESAMIENTO DE SEGMENTOS INVERSOS
  // ═══════════════════════════════════════════════════════════════
  let inverseBlockMiles = 0;
  let inverseBlockDriveDuration = 0;
  let inverseProcessedSegments = [];
  
  if (inverseRouteLegs.segments && inverseRouteLegs.segments.length > 0) {
    inverseProcessedSegments = inverseRouteLegs.segments.map(seg => {
      let segmentBaseStopTime = 0;
      let segmentExtraStopTime = 0;
      let aptCount = 0;
      let downtownCount = 0;
      const currentStopCount = (seg.stops || []).length;
      
      (seg.stops || []).forEach(addr => {
        const stopData = extractedAddresses.value.find(s => s.address === addr);
        const isDowntown = stopData ? stopData.isDowntown : false;
        // ✅ FIX: Usar stopData.isApartment como única fuente de verdad
        const isApartment = stopData ? stopData.isApartment : false;
        
        // ✅ NUEVO: No sumamos tiempo base aquí
        // segmentBaseStopTime += 1.5;  ← ELIMINADO
        
        if (isDowntown) {
          downtownCount++;
          segmentExtraStopTime += 3;  // Downtown +3 min fijo
        } else if (isApartment) {
          aptCount++;
          segmentExtraStopTime += 0.75;  // ✅ NUEVO: Apartamentos +0.75 min
        }
      });
      
      const segDist = parseFloat(seg.distance || 0);
      const segDur = parseFloat(seg.duration || 0);
      inverseBlockMiles += segDist;
      inverseBlockDriveDuration += segDur;
      
      return {
        distance: seg.distance,
        duration: seg.duration,
        stopsCount: currentStopCount,
        aptCount: aptCount,
        downtownCount: downtownCount
      };
    });
  } else {
    // Fallback: usar segmentos normales (comportamiento antiguo)
    console.warn('⚠️ No se recibieron segmentos inversos del backend, usando segmentos normales');
    inverseBlockMiles = totalBlockMiles;
    inverseBlockDriveDuration = totalBlockDriveDuration;
    inverseProcessedSegments = processedSegments;
  }
  // ═══════════════════════════════════════════════════════════════
  // FIN NUEVO CÓDIGO
  // ═══════════════════════════════════════════════════════════════

  const toFirstStopDist = parseFloat(toFirstStop.distance || 0);

  const totalWorkMiles = toFirstStopDist + totalBlockMiles;
  // ✅ NUEVO: Solo sumamos totalExtraStopTime (apartamentos y downtown)
  // El tiempo base por parada se suma con multipliers en scenarioETAs
  const totalWorkDuration = toFirstStopDur + totalBlockDriveDuration + totalExtraStopTime;
  const totalNormalMiles = totalWorkMiles + toFinalDestDist;
  const totalNormalDuration = totalWorkDuration + toFinalDestDur;
  // 🆕 USAR SEGMENTOS INVERSOS REALES
  const totalInverseWorkMiles = toLastStopDist + inverseBlockMiles;
  const totalInverseWorkDuration = toLastStopDur + inverseBlockDriveDuration + totalExtraStopTime;
  const totalInverseMiles = totalInverseWorkMiles + fromFirstStopDist;
  const totalInverseDuration = totalInverseWorkDuration + fromFirstStopDur;
  
    // 🐛 DEBUG: Logs de detección
  console.log('═══════════════════════════════════════');
  console.log('📊 ARIA Debug - Detección de Paradas:');
  console.log('  🏠 Total paradas:', totalStopCount);
  console.log('  🏢 Apartamentos detectados:', totalApartmentCount);
  console.log('  🏙️ Downtown detectados:', totalDowntownCount);
  console.log('  ⏱️ Tiempo extra acumulado:', totalExtraStopTime.toFixed(1), 'min');
  console.log('  📐 Breakdown: ', totalApartmentCount - totalDowntownCount, 'apts × 0.75 +', totalDowntownCount, 'DT × 3');
  console.log('═══════════════════════════════════════');
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
      baseDriveDuration: toFirstStopDur + totalBlockDriveDuration + totalExtraStopTime, // ✅ Incluye extras
      commuteDuration: toFinalDestDur,
    },
    inverse: {
      toStart: { distance: toLastStopDist.toFixed(2), duration: Math.round(toLastStopDur) },
      segments: inverseProcessedSegments,
      toEnd: { distance: fromFirstStopDist.toFixed(2), duration: Math.round(fromFirstStopDur) },
      totalWorkMiles: totalInverseWorkMiles.toFixed(2),
      totalWorkDuration: Math.round(totalInverseWorkDuration),
      totalMiles: totalInverseMiles.toFixed(2),
      totalDuration: Math.round(totalInverseDuration),
      baseDriveDuration: toLastStopDur + inverseBlockDriveDuration + totalExtraStopTime, // ✅ Incluye extras
      commuteDuration: fromFirstStopDur,
    },
    stopCount: totalStopCount,
    apartmentCount: totalApartmentCount,
    downtownCount: totalDowntownCount,
  };
});

const scenarioETAs = computed(() => {
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
    // ✅ NUEVA LÓGICA:
    // - Tiempo base por parada: stopCount × multiplier minutos
    // - Apartamentos regulares: ya sumados en totalExtraStopTime como +0.75 min c/u
    // - Downtown: ya sumados en totalExtraStopTime como +3 min c/u
    
    const baseStopTime = stopCount * multiplier;
    
    // totalExtraStopTime ya viene calculado del reportData con los nuevos valores
    // (0.75 por apt regular, 3 por downtown)
    const routeDurationMinutes = (Number(baseDrive) || 0) 
                               + baseStopTime 
                               + (Number(commute) || 0);
    
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
  
  // 🤖 ARIA: Usar multiplier dinámico si está disponible, sino usar default
  const ariaMultiplier = ariaData.value?.multiplier || 0.9;
  const optimisticMultiplier = ariaMultiplier * 0.44; // ~45% del normal
  const pessimisticMultiplier = ariaMultiplier * 1.39; // ~140% del normal
  
  return {
    normal: {
      optimistic: calculateScenario(normalBaseDrive, normalCommute, optimisticMultiplier),
      normal: calculateScenario(normalBaseDrive, normalCommute, ariaMultiplier),
      pessimistic: calculateScenario(normalBaseDrive, normalCommute, pessimisticMultiplier)
    },
    inverse: {
      optimistic: calculateScenario(inverseBaseDrive, inverseCommute, optimisticMultiplier),
      normal: calculateScenario(inverseBaseDrive, inverseCommute, ariaMultiplier),
      pessimistic: calculateScenario(inverseBaseDrive, inverseCommute, pessimisticMultiplier)
    }
  };
});

const calculatedLogEntry = computed(() => {
  if (!extractedAddresses.value || !reportData.value || !scenarioETAs.value) {
    return null;
  }
  
  const data = blockData.value;
  const pago = Number(data.pago) || 0;
  const duracion_horas = Number(data.duracion_horas) || 0;
  const scenarioKey = selectedScenarioForLog.value;
  
  const chosenReport = reportData.value[scenarioKey];
  if (!chosenReport) {
    console.error(`Scenario "${scenarioKey}" not found`);
    return null;
  }
  
  const chosenETA = scenarioETAs.value[scenarioKey]?.normal;
  if (!chosenETA) {
    console.error(`ETA for scenario "${scenarioKey}" not found`);
    return null;
  }
  
const user_id = userId.value;

  let primary_city = null;
  if (extractedAddresses.value.length > 0) {
    const cityCounts = {};
    
    extractedAddresses.value.forEach(stop => {
      if (!stop.address) return;
      
      let addr = stop.address.toUpperCase();
      addr = addr.replace(/\b(APT|UNIT|#)\s*\d+[A-Z]?\b/gi, '');
      addr = addr.replace(/\b(FL|FLORIDA)\s*$/i, '');
      
      const parts = addr.trim().split(/\s+/);
      let potentialCity = null;
      
      if (parts.length >= 3) {
        // 🔧 FIX: Capturar las últimas 1-3 palabras que no sean números ni abreviaturas
        const cityWords = [];
        
        for (let i = parts.length - 1; i >= 0 && cityWords.length < 3; i--) {
          const word = parts[i];
          
          // Detener si encontramos números o abreviaturas de calle
          if (/^\d+$/.test(word) || 
              /^(ST|RD|AVE|BLVD|DR|LN|CT|WAY|PL|TER|CIR|LOOP|PKWY)$/i.test(word)) {
            break;
          }
          
          // Agregar palabras válidas (más de 2 caracteres)
          if (word.length > 2) {
            cityWords.unshift(word); // Agregar al inicio para mantener orden
          }
        }
        
        // Unir las palabras encontradas
        if (cityWords.length > 0) {
          potentialCity = cityWords.join(' ');
        }
      }
      
      if (potentialCity && potentialCity.length > 2) {
        cityCounts[potentialCity] = (cityCounts[potentialCity] || 0) + 1;
      }
    });
    
    let maxCount = 0;
    for (const city in cityCounts) {
      if (cityCounts[city] > maxCount) {
        maxCount = cityCounts[city];
        primary_city = city;
      }
    }
    
    if (primary_city) {
      primary_city = primary_city
        .split(' ')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    console.log("🏙️ Primary City:", primary_city, "Counts:", cityCounts);
  }
  
  const first_stop_distance = Number(chosenReport.toStart.distance) || 0;
  
  const antes_del_bloque_hrs = (Number(data.antes_del_bloque) || 0) / 60;
  let despues_del_bloque_hrs = 0;
  
  try {
    const [startHours, startMinutes] = data.hora.split(':').map(Number);
    const blockStart = new Date();
    blockStart.setHours(startHours, startMinutes, 0, 0);
    const durationMs = duracion_horas * 3600 * 1000;
    const blockEnd = new Date(blockStart.getTime() + durationMs);
    const etaString = chosenETA.eta;
    const [time, ampm] = etaString.split(' ');
    let [etaHours, etaMinutes] = time.split(':').map(Number);
    if (ampm.toUpperCase() === 'PM' && etaHours !== 12) etaHours += 12;
    if (ampm.toUpperCase() === 'AM' && etaHours === 12) etaHours = 0;
    const etaTime = new Date();
    etaTime.setHours(etaHours, etaMinutes, 0, 0);
    const diffMs = etaTime.getTime() - blockEnd.getTime();
    despues_del_bloque_hrs = diffMs / (3600 * 1000);
  } catch (e) {
    console.error("Error parsing time:", e);
  }
  
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
  
  return {
    fecha: data.fecha,
    block_id: route.query.blockId || null,  // ← AGREGAR ESTA LÍNEA
    vehicle_id: data.vehiculo,  // ← Ahora es UUID
    warehouse: selectedWarehouseCode.value,
    hora: data.hora,
    duracion_horas: duracion_horas,
    pago: pago,
    pago_por_hora: pago_por_hora.toFixed(2),
    antes_del_bloque: antes_del_bloque_hrs.toFixed(2),
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
    claim_por_milla: claim_por_milla.toFixed(2),
    user_id: user_id,
    primary_city: primary_city, first_stop: first_stop_distance.toFixed(2), numero_paradas: numero_paradas
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
    const response = await fetchWithAuth(`${backendUrl}/api/optimize-route`, {
      method: 'POST',
      body: JSON.stringify({ 
        addresses: fullRoute,
        finalDestination: selectedDestination.value === 'custom' 
          ? customDestination.value 
          : selectedDestination.value
      }),
    });
      const result = await response.json();
      
      // 🆕 ASIGNAR RESULTADO (CON O SIN ERRORES)
      backendResponse.value = result;
      
      // 🤖 ARIA: Capturar datos del sistema inteligente
      if (result.aria) {
        ariaData.value = result.aria;
        console.log('🤖 ARIA: Multiplier recibido:', result.aria.multiplier);
      }
      
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
    } finally {
      // ✅ Siempre limpiar isProcessing al terminar
      isProcessing.value = false;
    }
}

// Pega esto SOBREESCRIBIENDO tu función saveToLogbook() existente

// 🆕 MODIFICAR saveToLogbook para vincular con scheduled_block
async function saveToLogbook() {
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
    
    const dataToSend = { 
      ...calculatedLogEntry.value,
      route_score: routeScore.value.total,
      stops_json: extractedAddresses.value,
      eta_optimista: scenarioETAs.value[selectedScenarioForLog.value].optimistic.eta, 
      eta_normal: scenarioETAs.value[selectedScenarioForLog.value].normal.eta, 
      eta_pesimista: scenarioETAs.value[selectedScenarioForLog.value].pessimistic.eta,
      // 🤖 ARIA: Guardar multiplier usado
      multiplier_usado: ariaData.value?.multiplier || 0.9,
        // 🆕 Agregar destino final
      destination_address: selectedDestination.value === 'custom' 
      ? customDestination.value 
      : selectedDestination.value
    };

    try {
        // Guardar la ruta
        const response = await fetchWithAuth(`${backendUrl}/api/log-route`, {
            method: 'POST',
            body: JSON.stringify(dataToSend)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log("✅ Ruta guardada:", result.data[0].id);
            
            // 🆕 Si viene de un bloque agendado, vincularlo
            if (route.query.blockId) {
                console.log('🔗 Vinculando con bloque agendado:', route.query.blockId);
                
                try {
                    const linkResponse = await fetchWithAuth(
                        `${backendUrl}/api/scheduled-blocks/${route.query.blockId}/start`,
                        {
                            method: 'POST',
                            body: JSON.stringify({ routeId: result.data[0].id })
                        }
                    );
                    
                    const linkResult = await linkResponse.json();
                    
                    if (linkResult.success) {
                        console.log('✅ Bloque vinculado con ruta');
                    } else {
                        console.warn('⚠️ No se pudo vincular bloque:', linkResult.error);
                    }
                } catch (linkError) {
                    console.error('❌ Error vinculando bloque:', linkError);
                    // No fallar la operación principal por esto
                }
            }
            
            saveStatus.value = { 
                success: true, 
                message: `¡Guardado con Éxito! (ID: ${result.data[0].id})` 
            };
            
        } else { 
            throw new Error(result.message || 'Error desconocido del servidor.');
        }
    } catch (error) {
        console.error("❌ Error al guardar en bitácora:", error);
        saveStatus.value = { 
            success: false, 
            message: `Error: ${error.message}` 
        };
    } finally { 
        isSaving.value = false;
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
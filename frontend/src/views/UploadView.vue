<script setup>
// ============================================
// IMPORTS
// ============================================
import { computeScoreV5 } from '@/utils/scoring';
import { useRoute } from 'vue-router';
import SlideContainer from '@/components/RouteResults/SlideContainer.vue';
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
const showInputForm = ref(true);
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

const showQuickSettingsModal = ref(false); // 👈 Nuevo

watch(selectedWarehouseCode, (newCode) => {
  const warehouse = warehouses.value.find(w => w.code === newCode);
  if (warehouse) {
    blockData.value.commute_1_manual = warehouse.commuteMiles;
  }
});

// 👇 AGREGA ESTO EN TU SCRIPT (UploadView.vue) 👇

// 👁️ VIGILANTE: Si llega una respuesta válida del backend, oculta el formulario
watch(backendResponse, (newVal) => {
  if (newVal && !newVal.hasErrors && newVal.status !== 'loading') {
    console.log("✅ Resultados recibidos. Activando Modo Foco.");
    showInputForm.value = false;
    
    // Scroll suave hacia arriba para ver los slides
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 300);
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
  // Al final, si todo salió bien y tenemos resultados:
  if (!backendResponse.value?.hasErrors) {
  console.log("✅ Evaluación exitosa, activando Modo Foco");
      showInputForm.value = false; // 🙈 Oculta el formulario
      
      // Opcional: Scroll suave hacia arriba
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
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

// En UploadView.vue

// EN UploadView.vue -> Reemplaza todo el bloque 'const reportData = computed(...)'

const reportData = computed(() => {
  // 1. Protección inicial
  if (!backendResponse.value || !backendResponse.value.segments) return null;
  
  // ⚠️ NOTA: Ya no desestructuramos 'inverseRouteLegs' porque no existe en el nuevo backend
  const { toFirstStop, segments, toFinalDestination, aiRoute, isAiOptimized } = backendResponse.value;
  
  // --- A. PROCESAR RUTA NORMAL ---
  let totalBlockMiles = 0;
  let totalBlockDriveDuration = 0;
  let totalExtraStopTime = 0; 
  let totalStopCount = 0;
  let totalApartmentCount = 0;
  let totalDowntownCount = 0;

  const processedSegments = segments.map(seg => {
    let segmentExtraStopTime = 0;
    let aptCount = 0;
    let downtownCount = 0;
    const currentStopCount = (seg.stops || []).length;
    totalStopCount += currentStopCount;
    
    (seg.stops || []).forEach(addr => {
      const stopData = extractedAddresses.value.find(s => s.address === addr);
      // Validación segura (Optional Chaining)
      const isDowntown = stopData?.isDowntown || false;
      const isApartment = stopData?.isApartment || false;
      
      if (isDowntown) { downtownCount++; segmentExtraStopTime += 3; } 
      else if (isApartment) { aptCount++; segmentExtraStopTime += 0.75; }
    });
    
    totalExtraStopTime += segmentExtraStopTime;
    totalApartmentCount += aptCount + downtownCount;
    totalDowntownCount += downtownCount;
    totalBlockMiles += parseFloat(seg.distance || 0);
    totalBlockDriveDuration += parseFloat(seg.duration || 0);
    
    return {
      distance: seg.distance,
      duration: seg.duration,
      stopsCount: currentStopCount,
      aptCount, downtownCount
    };
  });
  
  const totalWorkMiles = parseFloat(toFirstStop.distance || 0) + totalBlockMiles;
  const totalWorkDuration = parseFloat(toFirstStop.duration || 0) + totalBlockDriveDuration + totalExtraStopTime;
  const totalNormalMiles = totalWorkMiles + parseFloat(toFinalDestination.distance || 0);
  const totalNormalDuration = totalWorkDuration + parseFloat(toFinalDestination.duration || 0);
  
  // --- B. GENERAR SECUENCIA NORMAL (BLINDADA) ---
  const normalSequenceStr = [...extractedAddresses.value]
    .sort((a,b) => Number(a.number) - Number(b.number))
    .map(s => s.number)
    .join('-');

  // --- C. PROCESAR RUTA IA (Nueva Lógica) ---
  let aiData = null;
  let aiMessage = "La IA no encontró una mejora significativa.";

  // Solo procesamos si el backend mandó aiRoute
  if (isAiOptimized && aiRoute) {
      let aiBlockMiles = 0;
      let aiBlockDuration = 0;

      const aiProcessedSegments = aiRoute.segments.map(seg => {
          aiBlockMiles += parseFloat(seg.distance || 0);
          aiBlockDuration += parseFloat(seg.duration || 0);
          return { distance: seg.distance, duration: seg.duration, stopsCount: (seg.stops || []).length };
      });

      const totalAiWorkMiles = parseFloat(aiRoute.toStart.distance || 0) + aiBlockMiles;
      const totalAiWorkDuration = parseFloat(aiRoute.toStart.duration || 0) + aiBlockDuration + totalExtraStopTime;
      
      const totalAiMiles = totalAiWorkMiles + parseFloat(aiRoute.toEnd.distance || 0);
      const totalAiDuration = totalAiWorkDuration + parseFloat(aiRoute.toEnd.duration || 0);

      // Juez del 5%
      const diffMiles = totalNormalMiles - totalAiMiles;
      const diffTime = totalNormalDuration - totalAiDuration;
      const pctMiles = totalNormalMiles > 0 ? (diffMiles / totalNormalMiles) : 0;
      const pctTime = totalNormalDuration > 0 ? (diffTime / totalNormalDuration) : 0;
      const UMBRAL = 0.05; 

      if ((pctMiles >= UMBRAL) || (pctTime >= UMBRAL)) {
          aiMessage = `¡Ahorro! ${diffMiles.toFixed(1)} mi / ${Math.round(diffTime)} min.`;
          
          const aiSequenceStr = [...extractedAddresses.value]
            .sort((a,b) => {
                const valA = a.ia_suggestion ?? a.number;
                const valB = b.ia_suggestion ?? b.number;
                return Number(valA) - Number(valB);
            })
            .map(s => s.number)
            .join('-');

          aiData = {
              toStart: { distance: parseFloat(aiRoute.toStart.distance).toFixed(2), duration: Math.round(parseFloat(aiRoute.toStart.duration)) },
              segments: aiProcessedSegments,
              toEnd: { distance: parseFloat(aiRoute.toEnd.distance).toFixed(2), duration: Math.round(parseFloat(aiRoute.toEnd.duration)) },
              totalWorkMiles: totalAiWorkMiles.toFixed(2),
              totalWorkDuration: Math.round(totalAiWorkDuration),
              totalMiles: totalAiMiles.toFixed(2),
              totalDuration: Math.round(totalAiDuration),
              baseDriveDuration: parseFloat(aiRoute.toStart.duration) + aiBlockDuration + totalExtraStopTime,
              commuteDuration: parseFloat(aiRoute.toEnd.duration),
              label: '🤖 AI ROUTE',
              sequence: aiSequenceStr
          };
      }
  }

  // --- RETORNO FINAL ---
  return {
    savings: aiData ? (totalNormalMiles - aiData.totalMiles).toFixed(2) : '0.00',
    aiMessage: aiMessage,
    
    stopCount: totalStopCount,
    apartmentCount: totalApartmentCount,
    downtownCount: totalDowntownCount,

    normal: {
      toStart: { distance: toFirstStopDist.toFixed(2), duration: Math.round(toFirstStopDur) },
      segments: processedSegments,
      toEnd: { distance: toFinalDestDist.toFixed(2), duration: Math.round(toFinalDestDur) },
      totalWorkMiles: totalWorkMiles.toFixed(2),
      totalWorkDuration: Math.round(totalWorkDuration),
      totalMiles: totalNormalMiles.toFixed(2),
      totalDuration: Math.round(totalNormalDuration),
      baseDriveDuration: parseFloat(toFirstStop.duration) + totalBlockDriveDuration + totalExtraStopTime,
      commuteDuration: toFinalDestDur,
      sequence: normalSequenceStr
    },
    
    // Si no hay IA, esto es null y SlideContainer lo oculta
    inverse: aiData 
  };
});

// En UploadView.vue

const scenarioETAs = computed(() => {
  // 1. Validaciones de seguridad básicas
  if (!reportData.value?.normal || !blockData.value?.hora || blockData.value.retraso_almacen === undefined) {
    return null;
  }
  
  const stopCount = Number(reportData.value.stopCount) || 0;
  
  const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
  const blockStartTime = new Date();
  blockStartTime.setHours(startHours, startMinutes, 0, 0);
  const prepTimeMinutes = Number(blockData.value.retraso_almacen) || 0;
  const estimatedDepartureTime = new Date(blockStartTime.getTime() + prepTimeMinutes * 60000);
  
  // Helper para calcular tiempos
  const calculateScenario = (baseDrive, commute, multiplier) => {
    const baseStopTime = stopCount * multiplier;
    // La duración base ya incluye los extras de apartamentos/downtown
    const routeDurationMinutes = (Number(baseDrive) || 0) + baseStopTime + (Number(commute) || 0);
    
    if (isNaN(routeDurationMinutes)) return { totalDuration: 'N/A', eta: 'Error' };
    
    const eta = new Date(estimatedDepartureTime.getTime() + routeDurationMinutes * 60000);
    return {
      totalDuration: Math.round(routeDurationMinutes),
      eta: eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };
  };
  
  const ariaMultiplier = ariaData.value?.multiplier || 0.9;
  const optimisticMultiplier = ariaMultiplier * 0.44; 
  const pessimisticMultiplier = ariaMultiplier * 1.39; 
  
  // --- CÁLCULO NORMAL (Siempre existe) ---
  const normalBaseDrive = reportData.value.normal.baseDriveDuration;
  const normalCommute = reportData.value.normal.commuteDuration;

  const normalScenarios = {
      optimistic: calculateScenario(normalBaseDrive, normalCommute, optimisticMultiplier),
      normal: calculateScenario(normalBaseDrive, normalCommute, ariaMultiplier),
      pessimistic: calculateScenario(normalBaseDrive, normalCommute, pessimisticMultiplier)
  };

  // --- CÁLCULO INVERSO/IA (Protegido) ---
  // 🔥 AQUÍ ESTABA EL ERROR: Antes intentaba leer .inverse directamente 🔥
  let inverseScenarios = null;

  if (reportData.value.inverse) {
      const inverseBaseDrive = reportData.value.inverse.baseDriveDuration;
      const inverseCommute = reportData.value.inverse.commuteDuration;
      
      inverseScenarios = {
          optimistic: calculateScenario(inverseBaseDrive, inverseCommute, optimisticMultiplier),
          normal: calculateScenario(inverseBaseDrive, inverseCommute, ariaMultiplier),
          pessimistic: calculateScenario(inverseBaseDrive, inverseCommute, pessimisticMultiplier)
      };
  }

  return {
    normal: normalScenarios,
    inverse: inverseScenarios // Puede ser null y no pasa nada
  };
});
// ============================================
// 🧠 NUEVA LÓGICA: GENERADOR DE PAYLOADS
// ============================================

// 1. Función Helper que hace los cálculos matemáticos (Reutilizable)
// EN UploadView.vue

function calculateLogData(scenarioKey) {
  // 1. Validaciones de seguridad
  if (!extractedAddresses.value || !reportData.value || !scenarioETAs.value) {
    return null;
  }
  const chosenReport = reportData.value[scenarioKey];
  const chosenETA = scenarioETAs.value[scenarioKey]?.normal;
  
  if (!chosenReport || !chosenETA) return null;

  // 2. Datos básicos
  const data = blockData.value;
  const pago = Number(data.pago) || 0;
  const duracion_horas = Number(data.duracion_horas) || 0;
  const user_id = userId.value;

  // 3. Lógica de Ciudad Principal
  let primary_city = null;
  if (extractedAddresses.value.length > 0) {
    const cityCounts = {};
    extractedAddresses.value.forEach(stop => {
      if (!stop.address) return;
      let addr = stop.address.toUpperCase();
      addr = addr.replace(/\b(APT|UNIT|#)\s*\d+[A-Z]?\b/gi, '').replace(/\b(FL|FLORIDA)\s*$/i, '');
      const parts = addr.trim().split(/\s+/);
      let potentialCity = null;
      if (parts.length >= 3) {
         const cityWords = [];
         for (let i = parts.length - 1; i >= 0 && cityWords.length < 3; i--) {
           const word = parts[i];
           if (/^\d+$/.test(word) || /^(ST|RD|AVE|BLVD|DR|LN|CT|WAY|PL|TER|CIR|LOOP|PKWY)$/i.test(word)) break;
           if (word.length > 2) cityWords.unshift(word);
         }
         if (cityWords.length > 0) potentialCity = cityWords.join(' ');
      }
      if (potentialCity && potentialCity.length > 2) cityCounts[potentialCity] = (cityCounts[potentialCity] || 0) + 1;
    });
    let maxCount = 0;
    for (const city in cityCounts) {
      if (cityCounts[city] > maxCount) { maxCount = cityCounts[city]; primary_city = city; }
    }
    if (primary_city) {
      primary_city = primary_city.split(' ').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
    }
  }

  // 4. Cálculos Financieros
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
  } catch (e) { console.error("Error parsing time:", e); }

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

  // 5. 🤖 DATOS NUEVOS (ARIA + CÁLCULOS)
  const mult = ariaData.value?.multiplier || 0.9;
  // Calcular apartamentos regulares (Total - Downtown)
  const totalAptsInReport = reportData.value.apartmentCount || 0;
  const totalDtInReport = reportData.value.downtownCount || 0;
  const regularApts = Math.max(0, totalAptsInReport - totalDtInReport);
  
  // Texto de cálculo matemático
  const calcText = `${numero_paradas} stops × ${mult.toFixed(2)} + ${regularApts} apts × 0.75 + ${totalDtInReport} DT × 3`;

  // 📐 CÁLCULO DE TRAMOS REALES
  // 1. Ida: Almacén -> Primera Parada (Datos crudos de Google)
  const leg1_dist = parseFloat(chosenReport.toStart.distance) || 0;
  const leg1_time = Math.round(parseFloat(chosenReport.toStart.duration) || 0);

  // 2. Ejecución: Primera -> Última (Manejo interno + Tiempo en paradas)
  // totalWorkDuration ya incluye: Manejo Total + Extras por Apts/DT
  // Le restamos la ida (leg1) y le sumamos el tiempo base por parada (ARIA)
  const work_drive_plus_extras = chosenReport.totalWorkDuration - leg1_time;
  const work_base_stop_time = numero_paradas * mult;
  const leg2_time = Math.round(work_drive_plus_extras + work_base_stop_time);
  
  const leg2_dist = parseFloat(chosenReport.totalWorkMiles) - leg1_dist;

  // 3. Retorno: Última -> Casa (Datos crudos de Google)
  const leg3_dist = parseFloat(chosenReport.toEnd.distance) || 0;
  const leg3_time = Math.round(parseFloat(chosenReport.toEnd.duration) || 0);

  return {
    fecha: data.fecha,
    block_id: route.query.blockId || null,
    vehicle_id: data.vehiculo,
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
    primary_city: primary_city, 
    first_stop: first_stop_distance.toFixed(2), 
    numero_paradas: numero_paradas,
    
    // ETAs
    eta_optimista: scenarioETAs.value[scenarioKey].optimistic.eta,
    eta_normal: chosenETA.eta,
    eta_pesimista: scenarioETAs.value[scenarioKey].pessimistic.eta,
    
    // NUEVOS CAMPOS PARA EL SLIDE
    apartment_count: regularApts, // Solo regulares
    downtown_count: totalDtInReport,
    aria_multiplier: mult,
    calculation_text: calcText,
    segments: chosenReport.segments || [],

    // 👇👇👇 NUEVOS DATOS TÁCTICOS 👇👇👇
    tactical: {
      leg1: { dist: leg1_dist.toFixed(1), time: leg1_time }, // To 1st Stop
      leg2: { dist: leg2_dist.toFixed(1), time: leg2_time }, // The Route
      leg3: { dist: leg3_dist.toFixed(1), time: leg3_time }  // To Home
    }
    // 👆👆👆
  };
}

// 2. Payload para Escenario NORMAL (Incluye Score)
const normalPayload = computed(() => {
  const baseData = calculateLogData('normal');
  if (!baseData) return {};
  
  const scoreResult = computeScoreV5(baseData);
  const mensaje = obtenerMensajeConsciente(scoreResult.total);

  return {
    ...baseData,
    route_score: scoreResult.total,
    mensaje,
    icon: getIconForScore(scoreResult.total),
    color: getColorForScore(scoreResult.total),
    categoria: mensaje.categoria,
    redFlags: scoreResult.redFlags || []
  };
});

// 3. Payload para Escenario INVERSO (Incluye Score)
const inversePayload = computed(() => {
  const baseData = calculateLogData('inverse');
  if (!baseData) return null;

  const scoreResult = computeScoreV5(baseData);
  const mensaje = obtenerMensajeConsciente(scoreResult.total);

  return {
    ...baseData,
    route_score: scoreResult.total,
    mensaje,
    icon: getIconForScore(scoreResult.total),
    color: getColorForScore(scoreResult.total),
    categoria: mensaje.categoria,
    redFlags: scoreResult.redFlags || []
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

function startManualEntry() {
  console.log('Starting manual entry...');
  resetAllInputs(); // Limpia todo (archivos, JSON, etc.)
  showInputForm.value = true;
  
  // Inicia con una parada vacía
  extractedAddresses.value = [{ number: 2, address: '', isDowntown: false }];
}

// En UploadView.vue

// En UploadView.vue

async function sendToBackend() {
    // 1. Preparar Ruta Normal (Siempre ordenada por stop_number)
    const sortedByAmazon = [...extractedAddresses.value].sort((a, b) => Number(a.number) - Number(b.number));
    const addressesToSend = sortedByAmazon.map(stop => stop.address);
    const sanitizedAddresses = addressesToSend.map(sanitizeAddress).filter(addr => addr && addr.trim() !== '');
    
    if (sanitizedAddresses.length === 0) { alert('No valid addresses.'); return; }

    const warehouse = warehouses.value.find(w => w.code === selectedWarehouseCode.value);
    const fullRouteAmazon = [sanitizeAddress(warehouse.address), ...sanitizedAddresses, sanitizeAddress(selectedDestination.value)];

    // 2. 🔍 COMPARACIÓN INICIAL (Caso A vs Caso B)
    let aiOptimizedStops = null;
    
    // Usamos Number() en AMBOS lados para que "20" sea igual a 20.
        const hasDifference = extractedAddresses.value.some(stop => {
        // Si ia_suggestion viene en el JSON, úsalo. Si no, usa el número original.
        const suggestion = (stop.ia_suggestion !== undefined && stop.ia_suggestion !== null) 
             ? stop.ia_suggestion 
             : stop.number;
             
        return Number(stop.number) !== Number(suggestion);
    });

    if (hasDifference) {
        console.log("⚡ Diferencia detectada (IA activa)...");
        // Ordenamos por la sugerencia de la IA
        const sortedByAI = [...extractedAddresses.value].sort((a, b) => Number(a.ia_suggestion) - Number(b.ia_suggestion));
        // Extraemos solo las direcciones
        aiOptimizedStops = sortedByAI.map(stop => stop.address).map(sanitizeAddress).filter(Boolean);
    } else {
        console.log("💤 Rutas idénticas (IA inactiva).");
    }

    // 3. Enviar al Backend
    backendResponse.value = { status: 'loading' };
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    try {
        const response = await fetchWithAuth(`${backendUrl}/api/optimize-route`, {
            method: 'POST',
            body: JSON.stringify({ 
                addresses: fullRouteAmazon,
                aiOptimizedAddresses: aiOptimizedStops, // Será null en Caso A
                finalDestination: selectedDestination.value === 'custom' ? customDestination.value : selectedDestination.value,
                startTime: blockData.value.hora,
                warehouseDelay: blockData.value.retraso_almacen,
                currentDate: blockData.value.fecha
            }),
        });
        
        const result = await response.json();
        
        backendResponse.value = result;
        if (result.aria) ariaData.value = result.aria;
        
        if (result.hasErrors) {
            // Manejo de errores visual...
            setTimeout(() => {
                const errorSection = document.querySelector('.address-errors');
                if (errorSection) errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

    } catch (error) {
        console.error("Error:", error);
        // IMPORTANTE: Asegúrate de que esto muestre algo en pantalla
        alert(`Ocurrió un error: ${error.message}`); 
        backendResponse.value = { error: error.message, hasErrors: true };
    } finally {
        isProcessing.value = false; // 👈 CRÍTICO: Si esto no ocurre, el botón se queda girando.
    }
}

async function saveToLogbook(payloadDirecto) {
    // Si viene del evento del slide, usamos ese payload. Si no, fallback (seguridad).
    const dataToSave = payloadDirecto || normalPayload.value; 

    if (backendResponse.value?.hasErrors) {
        alert("❌ No puedes guardar la ruta porque hay direcciones inválidas.");
        return;
    }
    
    if (!dataToSave || !dataToSave.pago) { 
        alert("No hay datos calculados para guardar.");
        return; 
    }
    
    isSaving.value = true; 
    saveStatus.value = null;
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    
    // Preparamos el objeto final mezclando el payload calculado con metadatos extra
    const finalBody = { 
      ...dataToSave,
      stops_json: extractedAddresses.value,
      multiplier_usado: ariaData.value?.multiplier || 0.9,
      destination_address: selectedDestination.value === 'custom' 
        ? customDestination.value 
        : selectedDestination.value
    };

    try {
        const response = await fetchWithAuth(`${backendUrl}/api/log-route`, {
            method: 'POST',
            body: JSON.stringify(finalBody)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log("✅ Ruta guardada:", result.data[0].id);
            
            if (route.query.blockId) {
                try {
                    await fetchWithAuth(
                        `${backendUrl}/api/scheduled-blocks/${route.query.blockId}/start`,
                        {
                            method: 'POST',
                            body: JSON.stringify({ routeId: result.data[0].id })
                        }
                    );
                } catch (linkError) {
                    console.error('❌ Error vinculando bloque:', linkError);
                }
            }
            
            saveStatus.value = { 
                success: true, 
                message: `¡Guardado con Éxito! (ID: ${result.data[0].id})` 
            };
            alert("✅ ¡Ruta guardada exitosamente en la bitácora!"); // Feedback visual rápido
            
        } else { 
            throw new Error(result.message || 'Error desconocido del servidor.');
        }
    } catch (error) {
        console.error("❌ Error al guardar:", error);
        saveStatus.value = { success: false, message: `Error: ${error.message}` };
        alert(`Error al guardar: ${error.message}`);
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
  <div class="view-container">
    <div class="uploader-container">

      <transition name="fade-slide">
        <div v-show="showInputForm" class="input-section-wrapper">

          <div class="block-info-card">
            <h2>📦 Block Details</h2>
            <div class="block-info-grid">
              <div class="info-item">
                <span class="info-label">Warehouse</span>
                <span class="info-value">{{ selectedWarehouseCode }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date</span>
                <span class="info-value">{{ blockData.fecha }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Start Time</span>
                <span class="info-value">{{ blockData.hora }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Duration</span>
                <span class="info-value">{{ blockData.duracion_horas }}h</span>
              </div>
              <div class="info-item">
                <span class="info-label">Payment</span>
                <span class="info-value">${{ blockData.pago }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Vehicle</span>
                <span class="info-value">{{ getVehicleNickname(blockData.vehiculo) }}</span>
              </div>
            </div>
          </div>

          <div class="route-config-card">
            <h3>🎯 Route Configuration</h3>
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
          </div>

          <div class="gem-link-container">
            <a 
              href="https://gemini.google.com/gem/11PCFo5tGT1kWc0fd9PvoPz6uQryQUzTu?usp=sharing" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="gem-link"
            >
              🤖 Open Gem to Process Screenshots
            </a>
            <p class="gem-hint">Upload your route screenshots to the Gem, then paste the JSON below</p>
          </div>

          <div class="json-input-card">
            <h3>📋 Paste Route JSON</h3>
            <textarea 
              v-model="jsonInput" 
              placeholder='Paste the JSON from the Gem here.'
              rows="10"
              class="json-textarea"
              :disabled="isProcessing || extractedAddresses.length > 0"
            ></textarea>

            <div v-if="extractedAddresses.length > 0" class="stops-detected">
              ✅ {{ extractedAddresses.length }} stops detected
            </div>

            <transition name="modal-fade">
              <div v-if="showDowntownModal" class="modal-overlay" @click.self="skipDowntownSelection">
                <div class="modal-container downtown-modal">
                  <div class="modal-header">
                    <h3>🏢 Downtown Apartments Detected</h3>
                    <p class="modal-subtitle">
                      Found {{ orlandoApartments.length }} apartment(s) in Orlando. 
                      Select which ones are downtown (adds +3 min per stop).
                    </p>
                  </div>
                  
                  <div class="modal-body">
                    <div class="apartment-list">
                      <label v-for="apt in orlandoApartments" :key="apt.number" class="apartment-item">
                        <input type="checkbox" v-model="downtownSelection[apt.number]" class="downtown-checkbox-modal">
                        <div class="apartment-info">
                          <span class="apt-number">Stop #{{ apt.number }}</span>
                          <span class="apt-address">{{ apt.address }}</span>
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  <div class="modal-footer">
                    <button @click="skipDowntownSelection" class="button-secondary">⏭️ No Downtown Apartments</button>
                    <button @click="confirmDowntownSelection" class="button-primary">✅ Confirm Selection</button>
                  </div>
                </div>
              </div>
            </transition>

            <button 
              @click="evaluateRoute" 
              class="button-primary button-evaluate"
              :disabled="isProcessing || (!jsonInput.trim() && extractedAddresses.length === 0)"
            >
              {{ isProcessing ? 'Evaluating...' : '🚀 Evaluate Scenarios' }}
            </button>
          </div>

          <div class="additional-settings">
            <details>
              <summary>⚙️ Advanced Settings (optional)</summary>
              <div class="form-row">
                <div class="form-group">
                  <label>Time Before Block (min)</label>
                  <input type="number" v-model.number="blockData.antes_del_bloque" step="5">
                </div>
                <div class="form-group">
                  <label>Commute 1 (Miles)</label>
                  <input type="number" v-model.number="blockData.commute_1_manual" step="0.1">
                </div>
                <div class="form-group">
                  <label class="label-with-button">
                    <span>Warehouse Delay (min)</span>
                    <button @click.prevent="calculateActualDelay" class="button-tertiary">Now</button>
                  </label>
                  <input type="number" v-model.number="blockData.retraso_almacen" step="5">
                </div>
              </div>
            </details>
          </div>

        </div>
      </transition>
      <div v-if="!showInputForm && reportData" class="edit-bar">
        <div class="edit-bar-left">
          <button @click="showQuickSettingsModal = true" class="btn-edit-inputs">
            ✏️ Edit Parameters
          </button>
        </div>
        <div class="mini-summary">
          <span>📦 {{ extractedAddresses.length }} stops</span>
          <span class="separator">•</span>
          <span>📅 {{ blockData.hora }} Start</span>
          <span class="separator">•</span>
          <span>💰 ${{ blockData.pago }}</span>
        </div>
      </div>

      <transition name="modal-fade">
        <div v-if="showQuickSettingsModal" class="modal-overlay" @click.self="showQuickSettingsModal = false">
          <div class="modal-container quick-settings-modal">
            <div class="modal-header">
              <h3>⚙️ Quick Adjustments</h3>
              <button @click="showQuickSettingsModal = false" class="close-btn">✕</button>
            </div>
            
            <div class="modal-body">
              <div class="form-group">
                <label class="label-with-button">
                  <span>🏢 Warehouse Delay (min)</span>
                  <button @click.prevent="calculateActualDelay" class="button-tertiary">Now</button>
                </label>
                <input type="number" v-model.number="blockData.retraso_almacen" step="5" class="input-lg">
                <p class="hint">Time spent waiting at station.</p>
              </div>

              <hr class="divider">

              <div class="form-group">
                <label>🚗 Time Before Block (min)</label>
                <input type="number" v-model.number="blockData.antes_del_bloque" step="5" class="input-lg">
              </div>

              <div class="form-group">
                <label>🏠 Commute to Station (miles)</label>
                <input type="number" v-model.number="blockData.commute_1_manual" step="0.1" class="input-lg">
              </div>
            </div>
            
            <div class="modal-footer">
              <button @click="showQuickSettingsModal = false" class="button-primary w-full">
                ✅ Apply & Close
              </button>
            </div>
          </div>
        </div>
      </transition>

      <div v-if="isProcessing" class="status"><h3>Evaluating route scenarios...</h3></div>
      <div v-if="backendResponse && backendResponse.status === 'loading'" class="backend-status">Evaluating scenarios...</div>

      <div v-if="extractedAddresses.length > 0 && backendResponse && !isProcessing && reportData && normalPayload.pago">
        
        <div class="results-container-slides">
          <div class="results-header" style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <h3>📊 Route Analysis</h3>
            <button 
              @click="mostrarDetalles = !mostrarDetalles" 
              class="text-xs text-gray-500 underline"
            >
              {{ mostrarDetalles ? 'Hide Debug' : 'Show Debug' }}
            </button>
          </div>

          <SlideContainer 
            :normalPayload="normalPayload"
            :inversePayload="inversePayload"
            @save-route="saveToLogbook"
          />

          <div v-if="mostrarDetalles" class="mt-4 p-4 bg-black text-xs font-mono text-green-400 overflow-auto h-40" style="margin-top: 20px; padding:15px; background:#000; color:#0f0;">
            <p>DEBUG DATA:</p>
            <pre>{{ normalPayload }}</pre>
          </div>
        </div>

        <div v-if="backendResponse?.hasErrors && backendResponse?.failedAddresses" class="address-errors">
          <h3>⚠️ Advertencia: Direcciones No Encontradas</h3>
          <div class="error-list">
            <div v-for="(failed, index) in backendResponse.failedAddresses" :key="index" class="error-item">
              <div class="error-header">
                <strong>{{ failed.type }}</strong>
              </div>
              <div class="error-details">
                <p>{{ failed.from }} ➝ {{ failed.to }}</p>
                <p class="error-type"><span class="error-badge">{{ failed.errorType }}</span></p>
              </div>
            </div>
          </div>
          <div class="error-actions">
            <p>✏️ Por favor, corrige las direcciones y evalúa de nuevo.</p>
          </div>
        </div>

      </div>
      
    </div>
  </div>
</template>
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

/* ========================================
   NUEVOS ESTILOS - DISEÑO SIMPLIFICADO v4.2
   ======================================== */

/* Block Info Card */
.block-info-card {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-card);
}

.block-info-card h2 {
  margin: 0 0 var(--space-4) 0;
  color: var(--brand-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
}

.block-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: var(--font-semibold);
}

.info-value {
  font-size: var(--text-lg);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

/* Gem Link Container */
.gem-link-container {
  background-color: var(--info-bg);
  border: 2px solid var(--info);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
  text-align: center;
}

.gem-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background-color: var(--brand-primary);
  color: white;
  text-decoration: none;
  border-radius: var(--radius-base);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
}

.gem-link:hover {
  background-color: var(--brand-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.gem-hint {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* JSON Input Card */
.json-input-card {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-card);
}

.json-input-card h3 {
  margin: 0 0 var(--space-4) 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.json-textarea {
  width: 100%;
  min-height: 200px;
  padding: var(--space-4);
  font-family: 'Courier New', monospace;
  font-size: var(--text-sm);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-base);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-xs);
}

.json-textarea:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), var(--shadow-sm);
  outline: none;
}

.json-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--bg-tertiary);
}

.stops-detected {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background-color: var(--success-bg);
  border: 1px solid var(--success);
  border-radius: var(--radius-base);
  color: var(--success);
  font-weight: var(--font-semibold);
  text-align: center;
}

.button-evaluate {
  width: 100%;
  margin-top: var(--space-4);
  padding: var(--space-4);
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  box-shadow: var(--shadow-lg);
}

.button-evaluate:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

/* Route Config Card */
.route-config-card {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  margin-bottom: var(--space-4);
  box-shadow: var(--shadow-card);
}

.route-config-card h3 {
  margin: 0 0 var(--space-4) 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

/* Additional Settings (collapsible) */
.additional-settings {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-card);
}

.additional-settings details {
  cursor: pointer;
}

.additional-settings summary {
  padding: var(--space-3);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  list-style: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  user-select: none;
}

.additional-settings summary:hover {
  color: var(--brand-primary);
}

.additional-settings summary::-webkit-details-marker {
  display: none;
}

.additional-settings summary::before {
  content: '▶';
  font-size: var(--text-xs);
  transition: transform var(--transition-fast);
}

.additional-settings details[open] summary::before {
  transform: rotate(90deg);
}

.additional-settings .form-row {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-secondary);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .block-info-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .button-evaluate {
    font-size: var(--text-base);
    padding: var(--space-3);
  }
}

/* ========================================
   MODAL DE DOWNTOWN - FIXED
   ======================================== */

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85); /* Más oscuro */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* Más alto */
  padding: 20px;
  backdrop-filter: blur(4px); /* Efecto blur */
}

.modal-container {
  background-color: var(--color-surface);
  border: 2px solid var(--color-border); /* Borde más visible */
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  animation: slideUp 0.3s ease;
  position: relative;
  z-index: 10000; /* Asegurar que esté encima */
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 25px;
  border-bottom: 2px solid var(--color-border);
  background-color: var(--color-background); /* Fondo más oscuro */
}

.modal-header h3 {
  margin: 0 0 10px 0;
  color: var(--color-primary);
  font-size: 1.4em;
  font-weight: 700;
}

.modal-subtitle {
  margin: 0;
  color: var(--color-text-primary); /* Más visible */
  font-size: 0.95em;
  line-height: 1.5;
}

.modal-body {
  padding: 20px 25px;
  overflow-y: auto;
  flex: 1;
  background-color: var(--color-surface); /* Asegurar fondo */
}

.apartment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.apartment-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background-color: var(--color-background); /* Más oscuro */
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.apartment-item:hover {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: var(--color-primary);
  transform: translateX(5px);
}

.downtown-checkbox-modal {
  appearance: none;
  width: 24px;
  height: 24px;
  min-width: 24px;
  border: 2px solid var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  background-color: var(--color-surface);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.downtown-checkbox-modal:hover {
  border-color: var(--color-primary);
}

.downtown-checkbox-modal:checked {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.downtown-checkbox-modal:checked::after {
  content: '✓';
  color: white;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: bold;
}

.apartment-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0; /* Permite que el texto se corte */
}

.apt-number {
  font-weight: bold;
  color: var(--color-accent);
  font-size: 1em;
}

.apt-address {
  color: var(--color-text-primary);
  font-size: 0.95em;
  word-break: break-word; /* Permite que direcciones largas se partan */
}

.modal-footer {
  padding: 20px 25px;
  border-top: 2px solid var(--color-border);
  display: flex;
  gap: 12px;
  background-color: var(--color-background);
}

.modal-footer button {
  flex: 1;
  padding: 14px;
  font-size: 1em;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.modal-footer .button-secondary {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border: 2px solid var(--color-border);
}

.modal-footer .button-secondary:hover {
  background-color: var(--color-border);
  border-color: var(--color-text-secondary);
}

.modal-footer .button-primary {
  background-color: var(--color-primary);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.modal-footer .button-primary:hover {
  background-color: #4f94f7;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

/* Responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .modal-container {
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 20px;
  }
  
  .modal-body {
    padding: 15px 20px;
  }
  
  .apartment-item {
    padding: 12px;
  }
  
  .modal-footer {
    flex-direction: column;
    padding: 15px 20px;
  }
  
  .modal-footer button {
    width: 100%;
  }
}
/* Fix de contraste para texto visible */
.modal-header h3 {
  color: #60a5fa !important; /* Azul claro */
}

.modal-subtitle {
  color: #d1d5db !important; /* Gris claro */
}

.apt-number {
  color: #86efac !important; /* Verde brillante */
}

.apt-address {
  color: #f9fafb !important; /* Casi blanco */
}

.apartment-item {
  background-color: #1f2937 !important; /* Gris oscuro */
  border-color: #4b5563 !important;
}

/* ========================================
   🤖 ARIA BADGE STYLES
   ======================================== */
.aria-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 8px 14px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  position: relative;
  cursor: help;
  transition: all 0.3s ease;
}

.aria-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

.aria-icon {
  font-size: 1.2em;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.aria-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aria-label {
  font-size: 0.65em;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.aria-value {
  font-size: 0.9em;
  font-weight: 600;
  color: white;
}

.aria-tooltip {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: rgba(0, 0, 0, 0.95);
  color: white;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8em;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.aria-badge:hover .aria-tooltip {
  opacity: 1;
}

.aria-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  right: 20px;
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.95);
}

@media (max-width: 768px) {
  .aria-badge {
    padding: 6px 10px;
  }
  
  .aria-value {
    font-size: 0.75em;
  }
  
  .aria-tooltip {
    right: -10px;
    white-space: normal;
    max-width: 200px;
  }
}

@media (max-width: 768px) {
  .aria-badge {
    padding: 6px 10px;
  }
  
  .aria-value {
    font-size: 0.75em;
  }
  
  .aria-tooltip {
    right: -10px;
    white-space: normal;
    max-width: 200px;
  }
}

/* 📊 ARIA Breakdown Detail */
.aria-breakdown {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-left: 3px solid #667eea;
  padding: 8px 12px;
  margin: 8px 0 12px 0;
  border-radius: 4px;
}

.aria-breakdown small {
  color: var(--text-secondary);
  font-size: 0.85em;
  line-height: 1.4;
}

.aria-breakdown strong {
  color: var(--text-primary);
  font-weight: 600;
}

.aria-breakdown span {
  color: #667eea;
  font-weight: 500;
}

.route-config-card {
  margin-top: 1.5rem; /* En lugar de espacio gigante */
}
.route-config-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem; /* ← Cambiar esto */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.gem-link-container {
  margin-top: 0; /* ← Asegurar que no tenga margin top extra */
}

/* Animación de entrada/salida */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.5s ease;
  max-height: 2000px; /* Altura máxima suficiente */
  opacity: 1;
  overflow: hidden;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Barra de edición compacta */
.edit-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border: 1px solid var(--border-primary);
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.btn-edit-inputs {
  background: transparent;
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit-inputs:hover {
  background: var(--brand-primary);
  color: white;
}

.mini-summary {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}
/* Quick Settings Modal Specifics */
/* === MODAL ESTILIZADO (DARK MODE) === */
.quick-settings-modal {
  max-width: 400px;
  width: 90%;
  background-color: #1e293b; /* Fondo Gris Oscuro Azulado */
  color: #f1f5f9; /* Texto Blanco Hueso */
  border: 1px solid #334155;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.modal-header h3 {
  color: #60a5fa; /* Título Azul Claro */
  border-bottom: none;
}

.close-btn {
  background: none; 
  border: none; 
  color: #94a3b8;
  font-size: 1.5rem; 
  cursor: pointer;
}
.close-btn:hover { color: white; }

/* Inputs Oscuros para que no encandilen */
.input-lg {
  font-size: 1.2rem;
  padding: 12px;
  text-align: center;
  border-radius: 8px;
  border: 1px solid #475569;
  background: #0f172a; /* Fondo casi negro */
  color: #ffffff; /* Texto blanco */
  width: 100%;
  transition: border-color 0.2s;
}

.input-lg:focus {
  outline: none;
  border-color: #3b82f6; /* Borde azul al escribir */
}

.divider {
  border: 0; 
  border-top: 1px solid #334155;
  margin: 20px 0;
}

.label-with-button {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 600;
  color: #cbd5e1;
}

.hint { 
  font-size: 0.8rem; 
  color: #64748b; 
  margin-top: 6px; 
}
</style>
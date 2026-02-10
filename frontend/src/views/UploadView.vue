<script setup>
// ============================================
// 1. IMPORTS //
// ============================================
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import Tesseract from 'tesseract.js';
import { computeScoreV5 } from '@/utils/scoring';
import SlideContainer from '@/components/RouteResults/SlideContainer.vue';
import { useAuth } from '@/composables/useAuth';
import { useVehicles } from '@/composables/useVehicles';
import { fetchWithAuth } from '@/lib/api';
import { 
  obtenerMensajeConsciente, 
  getIconForScore, 
  getColorForScore 
} from '@/constants/mensajesConscientes';

// ═══════════════════════════════════════════════════════════════
// 🔧 A2: FETCH ROBUSTO (WRAPPER SOBRE fetchWithAuth) --- fornzando commit
// ═══════════════════════════════════════════════════════════════

/**
 * Agrega timeout a cualquier fetch usando AbortController
 * @param {Function} fetchFn - Función de fetch (ej: fetchWithAuth)
 * @param {string} url - URL del endpoint
 * @param {Object} options - Opciones del fetch
 * @param {number} timeoutMs - Timeout en milisegundos (default: 180s)
 */
async function fetchWithTimeout(fetchFn, url, options, timeoutMs = 180000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Agregar signal al options
    const optionsWithSignal = {
      ...options,
      signal: controller.signal
    };

    const response = await fetchFn(url, optionsWithSignal);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Agrega retry con backoff exponencial
 * @param {Function} fetchFn - Función de fetch con timeout
 * @param {string} url - URL del endpoint
 * @param {Object} options - Opciones del fetch
 * @param {number} maxRetries - Número máximo de reintentos
 */
async function fetchWithRetry(fetchFn, url, options, maxRetries = 2) {
  let attempt = 0;

  while (true) {
    try {
      console.log(`📤 Intento ${attempt + 1}/${maxRetries + 1}...`);
      const response = await fetchWithTimeout(fetchFn, url, options, 90000);
      return response;
    } catch (error) {
      // Si llegamos al límite de reintentos, lanzar error
      if (attempt >= maxRetries) {
        console.error(`❌ Falló después de ${attempt + 1} intentos`);
        throw error;
      }

      // Si es timeout o error de red, reintentar
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        attempt++;
        const waitTime = 600 * Math.pow(2, attempt - 1); // 600ms, 1200ms
        
        console.log(`⚠️ Error: ${error.message}`);
        console.log(`🔄 Reintentando en ${waitTime}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Si es otro tipo de error (ej: auth), no reintentar
        throw error;
      }
    }
  }
}


// ============================================
// 2. VARIABLES Y ESTADO
// ============================================
const route = useRoute();
const router = useRouter();
const { userId } = useAuth();
const { vehicles } = useVehicles();
// Al inicio de UploadView.vue, en la sección de variables:
const debugInfo = ref(null);

// Estado de UI y Datos
const extractedAddresses = ref([]);
const isProcessing = ref(false);
const showInputForm = ref(true);
const backendResponse = ref(null);
const isSaving = ref(false);
const saveStatus = ref(null);
const fileInputRef = ref(null);
const selectedFileNames = ref([]);
const jsonInput = ref('');

const isBusy = computed(() =>
  isUploadingImages.value ||
  isProcessing.value ||
  isSaving.value ||
  backendResponse.value?.status === 'loading'
)

const busyTitle = computed(() => {
  if (isUploadingImages.value) return uploadProgress.value?.message || 'Procesando imágenes…'
  if (isSaving.value) return 'Guardando…'
  return 'Evaluando escenarios…'
})


// Modales y Configuración
const showDowntownModal = ref(false);
const orlandoApartments = ref([]);
const downtownSelection = ref({});
const showQuickSettingsModal = ref(false);
const mostrarDetalles = ref(false);

// ============================================
// 🧠 LÓGICA: SELECT ALL DOWNTOWN
// ============================================

// Propiedad computada de doble vía (get/set) para el checkbox "Seleccionar Todo"
const areAllDowntownSelected = computed({
  // GET: El checkbox está marcado si TODAS las opciones individuales están marcadas
  get: () => {
    const stops = orlandoApartments.value;
    if (stops.length === 0) return false;
    
    // Verificamos si cada parada en la lista tiene su valor correspondiente en true
    return stops.every(stop => downtownSelection.value[stop.number] === true);
  },
  // SET: Cuando el usuario hace click en "Seleccionar Todo"
  set: (newValue) => {
    // Iteramos sobre todas las paradas detectadas y les asignamos el nuevo valor (true o false)
    orlandoApartments.value.forEach(stop => {
      downtownSelection.value[stop.number] = newValue;
    });
  }
});

// Datos del Backend
const ariaData = ref(null); // ARIA multiplier

// Constantes
const DURACION_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const warehouses = ref([
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL', commuteMiles: 23 },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL', commuteMiles: 28 },
  { code: 'UFL4', address: '7469 Kingspointe Pkwy Orlando, FL', commuteMiles: 28 },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL', commuteMiles: 20 },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL', commuteMiles: 18 },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL', commuteMiles: 47 },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL', commuteMiles: 50 },
  { code: 'DFL5', address: '3000 Shelby Industrial Dr Apopka, FL', commuteMiles: 24 },
  { code: 'C060', address: '305 E Altamonte Drive Ste 1000, Altamonte Springs, FL', commuteMiles: 12 },
]);

const destinations = ref([
  { code: 'Casa', address: '513 Alafaya Woods Blvd Oviedo, FL' },
  ...warehouses.value,
  { code: 'Otro (especificar abajo)', address: 'custom' }
]);

// Formulario del Bloque
const selectedWarehouseCode = ref(warehouses.value[0].code);
const selectedDestination = ref(destinations.value[0].address);
const customDestination = ref('');

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const blockData = ref({
  fecha: getLocalDateString(),
  vehiculo: '', 
  hora: '07:00',
  duracion_horas: DURACION_OPTIONS[1],
  pago: 0,
  antes_del_bloque: 45,
  commute_1_manual: warehouses.value[0].commuteMiles,
  retraso_almacen: 20
});

// ============================================
// 🆕 OCR: VARIABLES DE ESTADO
// ============================================
const selectedImages = ref([]); // Array de archivos seleccionados
const showCorrectionModal = ref(false); // Modal de correcciones
const needsConfirmation = ref([]); // Dudas de Gemini
const correctionInputs = ref({}); // Inputs del usuario en modal
const isUploadingImages = ref(false); // Spinner al subir imágenes

// ============================================
// 3. WATCHERS & LIFECYCLE
// ============================================

// Actualizar millas si cambia warehouse
watch(selectedWarehouseCode, (newCode) => {
  const warehouse = warehouses.value.find(w => w.code === newCode);
  if (warehouse) {
    blockData.value.commute_1_manual = warehouse.commuteMiles;
  }
});

// Animacion Crunching/Analyzing

const fancyPhrases = {
  preparing: [
    'Preparing screenshots…',
    'Optimizing for OCR…',
    'Getting things ready…'
  ],
  uploading: [
    'Uploading securely…',
    'Sending screenshots…',
    'Syncing data…'
  ],
  processing: [
    'Crunching numbers…',
    'Reading stops…',
    'Extracting addresses…',
    'Analyzing route…'
  ],
  retrying: [
    'Connection hiccup… retrying…',
    'Re-attempting upload…',
    'Stabilizing connection…'
  ],
  complete: [
    'Done! Finalizing…'
  ],
  error: [
    'Something went wrong…'
  ]
}

const fancyLine = ref('')

let fancyTimer = null

const fancyStageKey = computed(() => {
  // prioridad: OCR upload/progress stages; si no hay stage pero isProcessing, mostramos processing
  if (uploadProgress.value?.stage) return uploadProgress.value.stage
  if (isUploadingImages.value || isProcessing.value) return 'processing'
  return ''
})

function startFancyTicker() {
  stopFancyTicker()

  const key = fancyStageKey.value
  if (!key) return

  const pool = fancyPhrases[key] || fancyPhrases.processing
  let idx = 0
  fancyLine.value = pool[idx]

  fancyTimer = setInterval(() => {
    idx = (idx + 1) % pool.length
    fancyLine.value = pool[idx]
  }, 1400)
}

function stopFancyTicker() {
  if (fancyTimer) {
    clearInterval(fancyTimer)
    fancyTimer = null
  }
}

watch(
  () => fancyStageKey.value,
  () => startFancyTicker()
)

watch(
  () => (isUploadingImages.value || isProcessing.value),
  (active) => {
    if (active) startFancyTicker()
    else stopFancyTicker()
  }
)

onMounted(() => {
  if (isUploadingImages.value || isProcessing.value) startFancyTicker()
})

onBeforeUnmount(() => stopFancyTicker())

// Modo Foco: Ocultar form si llega respuesta válida
watch(backendResponse, (newVal) => {
  if (newVal && !newVal.hasErrors && newVal.status !== 'loading') {
    console.log("✅ Resultados recibidos. Activando Modo Foco.");
    showInputForm.value = false;
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 300);
  }
});

onBeforeRouteLeave(() => {
  if (!isBusy.value) return true
  return window.confirm('Hay un proceso en curso. Si sales ahora podrías perder el resultado. ¿Seguro deseas salir?')
})

function handleBeforeUnload(e) {
  if (!isBusy.value) return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))


onMounted(() => {
  console.log('🚀 UploadView montado');
  // Pre-fill desde Scheduled Block si existe en URL
  if (route.query.blockId) {
    try {
      blockData.value = {
        fecha: route.query.fecha || getLocalDateString(),
        vehiculo: route.query.vehicle_id || '',
        hora: route.query.hora?.substring(0, 5) || '07:00',
        duracion_horas: parseFloat(route.query.duracion) || DURACION_OPTIONS[1],
        pago: parseFloat(route.query.pago) || 0,
        antes_del_bloque: 45,
        commute_1_manual: getCommuteForWarehouse(route.query.warehouse),
        retraso_almacen: 20
      };
      if (route.query.warehouse) {
        selectedWarehouseCode.value = route.query.warehouse;
      }
    } catch (error) {
      console.error('❌ Error en pre-fill:', error);
    }
  }
});

// ============================================
// 4. LOGIC CORE (COMPUTED PROPERTIES)
// ============================================

// --- REPORT DATA: Procesa la respuesta de Google Maps ---
// REEMPLAZA TU reportData ACTUAL CON ESTA VERSIÓN DE DEBUGGING

const reportData = computed(() => {
  try {
    // 1. Si no hay datos, retorno seguro
    if (!backendResponse.value || !backendResponse.value.segments) return null;
    
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
    
    // Validar que toFirstStop y toFinalDestination tengan datos
    const startDist = parseFloat(toFirstStop?.distance || 0);
    const startDur = parseFloat(toFirstStop?.duration || 0);
    const endDist = parseFloat(toFinalDestination?.distance || 0);
    const endDur = parseFloat(toFinalDestination?.duration || 0);

    const totalWorkMiles = startDist + totalBlockMiles;
    const totalWorkDuration = startDur + totalBlockDriveDuration + totalExtraStopTime;
    const totalNormalMiles = totalWorkMiles + endDist;
    const totalNormalDuration = totalWorkDuration + endDur;
    
    // Generar secuencia (con copia segura)
    const normalSequenceStr = [...extractedAddresses.value]
      .sort((a,b) => Number(a.number) - Number(b.number))
      .map(s => s.number)
      .join('-');

    // --- B. PROCESAR RUTA IA ---
    let aiData = null;
    let aiMessage = "La IA no encontró una mejora significativa.";

    if (isAiOptimized && aiRoute) {
        let aiBlockMiles = 0;
        let aiBlockDuration = 0;

        // Validar segmentos IA
        if (aiRoute.segments) {
            const aiProcessedSegments = aiRoute.segments.map(seg => {
                aiBlockMiles += parseFloat(seg.distance || 0);
                aiBlockDuration += parseFloat(seg.duration || 0);
                return { distance: seg.distance, duration: seg.duration, stopsCount: (seg.stops || []).length };
            });

            // Validar inicio/fin IA
            const aiStartDist = parseFloat(aiRoute.toStart?.distance || 0);
            const aiStartDur = parseFloat(aiRoute.toStart?.duration || 0);
            const aiEndDist = parseFloat(aiRoute.toEnd?.distance || 0);
            const aiEndDur = parseFloat(aiRoute.toEnd?.duration || 0);

            const totalAiWorkMiles = aiStartDist + aiBlockMiles;
            const totalAiWorkDuration = aiStartDur + aiBlockDuration + totalExtraStopTime;
            
            const totalAiMiles = totalAiWorkMiles + aiEndDist;
            const totalAiDuration = totalAiWorkDuration + aiEndDur;

            // Juez del 5%
            const diffMiles = totalNormalMiles - totalAiMiles;
            const diffTime = totalNormalDuration - totalAiDuration;
            const pctMiles = totalNormalMiles > 0 ? (diffMiles / totalNormalMiles) : 0;
            const pctTime = totalNormalDuration > 0 ? (diffTime / totalNormalDuration) : 0;
            const UMBRAL = 0.05; 

            console.log("👨‍⚖️ EL JUEZ DICE:");
            console.log(`   - Ahorro Millas: ${diffMiles.toFixed(2)} mi (${(pctMiles*100).toFixed(1)}%)`);
            console.log(`   - Ahorro Tiempo: ${diffTime.toFixed(1)} min (${(pctTime*100).toFixed(1)}%)`);
            console.log(`   - ¿Pasa el filtro? ${(pctMiles >= UMBRAL) || (pctTime >= UMBRAL) ? 'SÍ ✅' : 'NO ❌'}`);

            if ((pctMiles >= UMBRAL) || (pctTime >= UMBRAL)) {
                aiMessage = `¡Ahorro! ${diffMiles.toFixed(1)} mi / ${Math.round(diffTime)} min.`;
                
                const aiSequenceStr = [...extractedAddresses.value]
                  .sort((a,b) => {
                      const valA = (a.ia_suggestion !== undefined && a.ia_suggestion !== null) ? a.ia_suggestion : a.number;
                      const valB = (b.ia_suggestion !== undefined && b.ia_suggestion !== null) ? b.ia_suggestion : b.number;
                      return Number(valA) - Number(valB);
                  })
                  .map(s => s.number)
                  .join('-');

                aiData = {
                    toStart: { distance: aiStartDist.toFixed(2), duration: Math.round(aiStartDur) },
                    segments: aiRoute.segments, // Pasar segmentos crudos si processed falla
                    toEnd: { distance: aiEndDist.toFixed(2), duration: Math.round(aiEndDur) },
                    totalWorkMiles: totalAiWorkMiles.toFixed(2),
                    totalWorkDuration: Math.round(totalAiWorkDuration),
                    totalMiles: totalAiMiles.toFixed(2),
                    totalDuration: Math.round(totalAiDuration),
                    baseDriveDuration: aiStartDur + aiBlockDuration + totalExtraStopTime,
                    commuteDuration: aiEndDur,
                    label: '🤖 AI ROUTE',
                    sequence: aiSequenceStr
                };
            }
        }
    }

    return {
      savings: aiData ? (totalNormalMiles - aiData.totalMiles).toFixed(2) : '0.00',
      aiMessage: aiMessage,
      stopCount: totalStopCount,
      apartmentCount: totalApartmentCount,
      downtownCount: totalDowntownCount,
      normal: {
        toStart: { distance: startDist.toFixed(2), duration: Math.round(startDur) },
        segments: processedSegments,
        toEnd: { distance: endDist.toFixed(2), duration: Math.round(endDur) },
        totalWorkMiles: totalWorkMiles.toFixed(2),
        totalWorkDuration: Math.round(totalWorkDuration),
        totalMiles: totalNormalMiles.toFixed(2),
        totalDuration: Math.round(totalNormalDuration),
        baseDriveDuration: startDur + totalBlockDriveDuration + totalExtraStopTime,
        commuteDuration: endDur,
        sequence: normalSequenceStr
      },
      inverse: aiData 
    };

  } catch (error) {
    // 🚨 ESTA ALERTA TE DIRÁ DÓNDE ESTÁ EL ERROR EXACTAMENTE
    alert(`💥 Error calculando ReportData: ${error.message}`);
    console.error("Crash reportData:", error);
    return null;
  }
});
// --- SCENARIO ETAS (Tiempos de reloj) ---
const scenarioETAs = computed(() => {
  if (!reportData.value?.normal || !blockData.value?.hora || blockData.value.retraso_almacen === undefined) {
    return null;
  }
  
  const stopCount = Number(reportData.value.stopCount) || 0;
  const [startHours, startMinutes] = blockData.value.hora.split(':').map(Number);
  const blockStartTime = new Date();
  blockStartTime.setHours(startHours, startMinutes, 0, 0);
  const prepTimeMinutes = Number(blockData.value.retraso_almacen) || 0;
  const estimatedDepartureTime = new Date(blockStartTime.getTime() + prepTimeMinutes * 60000);
  
  const calculateScenario = (baseDrive, commute, multiplier) => {
    const baseStopTime = stopCount * multiplier;
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
  
  // Normal
  const normalBaseDrive = reportData.value.normal.baseDriveDuration;
  const normalCommute = reportData.value.normal.commuteDuration;
  const normalScenarios = {
      optimistic: calculateScenario(normalBaseDrive, normalCommute, optimisticMultiplier),
      normal: calculateScenario(normalBaseDrive, normalCommute, ariaMultiplier),
      pessimistic: calculateScenario(normalBaseDrive, normalCommute, pessimisticMultiplier)
  };

  // IA (Opcional) - 🛡️ PROTEGIDO CONTRA NULL
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

  return { normal: normalScenarios, inverse: inverseScenarios };
});

// HELPERS: EVALUACIÓN DE RED
function getNetworkSnapshot() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    online: navigator.onLine,
    effectiveType: c?.effectiveType || null,   // 'slow-2g' | '2g' | '3g' | '4g'
    downlink: typeof c?.downlink === 'number' ? c.downlink : null, // Mbps aprox
    rtt: typeof c?.rtt === 'number' ? c.rtt : null,               // ms
  };
}

function isVeryBadNetwork(net) {
  if (!net.online) return true;

  // Reglas conservadoras (puedes ajustar)
  if (net.effectiveType === 'slow-2g' || net.effectiveType === '2g') return true;
  if (net.downlink !== null && net.downlink < 0.4) return true; // <0.4 Mbps suele ser mortal para uploads
  if (net.rtt !== null && net.rtt > 2000) return true;          // >2s RTT = conexión pésima

  return false;
}

function buildBadNetworkMessage(net) {
  const details = [
    net.effectiveType ? `Tipo: ${net.effectiveType}` : null,
    net.downlink !== null ? `Velocidad aprox: ${net.downlink} Mbps` : null,
    net.rtt !== null ? `RTT: ${net.rtt} ms` : null,
  ].filter(Boolean).join(' • ');

  return (
`⚠️ Señal demasiado débil para subir las capturas.

Sugerencias:
- Conéctate al Wi‑Fi del warehouse (casi siempre está disponible).
- Espera 1–2 minutos y vuelve a intentar.

${details ? `\n📶 ${details}` : ''}`
  );
}
// FIN HELPERS: EVALUACIÓN DE RED

// --- HELPER: CÁLCULO DE PAYLOADS FINALES ---
function calculateLogData(scenarioKey) {
  if (!extractedAddresses.value || !reportData.value || !scenarioETAs.value) return null;
  
  // 🛡️ Seguridad para IA: si piden inverse pero no existe, salimos
  if (scenarioKey === 'inverse' && !reportData.value.inverse) return null;

  const chosenReport = reportData.value[scenarioKey];
  const chosenETA = scenarioETAs.value[scenarioKey]?.normal;
  
  if (!chosenReport || !chosenETA) return null;

  const data = blockData.value;
  const pago = Number(data.pago) || 0;
  const duracion_horas = Number(data.duracion_horas) || 0;
  const user_id = userId.value;

  // Lógica Ciudad
  let primary_city = null;
  if (extractedAddresses.value.length > 0) {
    const cityCounts = {};
    extractedAddresses.value.forEach(stop => {
      if (!stop.address) return;
      let addr = stop.address.toUpperCase().replace(/\b(APT|UNIT|#)\s*\d+[A-Z]?\b/gi, '').replace(/\b(FL|FLORIDA)\s*$/i, '');
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
  } catch (e) {}

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

  const mult = ariaData.value?.multiplier || 0.9;
  const totalAptsInReport = reportData.value.apartmentCount || 0;
  const totalDtInReport = reportData.value.downtownCount || 0;
  const regularApts = Math.max(0, totalAptsInReport - totalDtInReport);
  const calcText = `${numero_paradas} stops × ${mult.toFixed(2)} + ${regularApts} apts × 0.75 + ${totalDtInReport} DT × 3`;

  // Tramos tácticos
  const leg1_dist = parseFloat(chosenReport.toStart.distance) || 0;
  const leg1_time = Math.round(parseFloat(chosenReport.toStart.duration) || 0);
  const work_drive_plus_extras = chosenReport.totalWorkDuration - leg1_time;
  const work_base_stop_time = numero_paradas * mult;
  const leg2_time = Math.round(work_drive_plus_extras + work_base_stop_time);
  const leg2_dist = parseFloat(chosenReport.totalWorkMiles) - leg1_dist;
  const leg3_dist = parseFloat(chosenReport.toEnd.distance) || 0;
  const leg3_time = Math.round(parseFloat(chosenReport.toEnd.duration) || 0);

// 🔥 CALCULAR ETAs DE CIUDAD (antes del return) //
let etaCityArrival = 'N/A';
let etaCityDeparture = 'N/A';

try {
  const [startHours, startMinutes] = data.hora.split(':').map(Number);
  
  const blockStart = new Date();
  blockStart.setHours(startHours, startMinutes, 0, 0);
  
  // ✅ CAMBIO: retrasoalmacen → retraso_almacen
  const delayMinutes = Number(data.retraso_almacen) || 0;
  const driveMinutes = leg1_time;
  const arrivalMinutes = delayMinutes + driveMinutes;
  
  const cityArrival = new Date(blockStart.getTime() + (arrivalMinutes * 60000));
  etaCityArrival = cityArrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  
  const departureMinutes = arrivalMinutes + leg2_time;
  const cityDeparture = new Date(blockStart.getTime() + (departureMinutes * 60000));
  etaCityDeparture = cityDeparture.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  
} catch (e) {
  console.error('❌ Error calculando ETAs de ciudad:', e);
}

  return {
    fecha: data.fecha,
    block_id: route.query.blockId || null,
    vehicle_id: data.vehiculo,
    warehouse: backendResponse.value?.warehouseCode || selectedWarehouseCode.value, // 👈 Usar el código
    hora: data.hora,
    duracion_horas, pago,
    pago_por_hora: pago_por_hora.toFixed(2),
    retraso_almacen: Number(data.retraso_almacen) || 0,
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
    user_id, primary_city, first_stop: first_stop_distance.toFixed(2), numero_paradas,
    
    eta_optimista: scenarioETAs.value[scenarioKey].optimistic.eta,
    eta_normal: chosenETA.eta,
    eta_pesimista: scenarioETAs.value[scenarioKey].pessimistic.eta,

      // 🔥 ETAs de ciudad (ya calculados arriba)
    eta_city_arrival: etaCityArrival,
    eta_city_departure: etaCityDeparture,
    
    apartment_count: regularApts,
    downtown_count: totalDtInReport,
    aria_multiplier: mult,
    calculation_text: calcText,
    segments: chosenReport.segments || [],
    
    tactical: {
      leg1: { dist: leg1_dist.toFixed(1), time: leg1_time },
      leg2: { dist: leg2_dist.toFixed(1), time: leg2_time },
      leg3: { dist: leg3_dist.toFixed(1), time: leg3_time }
    }
  };
}

// 4. PAYLOADS PARA SLIDE CONTAINER
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

// En UploadView.vue

const inversePayload = computed(() => {
  // 1. Validaciones de seguridad
  if (!reportData.value || !reportData.value.inverse) return null;
  
  const baseData = calculateLogData('inverse');
  if (!baseData) return null;
  
  const etas = scenarioETAs.value?.inverse;
  if (!etas) return null;

  // 2. 🧠 CALCULAR SCORE PARA LA IA (Esto es lo que faltaba)
  const scoreResult = computeScoreV5(baseData);
  const mensaje = obtenerMensajeConsciente(scoreResult.total);

  // 3. Retorno completo
  return {
    ...baseData,                // Datos base (incluye aria_multiplier)
    ...reportData.value.normal, // Contadores de paradas (son los mismos)
    ...reportData.value.inverse,// Millas y Tiempos de la IA
    ...etas,                    // ETAs de reloj
    
    // Datos de Puntuación Calculados
    route_score: scoreResult.total,
    mensaje: mensaje,
    icon: getIconForScore(scoreResult.total),
    color: getColorForScore(scoreResult.total),
    categoria: mensaje.categoria,
    redFlags: scoreResult.redFlags || [],

    // Etiqueta visual
    label: reportData.value.inverse.label || 'AI ROUTE',
  };
});
// ============================================
// 5. FUNCIONES PRINCIPALES (SEND & SAVE)
// ============================================

// ============================================
// FUNCIONES DE EVALUACIÓN (PEGA ESTO ANTES DE sendToBackend)
// ============================================

// ============================================
// 🕵️‍♂️ SUPER DEBUGGER: DETECCIÓN Y EVALUACIÓN
// ============================================

function isInOrlando(address) {
  if (!address) return false;
  return /\bORLANDO\b/i.test(address);
}

// ============================================
// 🏙️ DETECCIÓN DOWNTOWN (PRODUCCIÓN)
// ============================================

function detectOrlandoApartments() {
  if (!extractedAddresses.value) return [];

  // Filtro robusto: Verifica si es apartamento (dato del backend O visual) Y si está en Orlando
  return extractedAddresses.value.filter(stop => {
    if (!stop) return false;
    
    // La lógica ganadora: 
    // 1. Confianza en el flag isApartment (que ahora viene bien del backend)
    // 2. Doble chequeo de que la dirección contenga "ORLANDO"
    const isApt = stop.isApartment === true;
    const inOrlando = stop.address && /\bORLANDO\b/i.test(stop.address);
    
    return isApt && inOrlando;
  });
}

// 3. MODIFICAMOS SHOW DOWNTOWN
function showDowntownDetection() {
  try {
    const apartments = detectOrlandoApartments();
    
    // Si no hay candidatos, no molestamos al usuario
    if (apartments.length === 0) return false;
    
    // Preparamos el modal
    orlandoApartments.value = apartments;
    downtownSelection.value = {};
    
    // Inicializamos selección
    apartments.forEach(apt => {
      if (apt && apt.number !== undefined) {
        downtownSelection.value[apt.number] = false;
      }
    });
    
    showDowntownModal.value = true;
    return true;

  } catch (error) {
    console.error("Error en showDowntownDetection:", error);
    return false;
  }
}
async function evaluateRoute() {
  // ============================================
  // 🆕 DECISIÓN: ¿OCR o JSON Manual?
  // ============================================
  
  // CASO A: Si hay imágenes seleccionadas, usar OCR
  if (selectedImages.value.length > 0) {
    console.log('📸 Modo OCR activado');
    await processImagesWithOCR();
    return;
  }
  
  // CASO B: Si no hay imágenes, flujo JSON manual (ACTUAL)
  console.log('📋 Modo JSON manual activado');
  
  // A. PROCESAR JSON
  if (extractedAddresses.value.length === 0) {
    if (!jsonInput.value) { 
      alert('⚠️ Debes subir capturas O pegar el JSON.'); 
      return; 
    }
    
    isProcessing.value = true;
    await new Promise(resolve => setTimeout(resolve, 50)); 

    try {
      const parsedData = JSON.parse(jsonInput.value);
      if (!Array.isArray(parsedData)) throw new Error('JSON no es array.');

      extractedAddresses.value = parsedData.map(item => ({
        number: item.stop_number || 0,
        address: [item.street_address, item.apartment, item.city].filter(Boolean).join(' ').trim(),
        isDowntown: false,
        isApartment: item.apartment != null,
        ia_suggestion: item.ia_suggestion 
      }));
      
      isProcessing.value = false;
    } catch (error) {
      alert(`❌ Error JSON: ${error.message}`);
      isProcessing.value = false;
      return;
    }
  }

  // B. VERIFICAR DOWNTOWN
  const needsCheck = showDowntownDetection(); 
  
  if (needsCheck) {
    return;
  }
  
  await proceedWithEvaluation();
}

// ============================================
// FUNCIONES DEL MODAL DOWNTOWN (Faltaban estas)
// ============================================

function confirmDowntownSelection() {
  console.log("🏢 Confirmando selección de Downtown...");
  // Aplicar selección del usuario a la lista principal
  Object.keys(downtownSelection.value).forEach(stopNumber => {
    const stop = extractedAddresses.value.find(s => s.number === parseInt(stopNumber));
    if (stop) {
      stop.isDowntown = downtownSelection.value[stopNumber];
    }
  });
  
  // Cerrar modal y continuar
  showDowntownModal.value = false;
  proceedWithEvaluation();
}

function skipDowntownSelection() {
  console.log("⏭️ Saltando selección de Downtown (Ninguno marcado)...");
  // Marcar todos como NO downtown
  orlandoApartments.value.forEach(apt => {
    const stop = extractedAddresses.value.find(s => s.number === apt.number);
    if (stop) {
      stop.isDowntown = false;
    }
  });
  
  // Cerrar modal y continuar
  showDowntownModal.value = false;
  proceedWithEvaluation();
}

// Función puente con LOG para saber que el modal funcionó
async function proceedWithEvaluation() {
  console.log("🚀 Continuando con la evaluación tras chequeo de Downtown...");
  await sendToBackend();
}

// En UploadView.vue -> Reemplaza la función sendToBackend() completa

async function sendToBackend() {
    console.log("🚀 Iniciando sendToBackend...");
    // 1. Activar Spinner visualmente para que sepas que algo está pasando
    isProcessing.value = true; 
    
    try {
        // --- VALIDACIONES PREVIAS (Ahora dentro del try/catch) ---
        
    // A. Validar Direcciones
    if (!extractedAddresses.value || extractedAddresses.value.length === 0) {
      throw new Error('No hay direcciones cargadas en la lista.');
    }
    
    // B. Validar Warehouse
    const warehouse = warehouses.value.find(w => w.code === selectedWarehouseCode.value);
    if (!warehouse) {
      throw new Error(`Error crítico: No se encontró el almacén con código ${selectedWarehouseCode.value}. Revisa la configuración.`);
    }
    
    console.log(`✅ Warehouse: ${warehouse.code} - ${warehouse.address}`);
        
    // C. Preparar Ruta Normal
        const sortedByAmazon = [...extractedAddresses.value].sort((a, b) => 
          Number(a.number) - Number(b.number)
        );

        const addressesToSend = sortedByAmazon.map(stop => stop.address);

        const sanitizedAddresses = addressesToSend
          .map(sanitizeAddress)
          .filter(addr => addr && addr.trim() !== '');

        if (sanitizedAddresses.length === 0) {
          throw new Error('Las direcciones extraídas no son válidas o están vacías.');
        }

        const fullRouteAmazon = [
          sanitizeAddress(warehouse.address),
          ...sanitizedAddresses,
          sanitizeAddress(
            selectedDestination.value === 'custom' 
              ? customDestination.value 
              : selectedDestination.value
          )
        ];

        // ... (código de IA)

          let aiOptimizedStops = null;
    
            const hasDifference = extractedAddresses.value.some(stop => {
              const currentNum = Number(stop.number);
              const aiNum = stop.ia_suggestion !== undefined && stop.ia_suggestion !== null 
                ? Number(stop.ia_suggestion) 
                : currentNum;
              return currentNum !== aiNum;
            });

            if (hasDifference) {
              console.log('✅ Diferencia detectada, activando ruta IA...');
              const sortedByAI = [...extractedAddresses.value].sort((a, b) => {
                const valA = a.ia_suggestion !== undefined && a.ia_suggestion !== null 
                  ? a.ia_suggestion 
                  : a.number;
                const valB = b.ia_suggestion !== undefined && b.ia_suggestion !== null 
                  ? b.ia_suggestion 
                  : b.number;
                return Number(valA) - Number(valB);
              });
              aiOptimizedStops = sortedByAI.map(stop => stop.address).map(sanitizeAddress).filter(Boolean);
            } else {
              console.log('ℹ️ No hay diferencia, ruta IA inactiva.');
          }
        // --- ENVIAR AL SERVIDOR ---
        console.log('📤 Enviando datos al backend...');
        console.log(`🏭 Warehouse a enviar: "${warehouse.address}"`); // 👈 Log de verificación
        backendResponse.value = { status: 'loading' };

        const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

            const requestPayload = {
              addresses: fullRouteAmazon,
              aiOptimizedAddresses: aiOptimizedStops,
              finalDestination: selectedDestination.value === 'custom' 
                ? customDestination.value 
                : selectedDestination.value,
              startTime: blockData.value.hora,
              warehouseDelay: blockData.value.retraso_almacen,
              currentDate: blockData.value.fecha,
              warehouse: warehouse.address,
              warehouseCode: warehouse.code
            };

        console.log('📦 Payload completo:', JSON.stringify(requestPayload , null, 2)); // 👈 Debug
        console.log('🔍 DEBUG WAREHOUSE:');
        console.log('selectedWarehouseCode:', selectedWarehouseCode.value);
        console.log('warehouse object:', warehouse);
        console.log('warehouse.address:', warehouse?.address);
        console.log('typeof warehouse:', typeof warehouse);

        debugInfo.value = {
        warehouseCode: selectedWarehouseCode.value,
        warehouseObject: warehouse,
        warehouseAddress: warehouse?.address,
        hasWarehouse: !!warehouse
        };

        // 👇 ENVIAR
        const response = await fetchWithAuth(`${backendUrl}/api/optimize-route`, {
          method: 'POST',
          body: JSON.stringify(requestPayload)
        });

        const result = await response.json();
        console.log("✅ Respuesta recibida:", result);

        // Manejo de respuesta
        if (result.hasErrors) {
            console.warn("⚠️ Errores reportados por el backend:", result.failedAddresses);
            // No lanzamos error aquí para permitir que la UI muestre el bloque de errores
            backendResponse.value = result; 
            
            // Scroll automático a los errores
            setTimeout(() => {
                const errorSection = document.querySelector('.address-errors');
                if (errorSection) errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        } else {
            // ÉXITO
            backendResponse.value = result;
            if (result.aria) ariaData.value = result.aria;
        }

    } catch (error) {
        console.error("❌ Error CRÍTICO en sendToBackend:", error);
        // Esta alerta es la que te dirá qué pasó si vuelve a fallar
        alert(`💥 Ocurrió un error inesperado: ${error.message}`); 
        backendResponse.value = { error: error.message, hasErrors: true };
    } finally {
        isProcessing.value = false; // Apagar spinner
    }
}


// En UploadView.vue

async function saveToLogbook(payloadDirecto) {
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
            
            // 👇 CAMBIO REALIZADO: Solo mostramos mensaje, sin redirección
            alert("✅ ¡Ruta guardada exitosamente! Maneja con cuidado."); 
            
            // Eliminamos el setTimeout y el router.push para que te quedes en esta pantalla
            
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

function removeAddress(index) { extractedAddresses.value.splice(index, 1); }
function addAddress() {
    const nextNumber = extractedAddresses.value.length > 0 ? Math.max(...extractedAddresses.value.map(s => s.number)) + 1 : 2; 
    extractedAddresses.value.push({ number: nextNumber, address: '', isDowntown: false }); 
}

function getVehicleNickname(vehicleId) {
  if (!vehicleId) return 'No especificado';
  const vehicle = vehicles.value.find(v => v.id === vehicleId);
  return vehicle ? vehicle.nickname : 'Vehículo desconocido';
}

function getCommuteForWarehouse(warehouseCode) {
  const warehouse = warehouses.value.find(w => w.code === warehouseCode);
  return warehouse ? warehouse.commuteMiles : warehouses.value[0].commuteMiles;
}

function sanitizeAddress(address) {
    if (!address) return '';
    // Elimina caracteres especiales raros, deja letras, números, espacios y #
    return address.replace(/[^a-zA-Z0-9\s#]/g, '').replace(/\s+/g, ' ').trim();
}
// Función para calcular el retraso en el almacén (Botón "Now")
function calculateActualDelay() {
  // 1. Validamos que tengamos una hora de inicio definida
  if (!blockData.value.start_time) {
    alert("⚠️ Primero ingresa la 'Hora de Inicio' del bloque.");
    return;
  }

  const now = new Date();
  const startTime = new Date(); // Fecha de hoy base

  // 2. Parseamos la hora del input (asumiendo formato HH:MM de un input type="time")
  // Si tu input de hora usa AM/PM manual, avísame para ajustar esto.
  const [hours, minutes] = blockData.value.start_time.split(':');
  
  startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  // 3. Calculamos la diferencia
  const diffMs = now - startTime; // Diferencia en milisegundos
  const diffMins = Math.round(diffMs / 60000); // Convertir a minutos

  // 4. Asignamos el valor
  // Si es negativo (estás calculando antes de que empiece el bloque), lo ponemos en 0
  blockData.value.retraso_almacen = diffMins > 0 ? diffMins : 0;
}

// ============================================
// 🆕 OCR: MANEJO DE IMÁGENES
// ============================================
function handleImageSelection(event) {
  const files = Array.from(event.target.files);
  
  // Validar cantidad (1-10 imágenes)
  if (files.length === 0) {
    alert('⚠️ Debes seleccionar al menos 1 imagen');
    return;
  }
  
  if (files.length > 10) {
    alert('⚠️ Máximo 10 imágenes permitidas');
    return;
  }
  
  // Validar tipos
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  const invalidFiles = files.filter(f => !validTypes.includes(f.type));
  
  if (invalidFiles.length > 0) {
    alert('⚠️ Solo se permiten imágenes PNG o JPEG');
    return;
  }
  
  selectedImages.value = files;
  console.log(`📸 ${files.length} imagen(es) seleccionada(s)`);
}

function clearImages() {
  selectedImages.value = [];
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

/**
 * 🆕 Comprimir imagen manteniendo calidad alta para OCR
 */
async function compressImageForOCR(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Mantener tamaño si es < 2000px, sino reducir
        let width = img.width;
        let height = img.height;
        const maxDimension = 2000;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Comprimir a JPEG 85% quality
        canvas.toBlob((blob) => {
          const compressedFile = new File(
            [blob], 
            file.name.replace(/\.[^/.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          );
          
          console.log(`📦 ${file.name}:`);
          console.log(`   Original: ${(file.size / 1024).toFixed(1)} KB`);
          console.log(`   Comprimido: ${(compressedFile.size / 1024).toFixed(1)} KB`);
          console.log(`   Ahorro: ${(((file.size - compressedFile.size) / file.size) * 100).toFixed(1)}%`);
          
          resolve(compressedFile);
        }, 'image/jpeg', 0.92); // 92% quality - mejor para OCR de texto pequeño
      };
      
      img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🔧 A2-PLUS: VARIABLES Y HELPERS
// ═══════════════════════════════════════════════════════════════

// 🆕 Variables para telemetría (agregar junto a las otras const ref)
const uploadMetrics = ref({
  startTime: null,
  imageCount: 0,
  totalSizeMB: 0,
  attempt: 0,
  error: null,
  duration: null
});

const uploadProgress = ref({
  stage: '',
  message: '',
  percentage: 0
});

// 🆕 Helper: Fetch con timeout
async function fetchWithTimeoutAndMetrics(fetchFn, url, options, timeoutMs = 120000) {
  const controller = new AbortController();
  const startTime = Date.now();
  
  const timeoutId = setTimeout(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`⏱️ TIMEOUT después de ${elapsed}s (límite: ${timeoutMs/1000}s)`);
    controller.abort();
  }, timeoutMs);

  try {
    const optionsWithSignal = {
      ...options,
      signal: controller.signal
    };

    console.log(`📤 [${new Date().toISOString()}] Iniciando fetch...`);
    const response = await fetchFn(url, optionsWithSignal);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Response recibida en ${elapsed}s`);
    
    return response;
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    error.elapsedSeconds = elapsed;
    error.isTimeout = error.name === 'AbortError';
    
    console.error(`❌ Fetch falló después de ${elapsed}s:`, error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 🆕 Helper: Retry con progreso
async function fetchWithRetryAndProgress(fetchFn, url, options, maxRetries = 2) {
  let attempt = 0;

  while (true) {
    try {
      uploadMetrics.value.attempt = attempt + 1;
      
      if (attempt === 0) {
        uploadProgress.value.stage = 'uploading';
        uploadProgress.value.message = '📤 Subiendo imágenes al servidor...';
        uploadProgress.value.percentage = 30;
      } else {
        uploadProgress.value.stage = 'retrying';
        uploadProgress.value.message = `🔄 Reintento ${attempt}/${maxRetries}...`;
        uploadProgress.value.percentage = 30 + (attempt * 20);
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 INTENTO ${attempt + 1}/${maxRetries + 1}`);
      console.log(`🕐 Hora: ${new Date().toLocaleTimeString()}`);
      console.log(`📱 Conexión: ${navigator.connection?.effectiveType || 'unknown'}`);
      console.log(`${'='.repeat(60)}\n`);

      const response = await fetchWithTimeoutAndMetrics(fetchFn, url, options, 120000);
      
      uploadProgress.value.stage = 'processing';
      uploadProgress.value.message = '🤖 Gemini está procesando...';
      uploadProgress.value.percentage = 70;
      
      return response;

    } catch (error) {
      uploadMetrics.value.error = {
        name: error.name,
        message: error.message,
        isTimeout: error.isTimeout,
        elapsedSeconds: error.elapsedSeconds,
        attempt: attempt + 1
      };

      console.error(`\n${'❌'.repeat(30)}`);
      console.error(`ERROR EN INTENTO ${attempt + 1}`);
      console.error(`Tipo: ${error.name}`);
      console.error(`Mensaje: ${error.message}`);
      console.error(`Es Timeout: ${error.isTimeout}`);
      console.error(`Duración: ${error.elapsedSeconds}s`);
      console.error(`${'❌'.repeat(30)}\n`);

      if (attempt >= maxRetries) {
        console.error(`\n💥 FALLÓ DESPUÉS DE ${attempt + 1} INTENTOS`);
        console.error(`Métricas completas:`, uploadMetrics.value);
        throw error;
      }

      const waitTime = 1000 * Math.pow(2, attempt);
      console.log(`⏳ Esperando ${waitTime/1000}s antes de reintentar...`);
      uploadProgress.value.message = `⏳ Esperando ${waitTime/1000}s...`;
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      attempt++;
    }
  }
}
// ============================================
// 🆕 OCR: LLAMADA AL ENDPOINT
// ============================================
// ═══════════════════════════════════════════════════════════════
// 🔧 A2-PLUS: FUNCIÓN PRINCIPAL (REEMPLAZA LA VIEJA)
// ═══════════════════════════════════════════════════════════════
async function processImagesWithOCR() {
  console.log("\n\n" + "🚀".repeat(30));
  console.log("INICIO: processImagesWithOCR");
  console.log("🚀".repeat(30) + "\n");

  // Reset de métricas
  uploadMetrics.value = {
    startTime: Date.now(),
    imageCount: selectedImages.value.length,
    originalSizeMB: (selectedImages.value.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2),
    compressedSizeMB: 0,
    attempt: 0,
    error: null,
    duration: null
  };

  uploadProgress.value = {
    stage: 'preparing',
    message: '📦 Preparando imágenes...',
    percentage: 10
  };

  isUploadingImages.value = true;

  try {
    // Log inicial
    console.log("📊 MÉTRICAS INICIALES:");
    console.log(`  - Imágenes: ${uploadMetrics.value.imageCount}`);
    console.log(`  - Tamaño original: ${uploadMetrics.value.originalSizeMB} MB`);
    console.log(`  - Hora inicio: ${new Date(uploadMetrics.value.startTime).toLocaleTimeString()}`);
    console.log(`  - Conexión: ${navigator.connection?.effectiveType || 'unknown'}`);

    // 🆕 1. Comprimir imágenes
    console.log('📦 Comprimiendo imágenes...');
    const compressedImages = await Promise.all(
      selectedImages.value.map(file => compressImageForOCR(file))
    );

    // 📊 Calcular tamaños originales y comprimidos
    const originalSize = selectedImages.value.reduce((sum, file) => sum + file.size, 0);
    const compressedSize = compressedImages.reduce((sum, file) => sum + file.size, 0);
    uploadMetrics.value.compressedSizeMB = (compressedSize / 1024 / 1024).toFixed(2);
    const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

    console.log(`✅ Compresión completa: ${uploadMetrics.value.originalSizeMB} MB → ${uploadMetrics.value.compressedSizeMB} MB (${savings}% ahorro)`);

    // 2. Preparar FormData con imágenes comprimidas
    const formData = new FormData();
    compressedImages.forEach((file, index) => {
      console.log(`📎 ${index + 1}. ${file.name} - ${(file.size / 1024).toFixed(1)} KB`);
      formData.append('images', file);
    });

    uploadProgress.value.percentage = 20;

    // 3. Llamar con retry + telemetría
    const backendUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    console.log(`\n📤 Subiendo imágenes al servidor...`);
    console.log(`   ${uploadMetrics.value.imageCount} imágenes • Original: ${uploadMetrics.value.originalSizeMB} MB → Comprimido: ${uploadMetrics.value.compressedSizeMB} MB (${savings}% ahorro) • Intento ${uploadMetrics.value.attempt + 1}`);
    console.log(`🎯 Target: ${backendUrl}/api/v1/ocr/amazon-stops`);

    // 🧠 Guard: si la señal es MUY mala, no intentamos subir
    const net = getNetworkSnapshot();
    if (isVeryBadNetwork(net)) {
      const msg = buildBadNetworkMessage(net);

      uploadProgress.value = {
        stage: 'error',
        message: '⚠️ Señal demasiado débil. Conéctate al Wi‑Fi del warehouse y reintenta.',
        percentage: 0
      };

      alert(msg);
      return;
    }
    
    const response = await fetchWithRetryAndProgress(
      fetchWithAuth,
      `${backendUrl}/api/v1/ocr/amazon-stops`,
      {
        method: "POST",
        body: formData,
      },
      2
    );

    // 4. Procesar respuesta
    uploadProgress.value.percentage = 90;

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    
    uploadMetrics.value.duration = ((Date.now() - uploadMetrics.value.startTime) / 1000).toFixed(1);

    console.log(`\n✅ ${'='.repeat(60)}`);
    console.log(`ÉXITO - Duración total: ${uploadMetrics.value.duration}s`);
    console.log(`Ahorro de compresión: ${savings}%`);
    console.log(`Intentos necesarios: ${uploadMetrics.value.attempt}`);
    console.log(`${'='.repeat(60)}\n`);

    uploadProgress.value = {
      stage: 'complete',
      message: '✅ Listo!',
      percentage: 100
    };

    // 5. Procesar resultado
    const { stops, needs_confirmation } = result;

    extractedAddresses.value = stops.map((stop) => ({
      number: stop.stop_number,
      address: [stop.street_address, stop.apartment, stop.city]
        .filter(Boolean)
        .join(" ")
        .trim(),
      isDowntown: false,
      isApartment: stop.apartment && stop.apartment.trim() !== "",
      ia_suggestion: stop.ia_suggestion,
    }));

    console.log(`✅ ${extractedAddresses.value.length} paradas cargadas desde OCR`);

    // 6. Verificar si hay dudas
    if (needs_confirmation && needs_confirmation.length > 0) {
      console.log(`⚠️ ${needs_confirmation.length} campos necesitan confirmación`);
      needsConfirmation.value = needs_confirmation;

      correctionInputs.value = {};
      needs_confirmation.forEach((item) => {
        const key = `${item.stop_number}_${item.field}`;
        correctionInputs.value[key] = item.current_value || '';
      });

      showCorrectionModal.value = true;
      isUploadingImages.value = false;
      return;
    }

    // 7. Continuar con flujo normal
    console.log("✅ No hay dudas, continuando...");
    isUploadingImages.value = false;

    const needsDowntownCheck = showDowntownDetection();
    if (needsDowntownCheck) return;

    await proceedWithEvaluation();

  } catch (error) {
    uploadMetrics.value.duration = ((Date.now() - uploadMetrics.value.startTime) / 1000).toFixed(1);

    console.error("\n\n" + "💥".repeat(30));
    console.error("ERROR FINAL:");
    console.error("💥".repeat(30));
    console.error("Métricas completas:", JSON.stringify(uploadMetrics.value, null, 2));
    console.error("\n");

    let errorMessage = "Error procesando imágenes";
    let debugInfo = "";

    if (error.isTimeout || error.name === "AbortError") {
      errorMessage = `⏱️ Timeout después de ${error.elapsedSeconds || uploadMetrics.value.duration}s`;
      debugInfo = `\n\n🔍 DEBUG:\n- Tamaño original: ${uploadMetrics.value.originalSizeMB}MB\n- Tamaño comprimido: ${uploadMetrics.value.compressedSizeMB}MB\n- Intentos: ${uploadMetrics.value.attempt}\n- Conexión: ${navigator.connection?.effectiveType || 'unknown'}`;
    } 
    
    const net = getNetworkSnapshot();

    const isFetchNetworkFail =
      (error instanceof TypeError) || /failed to fetch/i.test(error.message || '');

    const isTimeout = error.isTimeout || error.name === "AbortError";

    if (!net.online || isFetchNetworkFail || isTimeout) {
      const msg = buildBadNetworkMessage(net);

      uploadProgress.value = {
        stage: 'error',
        message: '⚠️ Señal demasiado débil para subir las capturas. Conéctate al Wi‑Fi del warehouse y reintenta.',
        percentage: 0
      };

      alert(msg);
      return;
    }

    else if (error.message.includes("fetch") || error.message.includes("network")) {
      errorMessage = "🌐 Error de conexión";
      debugInfo = `\n\n🔍 DEBUG:\n- Duración: ${uploadMetrics.value.duration}s\n- Intento: ${uploadMetrics.value.attempt}`;
    } else {
      errorMessage = `❌ ${error.message}`;
    }

    alert(errorMessage + debugInfo);

  } finally {
    isUploadingImages.value = false;
    
    setTimeout(() => {
      uploadProgress.value = { stage: '', message: '', percentage: 0 };
    }, 2000);
  }
}

// ============================================
// ✏️ SUBMIT CORRECTIONS (PRODUCCIÓN - MENSAJERO)
// ============================================

async function submitCorrections() {
  isProcessing.value = true;
  
  try {
    // 1. CORRECCIONES: Texto CRUDO (Lo que el usuario escribió)
    const corrections = needsConfirmation.value.map(item => ({
      stop_number: item.stop_number,
      field: item.field,
      value: correctionInputs.value[`${item.stop_number}_${item.field}`] || item.current_value 
    }));
    
    // 2. CONTEXTO: Rescate de apartamentos para paradas no tocadas
    const stopsPayload = extractedAddresses.value.map(addr => {
      // Intentamos preservar visualmente el apto para el contexto
      const rescueRegex = /\b(APT|UNIT|STE|SUITE|BLDG|LOT|#)\s*[\w-]+/i;
      const visualMatch = addr.address.match(rescueRegex);
      const rescuedApt = visualMatch ? visualMatch[0] : '';
      
      return {
        stop_number: addr.number,
        street_address: addr.address, // Enviamos todo junto
        apartment: rescuedApt,        // Enviamos lo rescatado
        city: '',
        ia_suggestion: addr.ia_suggestion,
        confidence: 0.8
      };
    });

    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    
    const response = await fetchWithAuth(`${backendUrl}/api/v1/ocr/amazon-stops/resolve-missing`, {
      method: 'POST',
      body: JSON.stringify({ stops: stopsPayload, corrections: corrections })
    });
    
    const result = await response.json();
    
    if (!result.success) throw new Error(result.error || 'Falló la aplicación de correcciones');

    // 3. RECIBIR Y MOSTRAR
    const mappedStops = result.stops.map(stop => {
      // Reconstruimos el string visual
      const parts = [stop.street_address];
      if (stop.apartment && !stop.street_address.includes(stop.apartment)) {
        parts.push(stop.apartment);
      }
      if (stop.city && !stop.street_address.includes(stop.city)) {
        parts.push(stop.city);
      }
      
      const fullAddress = parts.join(' ').replace(/\s+/g, ' ').trim();

      // Detección de apartamento basada en DATOS del backend + Respaldo visual
      const hasAptData = stop.apartment && stop.apartment.trim() !== '' && stop.apartment !== 'null';
      const hasAptRegex = /\b(APT|UNIT|STE|SUITE|BLDG|LOT|#)\b/i.test(fullAddress);

      return {
        number: stop.stop_number,
        address: fullAddress,
        isDowntown: false,
        isApartment: Boolean(hasAptData || hasAptRegex), 
        ia_suggestion: stop.ia_suggestion
      };
    });

    extractedAddresses.value = mappedStops;
    showCorrectionModal.value = false;
    isProcessing.value = false;
    
    // Check Downtown
    const needsDowntownCheck = showDowntownDetection();
    if (needsDowntownCheck) return;
    
    await proceedWithEvaluation();
    
  } catch (error) {
    console.error("Error aplicando correcciones:", error);
    alert(`Error: ${error.message}`);
    isProcessing.value = false;
  }
}
</script>

<template>
  <div class="view-container">
    <div class="uploader-container">

      <transition name="fade-slide">
        <div v-show="showInputForm" class="input-section-wrapper">

          <div class="block-info-card block-hero-card">
            <div class="block-hero-right" aria-hidden="true">
              <img class="block-hero-img" src="@/assets/block-hero.png" alt="" />
            </div>
            <div class="block-hero-left">
              <div class="block-hero-grid">
                <div class="hero-item hero-item--warehouse">
                  <div class="hero-label">Warehouse</div>
                  <div class="hero-value">{{ selectedWarehouseCode }}</div>
                </div>
                <div class="hero-item hero-item--date">
                  <div class="hero-label">Date</div>
                  <div class="hero-value">{{ blockData.fecha }}</div>
                </div>
                <div class="hero-item hero-item--start">
                  <div class="hero-label">Start Time</div>
                  <div class="hero-value">{{ blockData.hora }}</div>
                </div>
                <div class="hero-item hero-item--duration">
                  <div class="hero-label">Duration</div>
                  <div class="hero-value">{{ blockData.duracion_horas }}h</div>
                </div>
                <div class="hero-item hero-item--vehicle">
                  <div class="hero-label">Vehicle</div>
                  <div class="hero-value">{{ getVehicleNickname(blockData.vehiculo) }}</div>
                </div>
                <div class="hero-item hero-item--payment">
                  <div class="hero-label">Payment</div>
                  <div class="hero-value">${{ blockData.pago }}</div>
                </div>
              </div>
            </div>
          </div>
       
          <div class="ocr-upload-section ocr-cta-card">
            <div class="ocr-cta-header">
              <h3 class="ocr-cta-title">Sube tus capturas</h3>
              <p class="ocr-cta-subtitle">La IA hará el resto.</p>
            </div>
            
            <div class="ocr-cta-actions">
              <input type="file" ref="fileInputRef" accept="image/png,image/jpeg,image/jpg" multiple @change="handleImageSelection" style="display: none;" />
              <button type="button" class="ocr-cta-button" @click="fileInputRef?.click()" :disabled="isUploadingImages || isProcessing">
                Seleccionar capturas 📸
              </button>
               <div class="ocr-cta-meta">
                <span>PNG/JPG</span><span class="dot">•</span><span>OCR automático</span>
              </div>

              <div v-if="isUploadingImages || isProcessing || uploadProgress.stage !== ''" class="pro-status-card">
                  <div class="pro-status-top">
                    <div class="pro-status-dot"></div>
                    <div class="pro-status-text">
                      <div class="pro-status-title">{{ isUploadingImages ? 'Processing screenshots' : 'Evaluating route' }}</div>
                      <div class="pro-status-sub">
                        <span class="pro-status-phrase">{{ fancyLine }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="pro-status-bar">
                    <div class="pro-status-bar-fill" :style="{ width: (uploadProgress.percentage || 12) + '%' }"></div>
                  </div>
                </div>
          </div>

          <div v-if="selectedImages.length > 0" class="ocr-selected-wrap">
            <div class="ocr-cta-selected">
              <div class="selected-pill">{{ selectedImages.length }} seleccionadas</div>
              <button type="button" class="selected-clear" @click="clearImages">Limpiar</button>
            </div>
            <ul class="ocr-file-list">
              <li v-for="(file, index) in selectedImages" :key="index" class="ocr-file-item">
                <span class="ocr-file-name">{{ file.name }}</span>
                <span class="ocr-file-size">{{ (file.size / 1024).toFixed(1) }} KB</span>
              </li>
            </ul>
          </div>

          <div class="route-config-card">
            <h3>⚙️ Route Configuration</h3>
            <div class="controls-container">
              <div class="control-group">
                <label>Departure Point</label>
                <div class="warehouse-badge">
                  <span class="warehouse-code">{{ selectedWarehouseCode }}</span>
                </div>
              </div>
              <div class="control-group">
                <label for="destination-select">Final Destination</label>
                <select id="destination-select" v-model="selectedDestination" class="destination-select-compact">
                  <option v-for="dest in destinations" :key="dest.code" :value="dest.address">{{ dest.code }}</option>
                </select>
              </div>
            </div>
            <div v-if="selectedDestination === 'custom'" class="custom-input-container">
              <input type="text" v-model="customDestination" placeholder="Custom address" />
            </div>
          </div>

          <button @click="evaluateRoute" class="button-primary button-evaluate"
              :disabled="(isProcessing || isUploadingImages) || (selectedImages.length === 0)">
              {{ isUploadingImages ? 'Processing...' : '🚀 Evaluate' }}
          </button>

          </div>
        </div>
      </transition>

      <div v-if="!showInputForm && backendResponse" class="edit-bar">
        <div class="edit-bar-left">
          <button @click="showQuickSettingsModal = true" class="btn-edit-inputs">Edit Inputs</button>
        </div>
        <div class="mini-summary">
          <span>{{ extractedAddresses.length }} stops</span>
          <span class="separator">•</span>
          <span>${{ blockData.pago }}</span>
        </div>
      </div>

      <transition name="modal-fade">
        <div v-if="showQuickSettingsModal" class="modal-overlay" @click.self="showQuickSettingsModal = false">
          <div class="modal-container quick-settings-modal">
            <div class="modal-header">
              <h3>Quick Adjustments</h3>
              <button @click="showQuickSettingsModal = false" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="label-with-button">
                  <span>🏢 Warehouse Delay (min)</span>
                  <button @click.prevent="calculateActualDelay" class="button-tertiary">Now</button>
                </label>
                <input type="number" v-model.number="blockData.retraso_almacen" step="5" class="input-lg">
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showQuickSettingsModal = false" class="button-primary w-full">✅ Apply</button>
            </div>
          </div>
        </div>
      </transition>

      <div v-if="extractedAddresses.length > 0 && backendResponse && !isProcessing">
         <SlideContainer 
            v-if="normalPayload"
            :normalPayload="normalPayload"
            :inversePayload="inversePayload"
            @save-route="saveToLogbook"
          />
      </div>

    </div>

    <div v-if="showCorrectionModal" class="modal-overlay">
      <div class="modal-content correction-modal-content">
        <div class="modal-header">
          <h3 class="text-xl font-bold text-white">
            <span class="text-orange-500">⚠️</span> Verificar Direcciones
          </h3>
          <p class="text-sm text-gray-400 mt-1">
            Gemini tiene dudas en {{ needsConfirmation.length }} paradas.
          </p>
        </div>
        
        <div class="modal-body">
          <div v-for="(item, index) in needsConfirmation" :key="index" class="correction-item p-4 rounded-xl bg-gray-800/50 border border-gray-700 mb-4">
            <div class="flex justify-between items-center mb-3">
              <span class="font-bold text-orange-400">#{{ item.stop_number }} {{ item.field }}</span>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-xs uppercase text-gray-500 block">Detectado</label>
                <div class="bg-gray-900/50 p-3 rounded-lg text-gray-300 text-sm font-mono border border-red-900/30">
                  {{ item.current_value }}
                </div>
              </div>
              <div>
                <label class="text-xs uppercase text-orange-300 block">Corrección</label>
                <input type="text" v-model="correctionInputs[`${item.stop_number}_${item.field}`]" :placeholder="item.current_value"
                  class="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white">
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer flex justify-end gap-3 bg-gray-900/50 p-4 border-t border-gray-800">
          <button @click="showCorrectionModal = false" class="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-300">Cancelar</button>
          <button @click="submitCorrections" class="px-5 py-2.5 rounded-lg bg-orange-600 text-white font-bold">Confirmar</button>
        </div>
      </div>
    </div>

    <div v-if="showDowntownModal" class="modal-overlay downtown-modal">
      <div class="modal-content downtown-modal-content">
        <div class="modal-header">
          <h3 class="text-xl font-bold text-white flex items-center">
            <span class="text-blue-400 text-2xl mr-2">🏙️</span> Detección Downtown
          </h3>
          <p class="text-sm text-gray-400 mt-2">
            Detectados <span class="text-blue-400 font-bold">{{ orlandoApartments.length }} apartamentos</span>.
          </p>
        </div>
        
        <div class="modal-body py-4">
          <div class="bg-blue-900/20 p-3 rounded-lg mb-4 flex items-center border border-blue-900/50">
            <label class="inline-flex items-center cursor-pointer w-full">
              <input type="checkbox" v-model="areAllDowntownSelected" class="form-checkbox h-5 w-5 text-blue-500 bg-gray-900 border-gray-700 rounded">
              <span class="ml-3 text-white font-bold">Seleccionar Todos</span>
            </label>
          </div>

          <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            <div v-for="stop in orlandoApartments" :key="stop.number" 
              class="downtown-item flex items-start p-3 rounded-lg hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-700"
              :class="{ 'bg-blue-900/10 border-blue-900/30': downtownSelection[stop.number] }">
              <div class="flex h-6 items-center">
                <input type="checkbox" v-model="downtownSelection[stop.number]" class="form-checkbox h-5 w-5 text-blue-500 bg-gray-900 border-gray-700 rounded">
              </div>
              <div class="ml-3 text-sm">
                <label class="font-bold text-white block">Parada #{{ stop.number }}</label>
                <p class="text-gray-400 font-mono text-xs mt-1">{{ stop.address }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer flex justify-end gap-3 bg-gray-900/50 p-4 border-t border-gray-800">
          <button @click="skipDowntownSelection" class="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-300">Omitir</button>
          <button @click="confirmDowntownSelection" class="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold">Confirmar</button>
        </div>
      </div>
    </div>

    <div v-if="isBusy" class="busy-overlay" @click.stop>
      <div class="busy-card pro-busy">
        <div class="pro-busy-top">
          <div class="pro-busy-spinner" />
          <div class="pro-busy-text">
            <h3 class="busy-title">{{ busyTitle }}</h3>
            <p class="pro-busy-line">{{ fancyLine }}</p>
          </div>
        </div>
        <div class="pro-busy-bar">
          <div class="pro-busy-bar-fill" :style="{ width: (uploadProgress.percentage || 12) + '%' }" />
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ESTILOS PRESERVADOS (DARK MODE COMPLETO) */
.view-container { margin-top: 20px; font-family: sans-serif; color: white; }
.uploader-container { width: 100%; max-width: 600px; margin: 0 auto; }

/* MODALES DARK */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: #111827; border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); width: 100%; max-width: 600px; overflow: hidden; }
.modal-header, .modal-body, .modal-footer { padding: 1.5rem; }
.downtown-item { cursor: pointer; }

/* HERO CARDS */
.block-hero-card { background: linear-gradient(135deg, rgba(18,28,46,0.92), rgba(10,15,24,0.92)); border-radius: 22px; padding: 14px; position: relative; overflow: hidden; min-height: 220px; margin-bottom: 20px; }
.block-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; z-index: 2; position: relative; }
.hero-label { font-size: 10px; text-transform: uppercase; opacity: 0.7; }
.hero-value { font-size: 15px; font-weight: bold; }

/* OCR CARD */
.ocr-cta-card { background: radial-gradient(1200px 500px at 20% 0%, rgba(255,170,0,0.2), transparent 55%), linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.9)); border-radius: 22px; padding: 18px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 20px; }
.ocr-cta-title { font-size: 1.45rem; font-weight: 800; margin: 0; }
.ocr-cta-button { width: 100%; padding: 14px; border-radius: 16px; font-weight: 800; background: linear-gradient(135deg, #ffb000, #ff8a00); border: none; color: #111; cursor: pointer; margin-top: 10px; }

/* SPINNERS & BARS */
.pro-busy-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; margin-top: 10px; }
.pro-busy-bar-fill { height: 100%; background: #ffb000; transition: width 0.3s; }
.busy-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.busy-card { background: #1f2937; padding: 20px; border-radius: 16px; width: 300px; text-align: center; border: 1px solid rgba(255,255,255,0.1); }

/* SCROLLBAR */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
</style>
<script setup>
// ============================================
// 1. IMPORTS
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

function detectOrlandoApartments() {
  console.log("🕵️‍♂️ Ejecutando detectOrlandoApartments...");
  if (!extractedAddresses.value) throw new Error("extractedAddresses es undefined");
  
  return extractedAddresses.value.filter((stop, index) => {
    // Debug por parada para encontrar datos corruptos
    try {
      return stop.address && stop.isApartment && isInOrlando(stop.address);
    } catch (e) {
      console.error(`Error en parada ${index}:`, e);
      return false;
    }
  });
}

function showDowntownDetection() {
  console.log("🕵️‍♂️ Ejecutando showDowntownDetection...");
  try {
    // 1. Probar detección
    const apartments = detectOrlandoApartments();
    console.log(`🏢 Apartamentos detectados: ${apartments.length}`);

    if (apartments.length === 0) {
      return false; // Todo limpio
    }
    
    // 2. Probar asignación de variables reactivas (Posible punto de falla)
    if (!orlandoApartments) throw new Error("Variable 'orlandoApartments' no existe");
    if (!downtownSelection) throw new Error("Variable 'downtownSelection' no existe");
    if (!showDowntownModal) throw new Error("Variable 'showDowntownModal' no existe");

    orlandoApartments.value = apartments;
    downtownSelection.value = {};
    apartments.forEach(apt => {
      downtownSelection.value[apt.number] = false;
    });
    
    showDowntownModal.value = true;
    return true; // Se requiere modal

  } catch (error) {
    // 🚨 AQUÍ CAPTURAMOS EL ERROR SILENCIOSO
    alert(`💥 CRASH EN DETECCIÓN: ${error.message}`);
    console.error("Crash Detection:", error);
    return false; // Asumimos que no hay downtown para no bloquear
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
// 🆕 OCR: ENVIAR CORRECCIONES //
// ============================================
async function submitCorrections() {
  console.log('✏️ Enviando correcciones al backend...');
  isProcessing.value = true;
  
  try {
    // 1. Construir array de correcciones
    const corrections = needsConfirmation.value.map(item => {
      const key = `${item.stop_number}_${item.field}`;
      const userValue = correctionInputs.value[key];
      
      return {
        stop_number: item.stop_number,
        field: item.field,
        value: userValue || item.current_value // Si usuario no puso nada, usar el valor actual
      };
    });
    
    console.log('📝 Correcciones:', corrections);
    
    // 2. Llamar al endpoint de correcciones
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetchWithAuth(`${backendUrl}/api/v1/ocr/amazon-stops/resolve-missing`, {
      method: 'POST',
      body: JSON.stringify({
        stops: extractedAddresses.value.map(addr => ({
          stop_number: addr.number,
          street_address: addr.address.split(' ').slice(0, -1).join(' ') || addr.address,
          apartment: '',
          city: addr.address.split(' ').pop() || '',
          ia_suggestion: addr.ia_suggestion,
          confidence: 0.8
        })),
        corrections: corrections
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error aplicando correcciones');
    }
    
    const result = await response.json();
    console.log('✅ Correcciones aplicadas:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Falló la aplicación de correcciones');
    }
    
    // 3. Actualizar extractedAddresses con el JSON corregido
    extractedAddresses.value = result.stops.map(stop => ({
      number: stop.stop_number,
      address: [stop.street_address, stop.apartment, stop.city]
        .filter(Boolean)
        .join(' ')
        .trim(),
      isDowntown: false,
      isApartment: stop.apartment && stop.apartment.trim() !== '',
      ia_suggestion: stop.ia_suggestion
    }));
    
    console.log('✅ Direcciones actualizadas con correcciones');
    
    // 4. Cerrar modal
    showCorrectionModal.value = false;
    isProcessing.value = false;
    
    // 5. Continuar con flujo normal (downtown check)
    const needsDowntownCheck = showDowntownDetection();
    if (needsDowntownCheck) {
      return;
    }
    
    // Si no hay downtown, proceder con evaluación
    await proceedWithEvaluation();
    
  } catch (error) {
    console.error('❌ Error aplicando correcciones:', error);
    alert(`❌ Error: ${error.message}`);
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
            <!-- Fondo: imagen a full -->
            <div class="block-hero-right" aria-hidden="true">
              <img class="block-hero-img" src="@/assets/block-hero.png" alt="" />
            </div>

            <!-- Panel flotante: datos -->
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
              <h3 class="ocr-cta-title">Sube tus capturas y listo</h3>
              <p class="ocr-cta-subtitle">La Inteligencia Artificial hará el resto.</p>
            </div>
            
            <div class="ocr-cta-actions">
              <input
                type="file"
                ref="fileInputRef"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                @change="handleImageSelection"
                style="display: none;"
              />

              <button
                type="button"
                class="ocr-cta-button"
                @click="fileInputRef?.click()"
                :disabled="isUploadingImages || isProcessing"
              >
                Seleccionar capturas 📸
              </button>

               <div class="ocr-cta-meta">
                <span>PNG/JPG</span>
                <span class="dot">•</span>
                <span>OCR automático</span>
                <span class="dot">•</span>
                <span>Resultados en segundos</span>
              </div>

              <!-- Animación “Crunching… / Analyzing…” -->
              <div v-if="isUploadingImages || isProcessing || uploadProgress.stage !== ''" class="pro-status-card">
                  <div class="pro-status-top">
                    <div class="pro-status-dot"></div>

                    <div class="pro-status-text">
                      <div class="pro-status-title">
                        {{ isUploadingImages ? 'Processing screenshots' : 'Evaluating route' }}
                      </div>

                      <div class="pro-status-sub">
                        <span class="pro-status-phrase">{{ fancyLine }}</span>
                        <span v-if="uploadProgress.message" class="pro-status-hint">— {{ uploadProgress.message }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="pro-status-bar">
                    <div
                      class="pro-status-bar-fill"
                      :style="{ width: (uploadProgress.percentage || 12) + '%' }"
                      :class="{
                        uploading: uploadProgress.stage === 'uploading',
                        processing: uploadProgress.stage === 'processing',
                        retrying: uploadProgress.stage === 'retrying',
                        complete: uploadProgress.stage === 'complete',
                        error: uploadProgress.stage === 'error'
                      }"
                    />
                  </div>

                  <div v-if="uploadMetrics.imageCount" class="pro-status-meta">
                    {{ uploadMetrics.imageCount }} imágenes · {{ uploadMetrics.originalSizeMB || uploadMetrics.totalSizeMB }} MB · intento {{ uploadMetrics.attempt || 1 }}
                  </div>
                </div>

              
          </div>

          <div v-if="selectedImages.length > 0" class="ocr-selected-wrap">

          <div class="ocr-cta-selected">
            <div class="selected-pill">
              {{ selectedImages.length }} seleccionadas
            </div>

            <button type="button" class="selected-clear" @click="clearImages">
              Limpiar
            </button>
          </div>

          <!-- 🆕 BANNER DE COMPRESIÓN (igual que el tuyo) -->
          <div v-if="uploadMetrics.compressedSizeMB > 0" class="compression-banner">
            <div class="compression-stats">
              <div class="stat-item">
                <span class="stat-label">📦 Original:</span>
                <span class="stat-value">{{ uploadMetrics.originalSizeMB }} MB</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">✅ Comprimido:</span>
                <span class="stat-value">{{ uploadMetrics.compressedSizeMB }} MB</span>
              </div>
              <div class="stat-item highlight">
                <span class="stat-label">🎉 Ahorro:</span>
                <span class="stat-value">
                  {{(((uploadMetrics.originalSizeMB - uploadMetrics.compressedSizeMB) / uploadMetrics.originalSizeMB) * 100).toFixed(1)}}%
                </span>
              </div>
            </div>
          </div>

          <!-- ✅ LISTA PREMIUM (sin bullets + truncado) -->
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
              <!-- Departure Point: FIJO (badge) -->
              <div class="control-group">
                <label>Departure Point</label>
                <div class="warehouse-badge">
                  <span class="warehouse-code">{{ selectedWarehouseCode }}</span>
                  <span class="warehouse-miles">({{ warehouses.find(w => w.code === selectedWarehouseCode)?.commuteMiles || 0 }} mi)</span>
                </div>
              </div>

              <!-- Final Destination: SELECT mejorado -->
              <div class="control-group">
                <label for="destination-select">Final Destination</label>
                <select 
                  id="destination-select" 
                  v-model="selectedDestination"
                  class="destination-select-compact"
                >
                  <option 
                    v-for="dest in destinations" 
                    :key="dest.code" 
                    :value="dest.address"
                  >
                    {{ dest.code }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Custom input (si elige "Otro") -->
            <div v-if="selectedDestination === 'custom'" class="custom-input-container">
              <input 
                type="text" 
                v-model="customDestination" 
                placeholder="Enter custom destination address"
              />
            </div>
          </div>

          </div>

          <div class="json-input-card">
            <details class="json-legacy-details json-legacy-details--stealth">
              <summary>JSON manual (legacy)</summary>

              <textarea 
                v-model="jsonInput" 
                placeholder="Paste the JSON from the Gem here."
                rows="10"
                class="json-textarea"
                :disabled="isProcessing || extractedAddresses.length > 0"
              ></textarea>
            </details>

            <div v-if="extractedAddresses.length > 0" class="stops-detected">
              ✅ {{ extractedAddresses.length }} stops detected
            </div>

            <!-- ✅ Modal downtown queda fuera del details (para no depender del toggle) -->
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

            <!-- ✅ Evaluate siempre visible -->
            <button 
              @click="evaluateRoute" 
              class="button-primary button-evaluate"
              :disabled="(isProcessing || isUploadingImages) || (!jsonInput.trim() && extractedAddresses.length === 0 && selectedImages.length === 0)"
            >
              {{ isUploadingImages ? '🤖 Processing Images...' : (isProcessing ? 'Evaluating...' : '🚀 Evaluate Scenarios') }}
            </button>
          </div>
        </div>
      </transition>
      <div v-if="!showInputForm && reportData" class="edit-bar">
        <div class="edit-bar-left">
          <button @click="showQuickSettingsModal = true" class="btn-edit-inputs">
            Edit Inputs
          </button>
        </div>
        <div class="mini-summary">
          <span>{{ extractedAddresses.length }} stops</span>
          <span class="separator">•</span>
          <span>{{ blockData.hora }} Start</span>
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



      <div v-if="backendResponse && backendResponse.status === 'loading'" class="backend-status">Evaluating scenarios...</div>

      <div v-if="extractedAddresses.length > 0 && backendResponse && !isProcessing && reportData && normalPayload.pago">
        
        <div class="results-container-slides">
          <!--
          <div class="results-header" style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <h3>📊 Route Analysis</h3>
            <button 
              @click="mostrarDetalles = !mostrarDetalles" 
              class="text-xs text-gray-500 underline"
            >
              {{ mostrarDetalles ? 'Hide Debug' : 'Show Debug' }}
            </button>
          </div>
          -->
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

    <!-- ============================================
     🆕 MODAL DE CORRECCIONES OCR
     ============================================ -->
    <div v-if="showCorrectionModal" class="modal-overlay" @click.self="showCorrectionModal = false">
      <div class="modal-content correction-modal">
        <div class="modal-header">
          <h2>✏️ Completar Información</h2>
          <p class="modal-subtitle">
            Gemini necesita que completes algunos datos que no pudo leer claramente en las capturas.
          </p>
        </div>

        <div class="modal-body">
          <div 
            v-for="item in needsConfirmation" 
            :key="`${item.stop_number}_${item.field}`"
            class="correction-item"
          >
            <div class="correction-header">
              <span class="stop-badge">Parada {{ item.stop_number }}</span>
              <span class="field-badge">{{ item.field === 'street_address' ? 'Dirección' : (item.field === 'apartment' ? 'Apartamento' : 'Ciudad') }}</span>
            </div>

            <div class="correction-reason">
              <span v-if="item.reason === 'TRUNCATED_TEXT'">📋 Texto truncado detectado</span>
              <span v-else-if="item.reason === 'LOW_CONFIDENCE'">⚠️ Baja confianza ({{ Math.round(item.confidence * 100) }}%)</span>
              <span v-else-if="item.reason === 'MISSING_CITY'">🏙️ Ciudad no detectada</span>
            </div>

            <div class="correction-current">
              <strong>Valor actual:</strong> 
              <code>{{ item.current_value || '(vacío)' }}</code>
            </div>

            <div class="correction-input">
              <label :for="`correction_${item.stop_number}_${item.field}`">
                Valor correcto:
              </label>
              <input 
                :id="`correction_${item.stop_number}_${item.field}`"
                type="text"
                v-model="correctionInputs[`${item.stop_number}_${item.field}`]"
                :placeholder="`Ej: ${item.field === 'street_address' ? '1234 MAIN ST APT 202' : (item.field === 'apartment' ? 'APT 101' : 'KISSIMMEE')}`"
              />
              <small class="input-hint">
                💡 Tip: Copia la dirección completa desde la app de Amazon Flex
              </small>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button 
            type="button"
            class="button-secondary"
            @click="showCorrectionModal = false"
          >
            ❌ Cancelar
          </button>
          <button 
            type="button"
            class="button-primary"
            @click="submitCorrections"
            :disabled="isProcessing"
          >
            {{ isProcessing ? '⏳ Procesando...' : '✅ Confirmar y Continuar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="isBusy" class="busy-overlay" @click.stop>
      <div class="busy-card pro-busy" role="dialog" aria-modal="true">
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

        <p class="busy-hint">
          Por favor no cierres la app ni regreses. Esto puede tardar unos segundos.
        </p>
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
    .controls-container { 
      display: flex; 
      justify-content: space-between; 
      gap: var(--space-3); 
      margin-top: var(--space-2); 
      padding: var(--space-3); 
      background-color: var(--color-surface); 
      border: 1px 
      solid var(--color-border); 
      border-radius: 8px; 
    }
    .control-group { flex: 1; display: flex; flex-direction: column; }
    .control-group label { 
      margin-bottom: 6px; 
      font-weight: var(--font-semibold);
      font-size: 11px; 
      color: var(--color-text-secondary); 
    } 
    /* Select inherits global dark style */

    .custom-input-container { 
      margin: 8px 0 0 0; 
    }
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

    /* Primary CTA (Log Normal Route) */
    .button-save-log {
      display: block;
      width: 100%;

      padding: 14px 16px;
      border-radius: 14px;

      border: 1px solid rgba(255,165,0,0.40);
      background: var(--brand-primary);
      color: #111; /* o var(--color-black) si lo usas global */

      font-size: 1.05rem;
      font-weight: 900;
      letter-spacing: 0.2px;

      cursor: pointer;
      transition: transform 0.15s ease, filter 0.15s ease, opacity 0.15s ease;
      margin-top: 14px;
    }

    .button-save-log:hover {
      filter: brightness(1.02);
    }

    .button-save-log:active {
      transform: scale(0.99);
    }

    /* Disabled (una sola regla ✅) */
    .button-save-log:disabled {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.10);
      color: rgba(255,255,255,0.45);
      cursor: not-allowed;
      opacity: 0.9;
    }

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

/* ✅ COMPACT HEADER MODE (Block Details + Route Configuration) */

/* Block Details */
.block-info-card{
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.block-info-card h2{
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  line-height: 1.1;
}

.block-info-grid{
  gap: var(--space-2);
  grid-template-columns: repeat(2, 1fr);
}

.info-item{
  gap: 2px;
}

.info-label{
  font-size: 10px; /* súper compacto */
  letter-spacing: 0.08em;
}

.info-value{
  font-size: var(--text-base);
  line-height: 1.1;
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

/* Route Configuration */
.route-config-card{
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.route-config-card h3{
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-base);
  line-height: 1.1;
}

/* Warehouse Badge (fijo, compacto) */
.warehouse-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(255, 165, 0, 0.15) 0%, rgba(255, 165, 0, 0.05) 100%);
  border: 1.5px solid rgba(255, 165, 0, 0.35);
  border-radius: 10px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0; /* Permite que se comprima */
}

.warehouse-code {
  font-size: 0.95em;
  color: var(--brand-primary);
  white-space: nowrap;
}

.warehouse-miles {
  font-size: 0.85em;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Select de destino compacto (SIN flecha nativa) */
.destination-select-compact {
  width: 100%;
  max-width: 100%;
  padding: 8px 10px;
  font-size: 0.9em;
  border: 1.5px solid var(--border-primary);
  border-radius: 10px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  
  /* Previene que el texto se salga */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  /* 🔥 OCULTAR LA FLECHA NATIVA */
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  
  /* Prevenir que aparezca en IE/Edge */
  background-image: none;
}

/* Ocultar flecha en IE/Edge (fallback) */
.destination-select-compact::-ms-expand {
  display: none;
}

.destination-select-compact:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(255, 165, 0, 0.15);
}

.destination-select-compact:hover {
  border-color: var(--brand-primary);
}


/* Ajustar el grid para que sea más compacto */
.controls-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px; /* Reducido de 16px */
  margin-top: 12px;
}

.control-group label {
  display: block;
  font-size: 0.85em; /* Más pequeño */
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px; /* Reducido */
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

  padding: 10px 12px;              /* ✅ antes 15px 20px */
  background: rgba(255,255,255,0.04);
  border-radius: 14px;
  margin-bottom: 12px;             /* ✅ antes 20px */
  box-shadow: none;                /* ✅ quita sombra grande */
  border: 1px solid var(--border-primary);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Botón compacto tipo "chip button" */
.btn-edit-inputs {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,165,0,0.35);
  color: var(--brand-primary);

  padding: 6px 10px;
  border-radius: 12px;

  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.2px;
  line-height: 1;

  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.btn-edit-inputs:active {
  transform: scale(0.98);
}

.btn-edit-inputs:hover {
  background: rgba(255,165,0,0.10);
  border-color: rgba(255,165,0,0.55);
}

/* Mini summary como chips */
.mini-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;

  font-size: 0.72rem;      /* ✅ más pequeño */
  font-weight: 700;
  color: var(--text-secondary);

  white-space: nowrap;     /* ✅ 1 sola línea */
  overflow: hidden;
  text-overflow: ellipsis; /* ✅ si no cabe, recorta */
  max-width: 62%;
}

.mini-summary .separator {
  opacity: 0.25;
}

/* Mobile: permitir wrap sin aumentar tanto la altura */
@media (max-width: 420px) {
  .edit-bar {
    padding: 10px 10px;
    gap: 10px;
  }

  .mini-summary {
    flex-wrap: wrap;
    justify-content: flex-end;
    row-gap: 6px;
  }
}

@media (max-width: 380px) {
  .mini-summary {
    max-width: 58%;
    font-size: 0.68rem;
    gap: 5px;
  }
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

/* ============================================
   🆕 OCR: ESTILOS
   ============================================ */
/* ✅ OCR CTA Card (premium) */
.ocr-cta-card{
  border-radius: 22px;
  padding: 18px 18px 16px;
  margin-bottom: 20px;

  background: radial-gradient(1200px 500px at 20% 0%, rgba(255, 170, 0, 0.20), transparent 55%),
              linear-gradient(135deg, rgba(15,23,42,0.92), rgba(2,6,23,0.92));
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 35px rgba(0,0,0,0.35);
}

.ocr-cta-header{
  margin-bottom: 14px;
}

.ocr-cta-title{
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.15;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.4px;
}

.ocr-cta-subtitle{
  margin: 8px 0 0;
  font-size: 1rem;
  color: rgba(248,250,252,0.70);
  line-height: 1.35;
}

.ocr-cta-actions{
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ocr-cta-button{
  width: 100%;
  border: none;
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;

  background: linear-gradient(135deg, #ffb000, #ff8a00);
  color: #111827;

  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  box-shadow: 0 10px 24px rgba(255, 170, 0, 0.25);
}

.ocr-cta-button:active{
  transform: scale(0.99);
}

.ocr-cta-button:disabled{
  opacity: 0.7;
  cursor: not-allowed;
  filter: grayscale(0.15);
}

.ocr-cta-meta{
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 0.85rem;
  color: rgba(248,250,252,0.65);
}

.ocr-cta-meta .dot{
  opacity: 0.35;
}

.ocr-cta-selected{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}

.selected-pill{
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(248,250,252,0.90);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
}

.selected-clear{
  padding: 8px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.18);
  color: rgba(248,250,252,0.90);
  font-weight: 700;
  cursor: pointer;
}



.divider {
  text-align: center;
  margin: 24px 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: #ddd;
}

.divider span {
  background: white;
  padding: 0 16px;
  position: relative;
  color: #666;
  font-weight: 600;
}

.json-input-section h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.json-description {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
}

/* ============================================
   🆕 MODAL DE CORRECCIONES
   ============================================ */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-header {
  padding: 24px;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 24px;
}

.modal-subtitle {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.correction-item {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.correction-item:last-child {
  margin-bottom: 0;
}

.correction-header {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.stop-badge {
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.field-badge {
  background: #764ba2;
  color: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.correction-reason {
  font-size: 13px;
  color: #856404;
  background: #fff3cd;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.correction-current {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
}

.correction-current code {
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #d73a49;
}

.correction-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.correction-input label {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.correction-input input {
  padding: 10px 12px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.correction-input input:focus {
  outline: none;
  border-color: #667eea;
}

.input-hint {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 2px solid #f0f0f0;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.button-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.button-secondary:hover {
  background: #5a6268;
}
.upload-progress {
  margin: 16px 0;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-uploading {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  animation: pulse 1.5s ease-in-out infinite;
}

.progress-processing {
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
}

.progress-retrying {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.progress-complete {
  background: linear-gradient(90deg, #10b981, #34d399);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.progress-message {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.progress-details {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

/* 🆕 BANNER DE COMPRESIÓN */
.compression-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.compression-stats {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: white;
}

.stat-item.highlight .stat-value {
  font-size: 24px;
  color: #ffd700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Responsive */
@media (max-width: 600px) {
  .compression-stats {
    flex-direction: column;
    gap: 12px;
  }
  
  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }
}
.progress-error {
  background: linear-gradient(90deg, #ef4444, #f97316);
}

.busy-overlay{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.68);
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  touch-action: none; /* evita gestos raros mientras corre */
}

.busy-card{
  width: min(420px, 100%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  padding: 16px;
  text-align: center;
}

.busy-title{
  margin: 0 0 6px 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.busy-hint{
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.busy-spinner{
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(255,255,255,0.18);
  border-top-color: var(--brand-primary);
  margin: 0 auto 12px auto;
  animation: busySpin 0.9s linear infinite;
}

@keyframes busySpin{
  to { transform: rotate(360deg); }
}

/* ✅ JSON legacy collapsible */
.json-legacy-details{
  width: 100%;
}

.json-legacy-details summary{
  padding: var(--space-3);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  list-style: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  user-select: none;
  cursor: pointer;
}

.json-legacy-details summary:hover{
  color: var(--brand-primary);
}

.json-legacy-details summary::-webkit-details-marker{
  display: none;
}

/* Flechita */
.json-legacy-details summary::before{
  content: "▶";
  font-size: var(--text-xs);
  transition: transform var(--transition-fast);
}

.json-legacy-details[open] summary::before{
  transform: rotate(90deg);
}

.json-legacy-title{
  margin: var(--space-3) 0 var(--space-3) 0;
}

/* ✅ JSON legacy “stealth” */
.json-legacy-details--stealth summary{
  padding: 4px 0;
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  opacity: 0.55;
  justify-content: flex-end;
}

.json-legacy-details--stealth summary:hover{
  opacity: 0.9;
  color: var(--brand-primary);
}

/* Quita flecha grande para que no llame la atención */
.json-legacy-details--stealth summary::before{
  content: "";
}

/* Cuando abre, que el textarea no se pegue al summary */
.json-legacy-details--stealth[open] .json-textarea{
  margin-top: var(--space-3);
}

/* 🔧 HOTFIX Route Configuration: compactar */
.route-config-card{
  padding: var(--space-4) !important;
  margin-bottom: var(--space-3) !important;
}

.controls-container{
  padding: var(--space-3) !important;
  gap: var(--space-3) !important;
}

/* Si tus selects usan otra clase, dime cuál y lo ajusto exacto */
.control-group select,
.control-group input{
  padding: 10px 12px !important;
  border-radius: 12px !important;
}

/* ✅ Audible-like Card System */
.aud-card{
  background: var(--bg-secondary);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
}

/* Mini card arriba (Block Details) */
.block-info-card{
  background: var(--bg-secondary) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-radius: 18px !important;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35) !important;

  padding: 14px !important;
  margin-bottom: 12px !important;
}

.block-info-card h2{
  font-size: 18px !important;
  margin: 0 0 10px 0 !important;
  line-height: 1.1 !important;
}

/* Grid real (evita que vuelva a “lista rara”) */
.block-info-grid{
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 10px 14px !important;
}

.info-item{
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
}

.info-label{
  font-size: 10px !important;
  opacity: 0.75 !important;
  letter-spacing: 0.10em !important;
}

.info-value{
  font-size: 15px !important;
  line-height: 1.15 !important;
}

/* Route Configuration: más discreta */
.route-config-card{
  background: var(--bg-secondary) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-radius: 18px !important;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35) !important;

  padding: 14px !important;
  margin-bottom: 12px !important;
}

.route-config-card h3{
  margin: 0 0 10px 0 !important;
  font-size: 16px !important;
  line-height: 1.1 !important;
}

/* Controles más compactos (los select se ven grandes hoy) */
.controls-container{
  padding: 10px !important;
  gap: 10px !important;
}

.control-group label{
  font-size: 11px !important;
  margin-bottom: 6px !important;
  opacity: 0.85 !important;
}

.control-group select,
.control-group input{
  padding: 10px 12px !important;
  border-radius: 14px !important;
}

/* ✅ Route settings dentro de OCR card */
.route-settings{
  margin-top: 12px;
  width: 100%;
}

.route-settings summary{
  list-style: none;
  cursor: pointer;
  user-select: none;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.16);
  font-weight: 700;
}

.route-settings summary::-webkit-details-marker{
  display: none;
}

/* Flecha discreta */
.route-settings summary::after{
  content: "▾";
  opacity: 0.9;
  transform: translateY(-1px);
}

.route-settings[open] summary::after{
  content: "▴";
}

/* Embedded card: sin sombras enormes dentro de otra card */
.route-config-card--embedded{
  margin-top: 10px !important;
  margin-bottom: 0 !important;
  box-shadow: none !important;
  background: rgba(0,0,0,0.22) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
}

/* ✅ Header estilo “slide” reutilizable */
.card-header{
  margin: 0 0 var(--slide-header-mb) 0;
}

.card-title{
  margin: 0;
  font-size: var(--slide-title-size);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.2px;
}

.card-subtitle{
  margin: 6px 0 0 0;
  font-size: var(--slide-subtitle-size);
  opacity: 0.82;
  line-height: 1.3;
}

/* ✅ Ya no dependemos del h3 dentro de OCR */
.ocr-upload-section h3{
  margin: 0; /* neutraliza reglas viejas */
}

/* ✅ Block Hero Card */
.block-hero-card{
  position: relative;
  padding: 0 !important;
  overflow: hidden;
  min-height: 220px; /* 🔥 para que el fondo se luzca */
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(18,28,46,0.92), rgba(10,15,24,0.92)) !important;
}

.block-hero-right{
  position: absolute;
  inset: 0;
  z-index: 0;
}


.block-hero-img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  display: block;
  opacity: 0.98;
}
.block-hero-grid{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;

  /* 🔥 control total de posiciones */
  grid-template-areas:
    "warehouse date"
    "start    duration"
    "payment  vehicle";
}

/* asignación de áreas */
.hero-item--warehouse { grid-area: warehouse; }
.hero-item--date      { grid-area: date; }
.hero-item--start      { grid-area: start; }
.hero-item--duration   { grid-area: duration; }
.hero-item--payment    { grid-area: payment; }
.hero-item--vehicle    { grid-area: vehicle; }

.hero-label{
  font-size: 10px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  opacity: 0.75;
}

.hero-value{
  font-size: 15px;
  line-height: 1.15;
  font-weight: 700;
}

.block-hero-right{
  position: relative;
  min-height: 150px;
}

.block-hero-img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  display: block;
  opacity: 0.95;
}

.hero-value, .hero-label{
  text-shadow: 0 2px 10px rgba(0,0,0,0.55);
}

/* Oscurece un poco la zona izquierda para que el texto resalte */
.block-hero-right::after{
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(0,0,0,0.55) 0%,
    rgba(0,0,0,0.20) 60%,
    rgba(0,0,0,0.05) 100%
  );
  pointer-events: none;
}

/* Panel flotante */
.block-hero-left{
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 1;
  width: min(72%, 320px);
  padding: 14px;
  border-radius: 16px;

  background: transparent;
  border: none; /* opcional */
  backdrop-filter: none; /* opcional */
  -webkit-backdrop-filter: none; /* opcional */
}


/* ✅ Panel semi-transparente SOLO detrás del texto (no afecta las letras) */
.block-hero-left::before{
  content: "";
  position: absolute;
  inset: 10px; /* margen interno para que se vea elegante */
  background: rgba(8, 12, 20, 0.50); /* <-- 50% */
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: -1; /* queda detrás del texto */
}

/* Overlay sutil para integrar la imagen con el card */
.block-hero-right::before{
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 40% 40%, rgba(0,255,255,0.10), transparent 55%);
  pointer-events: none;
}



/* ✅ Apaga el panel oscuro que viene del ::before */
.block-hero-left::before{
  content: none !important;
  background: transparent !important;
}
/* Wrap para separar visualmente la sección de “archivos seleccionados” */
.ocr-selected-wrap{
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

/* ✅ Lista premium */
.ocr-file-list{
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ocr-file-item{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}

.ocr-file-name{
  flex: 1;
  min-width: 0;
  color: rgba(248,250,252,0.92);
  font-weight: 650;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ocr-file-size{
  color: rgba(248,250,252,0.60);
  font-size: 0.85rem;
  white-space: nowrap;
}
.pro-status-card{
  margin: 16px 0;
  padding: 14px 14px 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.pro-status-top{
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.pro-status-dot{
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 999px;
  background: #ffb000;
  box-shadow: 0 0 0 6px rgba(255,176,0,0.12);
  animation: proPulse 1.4s ease-in-out infinite;
}

@keyframes proPulse{
  0%,100%{ transform: scale(1); opacity: 1; }
  50%{ transform: scale(0.92); opacity: 0.7; }
}

.pro-status-title{
  font-weight: 850;
  color: rgba(248,250,252,0.95);
  font-size: 0.98rem;
}

.pro-status-sub{
  margin-top: 4px;
  font-size: 0.9rem;
  color: rgba(248,250,252,0.70);
  line-height: 1.25;
}

.pro-status-phrase{
  font-weight: 750;
  color: rgba(248,250,252,0.85);
}

.pro-status-hint{
  color: rgba(248,250,252,0.55);
}

.pro-status-bar{
  margin-top: 12px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}

.pro-status-bar-fill{
  height: 100%;
  width: 12%;
  border-radius: 999px;
  transition: width 0.35s ease;
  background: linear-gradient(90deg, #ffb000, #ff8a00);
}

.pro-status-bar-fill.uploading{
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.pro-status-bar-fill.processing{
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
}

.pro-status-bar-fill.retrying{
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.pro-status-bar-fill.complete{
  background: linear-gradient(90deg, #10b981, #34d399);
}

.pro-status-bar-fill.error{
  background: linear-gradient(90deg, #ef4444, #f97316);
}

.pro-status-meta{
  margin-top: 10px;
  font-size: 0.78rem;
  color: rgba(248,250,252,0.55);
}

.pro-busy{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(15,23,42,0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.55);
}

.pro-busy-top{
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.pro-busy-spinner{
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid rgba(255,255,255,0.15);
  border-top-color: rgba(255,176,0,0.95);
  animation: spin 0.85s linear infinite;
  flex: 0 0 auto;
}

.pro-busy-text{
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pro-busy-line{
  margin: 0;
  font-size: 0.95rem;
  font-weight: 750;
  color: rgba(248,250,252,0.78);
}

.pro-busy-bar{
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  margin: 10px 0 12px;
}

.pro-busy-bar-fill{
  height: 100%;
  width: 12%;
  border-radius: 999px;
  transition: width 0.35s ease;
  background: linear-gradient(90deg, #ffb000, #ff8a00);
}

@keyframes spin{
  to{ transform: rotate(360deg); }
}

</style>
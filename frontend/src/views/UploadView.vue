<script setup>
import { ref, computed, watch } from 'vue';
import Tesseract from 'tesseract.js';
import stringSimilarity from 'string-similarity';

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


// aqui van las funciones nuevas
// ============================================
// CONFIGURACIÓN Y DICCIONARIOS
// ============================================

const KNOWN_CITIES = [
  'ORANGE CITY', 'WINTER PARK', 'DEBARY', 'DELTONA', 'SANFORD',
  'LAKE MARY', 'LONGWOOD', 'OVIEDO', 'CASSELBERRY', 'ALTAMONTE SPRINGS',
  'APOPKA', 'MAITLAND', 'ORLANDO'
];

// Diccionario de correcciones comunes de Tesseract
const STREET_TYPE_CORRECTIONS = {
  // AVE variations
  'AV': 'AVE', 'AVF': 'AVE', 'AV3': 'AVE', 'AVF.': 'AVE', 'AVEE': 'AVE',
  'AVL': 'AVE', 'AYE': 'AVE', 'AWE': 'AVE',
  
  // RD variations
  'R0': 'RD', 'RO': 'RD', 'RD.': 'RD', 'RE': 'RD',
  
  // ST variations
  'S1': 'ST', 'ST.': 'ST', 'STR': 'ST', 'STT': 'ST',
  
  // DR variations
  'DR.': 'DR', 'DRI': 'DR', 'DF': 'DR', 'D8': 'DR',
  
  // LN variations
  'LN.': 'LN', 'LNE': 'LN', 'L1': 'LN',
  
  // CT variations
  'CT.': 'CT', 'C1': 'CT', 'CY': 'CT',
  
  // WAY variations
  'WAY.': 'WAY', 'WY': 'WAY', 'W4Y': 'WAY',
  
  // BLVD variations
  'BLVD.': 'BLVD', 'BLDV': 'BLVD', 'BLV': 'BLVD',
  
  // CIR variations
  'CIR.': 'CIR', 'CIRC': 'CIR', 'C1R': 'CIR',
  
  // PKWY variations
  'PKWY.': 'PKWY', 'PKW': 'PKWY', 'PKWY': 'PKWY',
  
  // PL variations
  'PL.': 'PL', 'P1': 'PL',
  
  // TRL variations
  'TRL.': 'TRL', 'TRAIL': 'TRL', 'TR1': 'TRL'
};

const VALID_STREET_TYPES = [
  'AVE', 'ST', 'RD', 'DR', 'LN', 'CT', 'WAY', 'BLVD', 
  'CIR', 'PKWY', 'PL', 'TRL', 'LOOP', 'PATH', 'TER'
];

// ============================================
// PREPROCESAMIENTO DE IMAGEN MEJORADO
// ============================================

async function preprocessImage(imageFile) {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Recortar el 20% izquierdo (línea de tiempo)
      const cropLeft = Math.floor(img.width * 0.20);
      const newWidth = img.width - cropLeft;
      
      canvas.width = newWidth;
      canvas.height = img.height;
      
      // Dibujar la imagen recortada
      ctx.drawImage(img, cropLeft, 0, newWidth, img.height, 0, 0, newWidth, img.height);
      
      // Obtener datos de píxeles
      const imageData = ctx.getImageData(0, 0, newWidth, img.height);
      const data = imageData.data;
      
      // Aumentar contraste y sharpening
      for (let i = 0; i < data.length; i += 4) {
        // Convertir a escala de grises
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        
        // Aumentar contraste (threshold adaptativo)
        const contrast = avg > 128 ? 255 : 0;
        
        data[i] = contrast;     // R
        data[i + 1] = contrast; // G
        data[i + 2] = contrast; // B
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      canvas.toBlob((blob) => {
        resolve(new File([blob], 'preprocessed.png', { type: 'image/png' }));
      });
    };
    
    img.src = URL.createObjectURL(imageFile);
  });
}

// ============================================
// CORRECCIÓN POST-OCR
// ============================================

function correctStreetType(address) {
  let corrected = address;
  
  // Buscar y corregir tipos de calle conocidos
  const words = address.split(' ');
  const correctedWords = words.map(word => {
    const upper = word.toUpperCase().replace(/[.,]/g, '');
    return STREET_TYPE_CORRECTIONS[upper] || word;
  });
  
  return correctedWords.join(' ');
}

function cleanOCRNoise(text) {
  // Eliminar líneas de ruido común
  let cleaned = text
    .replace(/Scheduled\s+\d{1,2}:\d{2}\s*-?\s*\d{1,2}:\d{2}\s*(AM|PM)/gi, '')
    .replace(/Deliver\s+\d+\s+package/gi, '')
    .replace(/#\s*A-\d+\.\d+A/gi, '')
    .replace(/⏱️|📍|🗺️/g, '');
  
  return cleaned;
}

// ============================================
// EXTRACCIÓN INTELIGENTE DE DIRECCIONES
// ============================================

function extractAddresses(rawText) {
  const addresses = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentStop = null;
  let currentAddress = null;
  let lastKnownCity = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. Detectar número de parada
    const stopMatch = line.match(/^(\d{1,3})$/);
    if (stopMatch) {
      // Si teníamos una parada anterior, guardarla
      if (currentStop && currentAddress) {
        addresses.push({
          stop: currentStop,
          address: currentAddress,
          city: lastKnownCity,
          confidence: calculateConfidence(currentAddress, lastKnownCity)
        });
      }
      
      currentStop = parseInt(stopMatch[1]);
      currentAddress = null;
      continue;
    }
    
    // 2. Detectar dirección (RegEx PERMISIVO)
    // Busca: número(s) + al menos 2 palabras
    const addressMatch = line.match(/^(\d{1,6})\s+([A-Z0-9].*)/i);
    if (addressMatch && !currentAddress) {
      let rawAddress = `${addressMatch[1]} ${addressMatch[2]}`.trim();
      
      // Aplicar correcciones
      rawAddress = correctStreetType(rawAddress);
      
      currentAddress = rawAddress;
      continue;
    }
    
    // 3. Detectar ciudad (fuzzy matching)
    const cityMatch = findBestCityMatch(line);
    if (cityMatch && cityMatch.rating > 0.7) {
      lastKnownCity = cityMatch.target;
      
      // Si teníamos dirección pero no ciudad, ahora la guardamos
      if (currentStop && currentAddress) {
        addresses.push({
          stop: currentStop,
          address: currentAddress,
          city: lastKnownCity,
          confidence: calculateConfidence(currentAddress, lastKnownCity)
        });
        
        currentStop = null;
        currentAddress = null;
      }
    }
  }
  
  // Guardar la última parada si existe
  if (currentStop && currentAddress) {
    addresses.push({
      stop: currentStop,
      address: currentAddress,
      city: lastKnownCity,
      confidence: calculateConfidence(currentAddress, lastKnownCity)
    });
  }
  
  return addresses;
}

// ============================================
// FUZZY MATCHING PARA CIUDADES
// ============================================

function findBestCityMatch(text) {
  const cleanText = text.toUpperCase().trim();
  
  if (cleanText.length < 3) return null;
  
  const matches = stringSimilarity.findBestMatch(cleanText, KNOWN_CITIES);
  return matches.bestMatch;
}

// ============================================
// SISTEMA DE CONFIANZA
// ============================================

function calculateConfidence(address, city) {
  let score = 0;
  
  // +30 puntos: tiene número de casa
  if (/^\d{1,6}\s/.test(address)) {
    score += 30;
  }
  
  // +30 puntos: tiene tipo de calle válido
  const hasValidType = VALID_STREET_TYPES.some(type => 
    address.toUpperCase().includes(` ${type}`)
  );
  if (hasValidType) {
    score += 30;
  }
  
  // +20 puntos: tiene ciudad
  if (city) {
    score += 20;
  }
  
  // +10 puntos: tiene dirección (N, S, E, W)
  if (/\b(N|S|E|W|NORTH|SOUTH|EAST|WEST)\b/i.test(address)) {
    score += 10;
  }
  
  // +10 puntos: longitud razonable (15-50 caracteres)
  if (address.length >= 15 && address.length <= 50) {
    score += 10;
  }
  
  return score;
}

// ============================================
// FUNCIÓN PRINCIPAL DE OCR
// ============================================

async function processFlexScreenshot(imageFile) {
  try {
    // 1. Preprocesar imagen
    const processedImage = await preprocessImage(imageFile);
    
    // 2. Ejecutar OCR con configuración optimizada
    const result = await Tesseract.recognize(processedImage, 'eng', {
      tessedit_pageseg_mode: 6, // Bloque de texto único
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -.',
    });
    
    // 3. Limpiar texto de ruido
    const cleanedText = cleanOCRNoise(result.data.text);
    
    // 4. Extraer direcciones con lógica inteligente
    const addresses = extractAddresses(cleanedText);
    
    // 5. Filtrar y ordenar por confianza
    const filteredAddresses = addresses
      .filter(addr => addr.confidence >= 50) // Umbral mínimo
      .sort((a, b) => a.stop - b.stop);
    
    return {
      success: true,
      addresses: filteredAddresses,
      rawText: cleanedText,
      stats: {
        total: filteredAddresses.length,
        highConfidence: filteredAddresses.filter(a => a.confidence >= 80).length,
        mediumConfidence: filteredAddresses.filter(a => a.confidence >= 60 && a.confidence < 80).length,
        lowConfidence: filteredAddresses.filter(a => a.confidence < 60).length
      }
    };
    
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      error: error.message,
      addresses: []
    };
  }
}

// ============================================
// FUNCIÓN DE VALIDACIÓN MANUAL
// ============================================

function createManualReviewUI(addresses) {
  // Esta función retorna un objeto con las direcciones
  // marcadas por nivel de confianza para que el usuario
  // revise y corrija los "gaps"
  
  return addresses.map(addr => ({
    ...addr,
    needsReview: addr.confidence < 80,
    status: addr.confidence >= 80 ? 'auto' : 'manual'
  }));
}
// REEMPLAZA TU 'handleFileChange' CON ESTO:
async function handleFileChange(event) {
  const files = event.target.files;
  if (!files.length) return;
  
  isProcessing.value = true;
  extractedAddresses.value = [];
  backendResponse.value = null; // Resetea la respuesta anterior
  
  let allParsedStops = [];
  
  try {
    for (const file of files) {
      // 1. ¡Usamos la nueva pipeline v3.0!
      const result = await processFlexScreenshot(file);
      
      if (result.success) {
        // 2. Convertimos el formato de v3.0 al formato que usa nuestro UI
        // El nuevo formato es: { stop, address, city, confidence }
        const stopsFromFile = result.addresses.map(addr => ({
          number: addr.stop,
          address: `${addr.address} ${addr.city || ''}`.trim().toUpperCase(),
          isDowntown: false,
          confidence: addr.confidence // ¡Guardamos la confianza!
        }));
        allParsedStops.push(...stopsFromFile);
      } else {
        console.error("Fallo el OCR v3.0:", result.error);
      }
    }
    
    // 3. Mantenemos nuestra lógica de "gaps" (relleno de huecos)
    const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));
    let maxStopNumber = 0;
    
    // Encontramos el número de parada más alto
    uniqueStopsMap.forEach(stop => {
      if (stop.number > maxStopNumber) maxStopNumber = stop.number;
    });

    const fullListWithGaps = [];
    if (maxStopNumber > 0) {
      // Bucle empieza en 2 (asumiendo que 1 es el warehouse) o en el min
      // Por ahora, mantenemos la lógica del 2
      let minStopNumber = 2; 
      // Opcional: encontrar el número más bajo si no es 2
      if (allParsedStops.length > 0) {
         minStopNumber = allParsedStops.reduce((min, p) => p.number < min ? p.number : min, allParsedStops[0].number);
      }

      for (let i = minStopNumber; i <= maxStopNumber; i++) {
          if (uniqueStopsMap.has(i)) {
              fullListWithGaps.push(uniqueStopsMap.get(i));
          } else {
              // Creamos el hueco con el formato correcto
              fullListWithGaps.push({ number: i, address: '', isDowntown: false, confidence: 0 });
          }
      }
    }
    extractedAddresses.value = fullListWithGaps;

  } catch (error) {
    console.error("Error en handleFileChange:", error);
    alert("Hubo un error procesando las imágenes. Revisa la consola.");
  } finally {
    isProcessing.value = false;
  }
}function sanitizeAddress(address) {
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
    <div class="view-container"><div class="uploader-container">
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
                    </div> </div> </div> </div> </div> </div></template>

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
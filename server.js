// server.js (v3.0 - Implementación de ETA en Caliente)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');
const { createClient } = require('@supabase/supabase-js');

// --- 🆕 FASE 2: Dependencias de Encriptación ---
[cite_start]const crypto = require('crypto'); [cite: 30]
// IMPORTANTE: Asegúrate que STOPS_ENCRYPTION_KEY esté en tu .env
const ENCRYPTION_KEY = process.env.STOPS_ENCRYPTION_KEY; [cite_start]// Debe ser 32 bytes (64 hex) [cite: 33]
[cite_start]const IV_LENGTH = 16; [cite: 34]
// --- Fin FASE 2 ---

const app = express();
const PORT = 3000;

// Tu configuración de CORS (sin cambios)
const allowedOrigins = [
  'http://localhost:5173',
  'https://flex-optimizer.vercel.app',
  'https://flex-optimizer-git-v15-logbook-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-git-v20-app-layout-ernestos-projects-d9e7c95d.vercel.app'
];
const corsOptions = {
  origin: function (origin, callback) {
    console.log("--- INICIO DEPURACIÓN CORS ---");
    console.log("Origen (Navegador):", origin);
    
    let originToTest = origin;
    if (originToTest && originToTest.endsWith('/')) {
      originToTest = originToTest.slice(0, -1);
    }

    if (allowedOrigins.indexOf(originToTest) !== -1 || !origin) {
      console.log("RESULTADO: Permitido");
      callback(null, true);
    } else {
      console.error('❌ CORS RECHAZADO: Origen no permitido ->', origin);
      callback(new Error('No permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());
const mapsClient = new Client({});

// Tu conexión de Supabase (sin cambios)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Conectando a Supabase en:", supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'URL no encontrada');

// --- 🆕 FASE 2: Funciones de Encriptación ---
[cite_start]function encryptStops(stopsArray) { [cite: 35]
  try {
    [cite_start]const text = JSON.stringify(stopsArray); [cite: 37]
    [cite_start]const iv = crypto.randomBytes(IV_LENGTH); [cite: 38]
    [cite_start]const cipher = crypto.createCipheriv( [cite: 39]
      [cite_start]'aes-256-cbc', [cite: 41]
      [cite_start]Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), // Forzar 32 bytes [cite: 42]
      [cite_start]iv [cite: 43]
    );
    [cite_start]let encrypted = cipher.update(text, 'utf8', 'hex'); [cite: 44]
    [cite_start]encrypted += cipher.final('hex'); [cite: 45]
    [cite_start]return iv.toString('hex') + ':' + encrypted; [cite: 46]
  [cite_start]} catch (error) { [cite: 47]
    [cite_start]console.error('❌ Error encriptando stops:', error); [cite: 48]
    [cite_start]return null; [cite: 49]
  }
[cite_start]} [cite: 51]

[cite_start]function decryptStops(encryptedText) { [cite: 52]
  try {
    [cite_start]const parts = encryptedText.split(':'); [cite: 53]
    [cite_start]const iv = Buffer.from(parts.shift(), 'hex'); [cite: 54]
    [cite_start]const encrypted = parts.join(':'); [cite: 55]
    [cite_start]const decipher = crypto.createDecipheriv( [cite: 56]
      [cite_start]'aes-256-cbc', [cite: 58]
      [cite_start]Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), [cite: 59]
      iv
    );
    [cite_start]let decrypted = decipher.update(encrypted, 'hex', 'utf8'); [cite: 60]
    [cite_start]decrypted += decipher.final('utf8'); [cite: 61]
    [cite_start]return JSON.parse(decrypted); [cite: 62]
  [cite_start]} catch (error) { [cite: 63]
    [cite_start]console.error('❌ Error desencriptando stops:', error); [cite: 64]
    [cite_start]return null; [cite: 65]
  }
[cite_start]} [cite: 67]
// --- Fin FASE 2 ---

// --- Tu función `calculateLeg` (sin cambios) ---
async function calculateLeg(origin, destination, waypoints = []) {
    try {
        const response = await mapsClient.directions({
            params: {
                origin,
                destination,
                waypoints,
                avoid: ['tolls'],
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });

        if (response.data.status !== 'OK') {
            console.error(`❌ Google Maps API Error: ${response.data.status}`);
            return { 
                distance: 0, 
                duration: 0, 
                error: true,
                errorType: response.data.status,
                origin,
                destination,
                waypoints
            };
        }

        const route = response.data.routes[0];
        if (!route || !route.legs || route.legs.length === 0) {
            console.error(`❌ No route found between ${origin} and ${destination}`);
            return { 
                distance: 0, 
                duration: 0, 
                error: true,
                errorType: 'NO_ROUTE',
                origin,
                destination,
                waypoints
            };
        }
        
        let totalDistance = 0;
        let totalDuration = 0;
        route.legs.forEach(leg => {
            totalDistance += leg.distance.value;
            totalDuration += leg.duration.value;
        });

        return {
            distance: (totalDistance / 1609.34).toFixed(2),
            duration: Math.round(totalDuration / 60),
            error: false
        };
    } catch (error) {
        console.error(`❌ Error calculando tramo de ${origin} a ${destination}:`, 
                      error.response?.data?.error_message || error.message);
        return { 
            distance: 0, 
            duration: 0, 
            error: true,
            errorType: 'NETWORK_ERROR',
            errorMessage: error.response?.data?.error_message || error.message,
            origin,
            destination,
            waypoints
        };
    }
}

// --- Tu endpoint `/api/optimize-route` (sin cambios) ---
app.post('/api/optimize-route', async (req, res) => {
  let { addresses } = req.body;
  addresses = addresses.filter(addr => addr && addr.trim() !== '');

  if (!addresses || addresses.length < 3) {
    return res.status(400).json({ 
      message: 'Se necesitan al menos Origen, una Parada y un Destino.',
      hasErrors: true 
    });
  }

  try {
    const origin = addresses[0]; // Warehouse
    const finalDestination = addresses[addresses.length - 1]; // Último destino
    
    const workStops = addresses.slice(1, -1); 
    const firstStop = workStops[0]; 
    const lastStop = workStops[workStops.length - 1]; 

    console.log('✅ v1.7: Calculando con método manual correcto...');
    console.log(`   Warehouse: ${origin}`);
    console.log(`   Primera Parada: ${firstStop}`);
    console.log(`   Última Parada: ${lastStop}`);
    console.log(`   Total de paradas de trabajo: ${workStops.length}`);

    const toFirstStopPromise = calculateLeg(origin, firstStop);
    const toFinalDestinationPromise = calculateLeg(lastStop, finalDestination);
    const toLastStopForInversePromise = calculateLeg(origin, lastStop);
    const fromFirstStopToHomePromise = calculateLeg(firstStop, finalDestination);

    const STOPS_PER_SEGMENT = 10; 
    const workStopSegments = [];
    
    for (let i = 0; i < workStops.length; i += 9) { 
        const segmentStops = workStops.slice(i, i + 10); 
        
        if (segmentStops.length > 0) {
            workStopSegments.push({
                origin: segmentStops[0], 
                destination: segmentStops[segmentStops.length - 1], 
                waypoints: segmentStops.slice(1, -1) 
            });
        }
    }

    console.log(`   Segmentos creados: ${workStopSegments.length}`);
    workStopSegments.forEach((seg, idx) => {
        console.log(`   Segmento ${idx + 1}: ${seg.origin} → ${seg.destination} (${seg.waypoints.length} waypoints)`);
    });

    const segmentPromises = workStopSegments.map(seg => 
        calculateLeg(seg.origin, seg.destination, seg.waypoints)
    );
    
    const [toFirstStop, toFinalDestination, toLastStopForInverse, fromFirstStopToHome, ...segmentResults] = await Promise.all([
        toFirstStopPromise,
        toFinalDestinationPromise,
        toLastStopForInversePromise,
        fromFirstStopToHomePromise,
        ...segmentPromises
    ]);

    const failedAddresses = [];
    
    if (toFirstStop.error) {
        failedAddresses.push({
            type: 'Warehouse → Primera Parada',
            from: origin,
            to: firstStop,
            errorType: toFirstStop.errorType
        });
    }
    
    if (toFinalDestination.error) {
        failedAddresses.push({
            type: 'Última Parada → Destino Final',
            from: lastStop,
            to: finalDestination,
            errorType: toFinalDestination.errorType
        });
    }
    
    if (toLastStopForInverse.error) {
        failedAddresses.push({
            type: 'Warehouse → Última Parada (Ruta Inversa)',
            from: origin,
            to: lastStop,
            errorType: toLastStopForInverse.errorType
        });
    }
    
    if (fromFirstStopToHome.error) {
        failedAddresses.push({
            type: 'Primera Parada → Destino (Ruta Inversa)',
            from: firstStop,
            to: finalDestination,
            errorType: fromFirstStopToHome.errorType
        });
    }

    segmentResults.forEach((result, index) => {
        if (result.error) {
            const seg = workStopSegments[index];
            failedAddresses.push({
                type: `Segmento ${index + 1}`,
                from: seg.origin,
                to: seg.destination,
                waypoints: seg.waypoints,
                errorType: result.errorType
            });
        }
    });

    if (failedAddresses.length > 0) {
        console.error('❌ Se encontraron direcciones inválidas:', failedAddresses);
        return res.status(400).json({
            hasErrors: true,
            message: 'Algunas direcciones no pudieron ser geocodificadas',
            failedAddresses: failedAddresses,
            toFirstStop,
            segments: segmentResults.map((result, index) => ({
                ...result,
                stops: workStopSegments[index] ? 
                    [workStopSegments[index].origin, ...workStopSegments[index].waypoints, workStopSegments[index].destination] : 
                    []
            })),
            toFinalDestination,
            inverseRouteLegs: {
                toLastStop: toLastStopForInverse,
                fromFirstStop: fromFirstStopToHome
            }
        });
    }

    const segmentsWithStops = segmentResults.map((result, index) => {
        const seg = workStopSegments[index];
        return {
            ...result,
            stops: [seg.origin, ...seg.waypoints, seg.destination] 
        };
    });

    console.log('🎉 v1.7: Cálculo completado correctamente');
    console.log(`   Warehouse → Primera: ${toFirstStop.distance} mi`);
    segmentsWithStops.forEach((seg, idx) => {
        console.log(`   Segmento ${idx + 1}: ${seg.distance} mi (${seg.stops.length} paradas)`);
    });
    console.log(`   Última → Destino: ${toFinalDestination.distance} mi`);

    res.json({
        hasErrors: false,
        toFirstStop,
        segments: segmentsWithStops,
        toFinalDestination,
        inverseRouteLegs: {
            toLastStop: toLastStopForInverse,
            fromFirstStop: fromFirstStopToHome
        }
    });

  } catch (error) {
    console.error("❌ Error en el cálculo de escenarios:", error.message);
    res.status(500).json({ 
      hasErrors: true,
      message: 'Error al calcular los escenarios.',
      error: error.message 
    });
  }
});

// --- 🆕 FASE 3: Endpoint `/api/log-route` (MODIFICADO) ---
[cite_start]app.post('/api/log-route', async (req, res) => { [cite: 78]
    [cite_start]const logData = req.body; [cite: 79]
    [cite_start]console.log('📦 Recibiendo datos v3 para guardar en bitácora'); [cite: 80]

    [cite_start]// Extraer datos nuevos [cite: 81]
    const stopsArray = logData.stops_json; [cite_start]// Array de { number, address, isDowntown} [cite: 82]
    const etaOptimista = logData.eta_optimista; [cite_start]// String "11:45 AM" [cite: 82]
    [cite_start]const etaNormal = logData.eta_normal; [cite: 83]
    [cite_start]const etaPesimista = logData.eta_pesimista; [cite: 84]

    [cite_start]// Encriptar paradas [cite: 85]
    [cite_start]const encryptedStops = stopsArray ? encryptStops(stopsArray) : null; [cite: 86]
    [cite_start]if (stopsArray && !encryptedStops) { [cite: 87]
      [cite_start]return res.status(500).json({ [cite: 88]
        [cite_start]success: false, [cite: 89]
        message: 'Error al encriptar paradas. [cite_start]Verifica ENCRYPTION_KEY.' [cite: 90]
      [cite_start]}); [cite: 92]
    }

    [cite_start]// Convertir ETAs de "11:45 AM" a formato TIME "11:45:00" [cite: 94]
    [cite_start]const convertToTime = (etaString) => { [cite: 95]
      [cite_start]if (!etaString) return null; [cite: 96]
      [cite_start]try { [cite: 97]
        [cite_start]const [time, period] = etaString.split(' '); [cite: 99]
        [cite_start]let [hours, minutes] = time.split(':').map(Number); [cite: 100]
        [cite_start]if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12; [cite: 101]
        [cite_start]if (period.toUpperCase() === 'AM' && hours === 12) hours = 0; [cite: 102]
        [cite_start]return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`; [cite: 103]
      [cite_start]} catch (e) { [cite: 104]
        [cite_start]console.error('Error convirtiendo ETA:', e); [cite: 105]
        [cite_start]return null; [cite: 106]
      }
    [cite_start]}; [cite: 108]

    [cite_start]const dataToInsert = { [cite: 109]
        // --- Campos existentes ---
        [cite_start]fecha: logData.fecha, [cite: 111]
        [cite_start]vehiculo: logData.vehiculo, [cite: 112]
        [cite_start]warehouse: logData.warehouse, [cite: 113]
        [cite_start]hora: logData.hora, [cite: 114]
        [cite_start]duracion_horas: logData.duracion_horas, [cite: 115]
        [cite_start]pago: logData.pago, [cite: 116]
        [cite_start]pago_por_hora: logData.pago_por_hora, [cite: 117]
        [cite_start]antes_del_bloque: logData.antes_del_bloque, [cite: 118]
        [cite_start]despues_del_bloque: logData.despues_del_bloque, [cite: 119]
        [cite_start]tiempo_total: logData.tiempo_total, [cite: 120]
        [cite_start]pago_real_por_hora: logData.pago_real_por_hora, [cite: 121]
        [cite_start]commute_1: logData.commute_1, [cite: 122]
        [cite_start]commute_2: logData.commute_2, [cite: 124]
        [cite_start]millas_de_trabajo: logData.millas_de_trabajo, [cite: 124]
        [cite_start]millas_totales: logData.millas_totales, [cite: 124]
        [cite_start]millas_por_hora: logData.millas_por_hora, [cite: 125]
        [cite_start]gasto_de_gasolina: logData.gasto_de_gasolina, [cite: 125]
        [cite_start]desgaste_vehiculo: logData.desgaste_vehiculo, [cite: 125]
        [cite_start]tax: logData.tax, [cite: 125]
        [cite_start]claim_por_milla: logData.claim_por_milla, [cite: 126]
        [cite_start]route_score: logData.route_score, [cite: 126]
        [cite_start]numero_paradas: logData.numero_paradas, [cite: 127]
        [cite_start]user_id: logData.user_id, [cite: 127]
        [cite_start]primary_city: logData.primary_city, [cite: 128]
        [cite_start]first_stop: logData.first_stop, [cite: 129]
        
        // --- 🆕 NUEVOS CAMPOS ---
        [cite_start]status: 1, // 1 = Ruta activa [cite: 128]
        [cite_start]eta_optimista: convertToTime(etaOptimista), [cite: 131]
        [cite_start]eta_normal: convertToTime(etaNormal), [cite: 131]
        [cite_start]eta_pesimista: convertToTime(etaPesimista), [cite: 132]
        [cite_start]stops_json: encryptedStops, [cite: 133]
        [cite_start]eta_real: null, [cite: 134]
        [cite_start]eta_real_input_date: null, [cite: 135]
        [cite_start]notes: null [cite: 136]
    };

    [cite_start]Object.keys(dataToInsert).forEach(key => { [cite: 138]
        [cite_start]if (dataToInsert[key] === null || dataToInsert[key] === undefined) { [cite: 139]
            [cite_start]delete dataToInsert[key]; [cite: 140]
        }
    [cite_start]}); [cite: 142]

    [cite_start]try { [cite: 143]
        const { data, error } = await supabase
            [cite_start].from('routes') [cite: 145]
            [cite_start].insert([dataToInsert]) [cite: 146]
            [cite_start].select(); [cite: 147]

        [cite_start]if (error) { [cite: 148]
            [cite_start]console.error('❌ Error de Supabase al insertar:', error.message); [cite: 150]
            throw error;
        }

        [cite_start]console.log('💾 ¡Ruta v3 guardada con ETAs y stops encriptados!'); [cite: 151]
        [cite_start]res.status(200).json({ success: true, message: 'Ruta guardada en bitácora.', data: data }); [cite: 152-156]

    [cite_start]} catch (error) { [cite: 157]
        [cite_start]console.error('❌ Error general en /api/log-route:', error.message); [cite: 158]
        [cite_start]res.status(500).json({ success: false, message: 'Error al guardar en Supabase.', error: error.message }); [cite: 159-163]
    }
[cite_start]}); [cite: 165]
// --- Fin FASE 3 ---


// --- 🆕 FASE 4: Nuevos Endpoints ---

[cite_start]// 1. GET /api/active-route/:userId [cite: 167]
[cite_start]app.get('/api/active-route/:userId', async (req, res) => { [cite: 170]
  const { userId } = req.params;
  [cite_start]try { [cite: 171]
    const { data, error } = await supabase
      [cite_start].from('routes') [cite: 173]
      [cite_start].select('*') [cite: 174]
      [cite_start].eq('user_id', userId) [cite: 175]
      [cite_start].eq('status', 1) [cite: 176]
      [cite_start].order('created_at', { ascending: false }) [cite: 177]
      [cite_start].limit(1) [cite: 178]
      [cite_start].single(); [cite: 179]

    [cite_start]if (error) { [cite: 180]
      [cite_start]if (error.code === 'PGRST116') { // No rows found [cite: 181]
        [cite_start]return res.json({ [cite: 182]
          [cite_start]hasActiveRoute: false, [cite: 183]
          [cite_start]message: 'No tienes ruta activa' [cite: 184]
        [cite_start]}); [cite: 186]
      }
      [cite_start]throw error; [cite: 187]
    }

    [cite_start]// Desencriptar paradas [cite: 190]
    [cite_start]const stops = data.stops_json ? decryptStops(data.stops_json) : []; [cite: 191]
    [cite_start]if (data.stops_json && !stops) { [cite: 192]
      [cite_start]console.error('❌ Error desencriptando stops de ruta:', data.id); [cite: 194]
      // Continuar sin paradas, pero reportar error
    }

    [cite_start]res.json({ [cite: 195]
      [cite_start]hasActiveRoute: true, [cite: 196]
      [cite_start]route: { [cite: 197]
        [cite_start]id: data.id, [cite: 198]
        [cite_start]fecha: data.fecha, [cite: 199]
        [cite_start]warehouse: data.warehouse, [cite: 200]
        [cite_start]hora: data.hora, [cite: 201]
        [cite_start]duracion_horas: data.duracion_horas, [cite: 202]
        [cite_start]numero_paradas: data.numero_paradas, [cite: 202]
        [cite_start]primary_city: data.primary_city, [cite: 202]
        [cite_start]eta_optimista: data.eta_optimista, [cite: 203]
        [cite_start]eta_normal: data.eta_normal, [cite: 203]
        [cite_start]eta_pesimista: data.eta_pesimista, [cite: 204]
        [cite_start]stops: stops, // Array desencriptado [cite: 204]
        [cite_start]millas_totales: data.millas_totales, [cite: 205]
        [cite_start]pago: data.pago [cite: 205]
      [cite_start]} [cite: 206]
    [cite_start]}); [cite: 207]
  [cite_start]} catch (error) { [cite: 208]
    [cite_start]console.error('❌ Error obteniendo ruta activa:', error); [cite: 209]
    [cite_start]res.status(500).json({ [cite: 210]
      [cite_start]hasActiveRoute: false, [cite: 211]
      [cite_start]error: error.message [cite: 212]
    [cite_start]}); [cite: 213]
  }
[cite_start]}); [cite: 215]

[cite_start]// 2. POST /api/calculate-live-eta [cite: 216]
[cite_start]app.post('/api/calculate-live-eta', async (req, res) => { [cite: 219]
  [cite_start]const { routeId, currentStopNumber } = req.body; [cite: 220]
  [cite_start]if (!routeId || !currentStopNumber) { [cite: 221]
    [cite_start]return res.status(400).json({ [cite: 222]
      [cite_start]error: 'Falta routeId o currentStopNumber' [cite: 223]
    [cite_start]}); [cite: 224]
  }

  [cite_start]try { [cite: 226]
    [cite_start]// 1. Obtener ruta de BD [cite: 227]
    const { data: route, error } = await supabase
      [cite_start].from('routes') [cite: 229]
      [cite_start].select('*') [cite: 230]
      [cite_start].eq('id', routeId) [cite: 231]
      [cite_start].eq('status', 1) [cite: 232]
      [cite_start].single(); [cite: 233]

    [cite_start]if (error) { [cite: 234]
      [cite_start]throw new Error('Ruta no encontrada o ya finalizada'); [cite: 236]
    }
    [cite_start]// 2. Desencriptar paradas [cite: 237]
    [cite_start]const allStops = decryptStops(route.stops_json); [cite: 238]
    [cite_start]if (!allStops) { [cite: 239]
      [cite_start]throw new Error('Error desencriptando paradas'); [cite: 241]
    }
    [cite_start]// 3. Filtrar paradas [cite: 242]
    [cite_start]const remainingStops = allStops.filter( [cite: 242]
      [cite_start]stop => stop.number >= currentStopNumber && stop.address [cite: 244]
    [cite_start]); [cite: 243]
    [cite_start]if (remainingStops.length === 0) { [cite: 245]
      [cite_start]return res.status(400).json({ [cite: 246]
        [cite_start]error: 'No hay paradas restantes desde esa posición' [cite: 247]
      [cite_start]}); [cite: 248]
    }

    [cite_start]console.log(`Recalculando desde parada ${currentStopNumber}`); [cite: 251]
    [cite_start]console.log(`Paradas restantes: ${remainingStops.length} `); [cite: 252]
    
    [cite_start]// 4. Construir ruta [cite: 253]
    [cite_start]const currentStopAddress = remainingStops[0].address; [cite: 254]
    // NOTA: Asumimos 'Casa' como destino. Idealmente, esto debería sacarse de la BD o un .env
    [cite_start]const finalDestinationAddress = '513 Alafaya Woods Blvd Oviedo, FL'; [cite: 255]
    
    [cite_start]// Paradas intermedias [cite: 256]
    // 🆕 CORRECCIÓN DEL INFORME:
    [cite_start]// El informe [cite: 262] pasa 'intermediateStops.map(s => s.address)'
    [cite_start]// Pero 'intermediateStops' [cite: 256] es 'remainingStops.slice(1)', que YA INCLUYE el destino final (la última parada).
    // calculateLeg(origin, destination, waypoints) requiere que waypoints NO incluya el destino.
    // La lógica de /optimize-route usa slice(1, -1) para los waypoints.
    // Aquí, `remainingStops` SÍ incluye la última parada.
    // PERO `calculateLeg` NO toma un destino final, toma un `origin`, `destination` y `waypoints`.
    // El `finalDestinationAddress` es el de "Casa".
    // Las `remainingStops` son las paradas de TRABAJO.
    // La lógica DEBERÍA ser:
    // Origin: currentStopAddress (Parada 15)
    // Destination: lastWorkStop (Parada 40)
    // Waypoints: Paradas 16 a 39
    // ... Y LUEGO sumar el tramo de "lastWorkStop" a "finalDestinationAddress (Casa)".

    [cite_start]// SIN EMBARGO, para seguir el informe[cite: 261], el cálculo es DESDE la parada actual HASTA EL DESTINO FINAL (Casa).
    const destinationForCalc = finalDestinationAddress;
    // Los waypoints son TODAS las paradas restantes EXCEPTO la actual (que es el origen)
    [cite_start]const waypointsForCalc = remainingStops.slice(1).map(s => s.address); [cite: 262]


    [cite_start]// 5. Llamar a Google Maps API [cite: 257]
    [cite_start]const routeResult = await calculateLeg( [cite: 258]
      [cite_start]currentStopAddress, [cite: 260]
      [cite_start]destinationForCalc, // Destino final (Casa) [cite: 261]
      [cite_start]waypointsForCalc // Paradas intermedias de trabajo [cite: 262]
    [cite_start]); [cite: 259]

    [cite_start]if (routeResult.error) { [cite: 263]
      [cite_start]throw new Error('Error calculando ruta con Google Maps'); [cite: 265]
    }

    [cite_start]// 6. Calcular ETAs [cite: 266]
    const baseDriveMinutes = parseFloat(routeResult.duration) || [cite_start]0; [cite: 267]
    
    [cite_start]// EL CÁLCULO DE STOP TIME DEL INFORME [cite: 268-285] ES PARA EL TRAMO COMPLETO
    // (Drive + Stops + Destino). 
    // PERO `calculateLeg` ya nos dio el 'duration' (baseDriveMinutes)
    [cite_start]// HASTA EL DESTINO FINAL[cite: 261].
    // La lógica de 'scenarioETAs' en UploadView calculaba Drive (trabajo) + Stops + Commute (a casa)
    [cite_start]// Aquí, `baseDriveMinutes` [cite: 267] ya INCLUYE el commute a casa.
    // DEBERÍAMOS recalcular solo el tiempo de paradas.
    
    [cite_start]const stopCount = remainingStops.length; [cite: 268]
    [cite_start]let aptCount = 0; [cite: 270]
    [cite_start]let downtownCount = 0; [cite: 271]
    [cite_start]remainingStops.forEach(stop => { [cite: 272]
      [cite_start]if (stop.isDowntown) { [cite: 273]
        [cite_start]downtownCount++; [cite: 274]
        aptCount++; [cite_start]// Downtown cuenta como apt también [cite: 275]
      [cite_start]} else if (stop.address && stop.address.match(/APT|UNIT|#/i)) { [cite: 276]
        [cite_start]aptCount++; [cite: 277]
      }
    [cite_start]}); [cite: 279]
    [cite_start]const regularApts = aptCount - downtownCount; [cite: 280]

    [cite_start]// Función helper para calcular ETA [cite: 281]
    [cite_start]const calculateETA = (multiplier) => { [cite: 282]
      [cite_start]const baseStopTime = stopCount * multiplier; [cite: 283]
      [cite_start]const extraAptTime = (regularApts * 1.5) + (downtownCount * 4.5); [cite: 284]
      // SUMAMOS el tiempo de paradas al tiempo de conducción total (que ya incluye el commute)
      [cite_start]const totalMinutes = baseDriveMinutes + baseStopTime + extraAptTime; [cite: 285]
      [cite_start]const now = new Date(); [cite: 286]
      [cite_start]const etaTime = new Date(now.getTime() + totalMinutes * 60000); [cite: 287]
      [cite_start]return { [cite: 288]
        [cite_start]totalMinutes: Math.round(totalMinutes), [cite: 289]
        [cite_start]eta: etaTime.toLocaleTimeString('en-US', { [cite: 291]
          [cite_start]hour: 'numeric', [cite: 292]
          [cite_start]minute: '2-digit' [cite: 293]
        [cite_start]}) [cite: 294]
      [cite_start]}; [cite: 295]
    [cite_start]}; [cite: 296]

    [cite_start]const liveETAs = { [cite: 297]
      [cite_start]optimistic: calculateETA(0.90), [cite: 299]
      [cite_start]normal: calculateETA(1.10), [cite: 300]
      [cite_start]pessimistic: calculateETA(1.50) [cite: 301]
    [cite_start]}; [cite: 298]

    [cite_start]console.log('✅ ETAs recalculados:', liveETAs); [cite: 302]
    [cite_start]res.json({ [cite: 303]
      [cite_start]success: true, [cite: 304]
      [cite_start]currentStop: currentStopNumber, [cite: 305]
      [cite_start]remainingStops: remainingStops.length, [cite: 306]
      [cite_start]remainingMiles: routeResult.distance, [cite: 307]
      [cite_start]etas: liveETAs, [cite: 308]
      [cite_start]breakdown: { [cite: 309]
        [cite_start]baseDriveMinutes: Math.round(baseDriveMinutes), [cite: 310]
        [cite_start]stopCount, [cite: 311]
        [cite_start]aptCount, [cite: 312]
        [cite_start]downtownCount [cite: 313]
      [cite_start]} [cite: 314]
    [cite_start]}); [cite: 315]

  [cite_start]} catch (error) { [cite: 316]
    [cite_start]console.error('❌ Error en calculate-live-eta:', error); [cite: 317]
    [cite_start]res.status(500).json({ [cite: 318]
      [cite_start]success: false, [cite: 319]
      [cite_start]error: error.message [cite: 320]
    [cite_start]}); [cite: 321]
  }
[cite_start]}); [cite: 322]

[cite_start]// 3. POST /api/complete-route [cite: 323]
[cite_start]app.post('/api/complete-route', async (req, res) => { [cite: 326]
  const { routeId, etaReal } = req.body; [cite_start]// etaReal: "5:11 PM" [cite: 327]
  [cite_start]if (!routeId || !etaReal) { [cite: 328]
    [cite_start]return res.status(400).json({ [cite: 329]
      [cite_start]error: 'Falta routeId o etaReal' [cite: 330]
    [cite_start]}); [cite: 331]
  }

  [cite_start]try { [cite: 333]
    [cite_start]// Convertir "5:11 PM" a "17:11:00" [cite: 334]
    [cite_start]const convertToTime = (etaString) => { [cite: 335]
      [cite_start]const [time, period] = etaString.trim().split(' '); [cite: 337]
      [cite_start]let [hours, minutes] = time.split(':').map(Number); [cite: 338]
      [cite_start]if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12; [cite: 339]
      [cite_start]if (period.toUpperCase() === 'AM' && hours === 12) hours = 0; [cite: 340]
      [cite_start]return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`; [cite: 341]
    [cite_start]}; [cite: 336]
    [cite_start]const timeFormatted = convertToTime(etaReal); [cite: 342]

    const { data, error } = await supabase
      [cite_start].from('routes') [cite: 344]
      [cite_start].update({ [cite: 345]
        [cite_start]status: 0, [cite: 347]
        [cite_start]eta_real: timeFormatted, [cite: 348]
        [cite_start]eta_real_input_date: new Date().toISOString(), [cite: 349]
        [cite_start]stops_json: null // BORRAR DIRECCIONES [cite: 350]
      [cite_start]}) [cite: 346]
      [cite_start].eq('id', routeId) [cite: 351]
      [cite_start]//.eq('status', 1) // Quitado para permitir actualizar rutas pendientes [cite: 352]
      [cite_start].select(); [cite: 352]

    [cite_start]if (error) throw error; [cite: 353]
    [cite_start]if (!data || data.length === 0) { [cite: 354]
      [cite_start]return res.status(404).json({ [cite: 355]
        [cite_start]success: false, [cite: 356]
        [cite_start]message: 'Ruta no encontrada' [cite: 357]
      [cite_start]}); [cite: 359]
    }

    [cite_start]console.log(`✅ Ruta ${routeId} completada. ETA real: ${timeFormatted}`); [cite: 361]
    [cite_start]res.json({ [cite: 362]
      [cite_start]success: true, [cite: 364]
      [cite_start]message: 'Ruta completada y ETA real guardado', [cite: 365]
      [cite_start]data: data[0] [cite: 365]
    [cite_start]}); [cite: 363]
  [cite_start]} catch (error) { [cite: 366]
    [cite_start]console.error('❌ Error completando ruta:', error); [cite: 367]
    [cite_start]res.status(500).json({ [cite: 368]
      [cite_start]success: false, [cite: 369]
      [cite_start]error: error.message [cite: 370]
    [cite_start]}); [cite: 371]
  }
[cite_start]}); [cite: 373]

[cite_start]// 4. GET /api/pending-eta/:userId [cite: 374]
[cite_start]app.get('/api/pending-eta/:userId', async (req, res) => { [cite: 377]
  [cite_start]const { userId } = req.params; [cite: 378]
  [cite_start]try { [cite: 379]
    const { data, error } = await supabase
      [cite_start].from('routes') [cite: 381]
      [cite_start].select('id, fecha, warehouse, hora, eta_normal, primary_city') [cite: 382]
      [cite_start].eq('user_id', userId) [cite: 383]
      [cite_start].eq('status', 0) [cite: 384]
      [cite_start].is('eta_real', null) [cite: 385]
      [cite_start].is('notes', null) // No tiene "user_skipped" [cite: 386]
      [cite_start].order('fecha', { ascending: false }) [cite: 387]
      [cite_start].limit(5); [cite: 388]

    [cite_start]if (error) throw error; [cite: 389]
    [cite_start]res.json({ [cite: 390]
      [cite_start]hasPending: data.length > 0, [cite: 391]
      [cite_start]routes: data [cite: 392]
    [cite_start]}); [cite: 393]
  [cite_start]} catch (error) { [cite: 394]
    [cite_start]console.error('❌ Error obteniendo rutas pendientes:', error); [cite: 395]
    [cite_start]res.status(500).json({ [cite: 395]
      [cite_start]hasPending: false, [cite: 396]
      [cite_start]error: error.message [cite: 397]
    [cite_start]}); [cite: 398]
  }
[cite_start]}); [cite: 400]

[cite_start]// 5. POST /api/skip-eta [cite: 401]
[cite_start]app.post('/api/skip-eta', async (req, res) => { [cite: 404]
  [cite_start]const { routeId } = req.body; [cite: 405]
  [cite_start]try { [cite: 406]
    const { data, error } = await supabase
      [cite_start].from('routes') [cite: 407]
      [cite_start].update({ notes: 'user_skipped' }) [cite: 408]
      [cite_start].eq('id', routeId) [cite: 408]
      [cite_start].select(); [cite: 409]

    [cite_start]if (error) throw error; [cite: 410]
    [cite_start]console.log(`✅ Usuario saltó ETA de ruta ${routeId}`); [cite: 411]
    [cite_start]res.json({ [cite: 412]
      [cite_start]success: true, [cite: 414]
      [cite_start]message: 'Ruta marcada como saltada' [cite: 415]
    [cite_start]}); [cite: 413]
  [cite_start]} catch (error) { [cite: 416]
    [cite_start]console.error('❌ Error saltando ETA:', error); [cite: 417]
    [cite_start]res.status(500).json({ [cite: 418]
      [cite_start]success: false, [cite: 419]
      [cite_start]error: error.message [cite: 420]
    [cite_start]}); [cite: 421]
  }
[cite_start]}); [cite: 423]
// --- Fin FASE 4 ---


// --- 🆕 FASE 5: Cleanup Automático ---
[cite_start]// (Ejecutar ANTES de app.listen) [cite: 428]

[cite_start]// Función helper para calcular cuándo borrar stops [cite: 429]
[cite_start]const calculateCleanupTime = (hora, duracionHoras, despuesBloqueHoras) => { [cite: 430]
  try {
    [cite_start]const [hours, minutes] = hora.split(':').map(Number); [cite: 432]
    [cite_start]const startTime = new Date(); [cite: 433]
    [cite_start]startTime.setHours(hours, minutes, 0, 0); [cite: 434]
    [cite_start]// +30min buffer [cite: 435]
    [cite_start]const totalMinutes = (duracionHoras + despuesBloqueHoras) * 60 + 30; [cite: 435]
    [cite_start]return new Date(startTime.getTime() + totalMinutes * 60000); [cite: 436]
  } catch(e) {
    console.error("Error en calculateCleanupTime", e);
    // Devuelve una fecha en el pasado para no borrar por error
    return new Date(0); 
  }
[cite_start]}; [cite: 437]

[cite_start]// Ejecutar cada 5 minutos [cite: 438]
[cite_start]setInterval(async () => { [cite: 439, 441]
  [cite_start]try { [cite: 440]
    [cite_start]const now = new Date(); [cite: 442]
    [cite_start]// Obtener rutas activas que ya deberian haberse completado [cite: 443]
    const { data: activeRoutes, error } = await supabase
      [cite_start].from('routes') [cite: 445]
      [cite_start].select('id, hora, duracion_horas, despues_del_bloque') [cite: 446]
      [cite_start].eq('status', 1) [cite: 447]
      [cite_start].not('stops_json', 'is', null); [cite: 448]

    [cite_start]if (error) throw error; [cite: 449]

    [cite_start]if (activeRoutes && activeRoutes.length > 0) { [cite: 450]
      [cite_start]for (const route of activeRoutes) { [cite: 451]
        [cite_start]const cleanupTime = calculateCleanupTime( [cite: 452]
          route.hora,
          [cite_start]route.duracion_horas, [cite: 453]
          parseFloat(route.despues_del_bloque) || [cite_start]0 [cite: 453]
        [cite_start]); [cite: 454]
        
        [cite_start]if (now >= cleanupTime) { [cite: 455]
          [cite_start]// Borrar stops_json y cambiar status a 0 [cite: 456]
          await supabase
            [cite_start].from('routes') [cite: 458]
            [cite_start].update({ [cite: 459]
              [cite_start]status: 0, [cite: 461]
              [cite_start]stops_json: null [cite: 462]
            [cite_start]}) [cite: 460]
            [cite_start].eq('id', route.id); [cite: 463]
          [cite_start]console.log(`🧹 Auto-cleanup: Ruta ${route.id} finalizada automáticamente`); [cite: 464]
        }
      [cite_start]} [cite: 466]
    }
  [cite_start]} catch (error) { [cite: 468]
    [cite_start]console.error('❌ Error en cron job de cleanup:', error); [cite: 470]
  }
}, 5 * 60 * 1000); [cite_start]// Cada 5 minutos [cite: 471]

[cite_start]console.log('🧹 Cron job de cleanup iniciado (cada 5 minutos)'); [cite: 472]
// --- Fin FASE 5 ---


// --- Tu `app.listen` (movido al final) ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v3.0 (ETA en Caliente) corriendo en http://localhost:${PORT}`);
});
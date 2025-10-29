// server.js (v3.0 - Implementación de ETA en Caliente)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');
const { createClient } = require('@supabase/supabase-js');

// --- 🆕 FASE 2: Dependencias de Encriptación ---
const crypto = require('crypto');
// IMPORTANTE: Asegúrate que STOPS_ENCRYPTION_KEY esté en tu .env
const ENCRYPTION_KEY = process.env.STOPS_ENCRYPTION_KEY; // Debe ser 32 bytes (64 hex)
const IV_LENGTH = 16;
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
function encryptStops(stopsArray) {
  try {
    const text = JSON.stringify(stopsArray);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), // Forzar 32 bytes
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ Error encriptando stops:', error);
    return null;
  }
}

function decryptStops(encryptedText) {
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32),
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Error desencriptando stops:', error);
    return null;
  }
}
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
app.post('/api/log-route', async (req, res) => {
    const logData = req.body;
    console.log('📦 Recibiendo datos v3 para guardar en bitácora');

    // Extraer datos nuevos
    const stopsArray = logData.stops_json; // Array de { number, address, isDowntown}
    const etaOptimista = logData.eta_optimista; // String "11:45 AM"
    const etaNormal = logData.eta_normal;
    const etaPesimista = logData.eta_pesimista;

    // Encriptar paradas
    const encryptedStops = stopsArray ? encryptStops(stopsArray) : null;
    if (stopsArray && !encryptedStops) {
      return res.status(500).json({
        success: false,
        message: 'Error al encriptar paradas. Verifica ENCRYPTION_KEY.'
      });
    }

    // Convertir ETAs de "11:45 AM" a formato TIME "11:45:00"
    const convertToTime = (etaString) => {
      if (!etaString) return null;
      try {
        const [time, period] = etaString.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      } catch (e) {
        console.error('Error convirtiendo ETA:', e);
        return null;
      }
    };

    const dataToInsert = {
        // --- Campos existentes ---
        fecha: logData.fecha,
        vehiculo: logData.vehiculo,
        warehouse: logData.warehouse,
        hora: logData.hora,
        duracion_horas: logData.duracion_horas,
        pago: logData.pago,
        pago_por_hora: logData.pago_por_hora,
        antes_del_bloque: logData.antes_del_bloque,
        despues_del_bloque: logData.despues_del_bloque,
        tiempo_total: logData.tiempo_total,
        pago_real_por_hora: logData.pago_real_por_hora,
        commute_1: logData.commute_1,
        commute_2: logData.commute_2,
        millas_de_trabajo: logData.millas_de_trabajo,
        millas_totales: logData.millas_totales,
        millas_por_hora: logData.millas_por_hora,
        gasto_de_gasolina: logData.gasto_de_gasolina,
        desgaste_vehiculo: logData.desgaste_vehiculo,
        tax: logData.tax,
        claim_por_milla: logData.claim_por_milla,
        route_score: logData.route_score,
        numero_paradas: logData.numero_paradas,
        user_id: logData.user_id,
        primary_city: logData.primary_city,
        first_stop: logData.first_stop,
        
        // --- 🆕 NUEVOS CAMPOS ---
        status: 1, // 1 = Ruta activa
        eta_optimista: convertToTime(etaOptimista),
        eta_normal: convertToTime(etaNormal),
        eta_pesimista: convertToTime(etaPesimista),
        stops_json: encryptedStops,
        eta_real: null,
        eta_real_input_date: null,
        notes: null
    };

    Object.keys(dataToInsert).forEach(key => {
        if (dataToInsert[key] === null || dataToInsert[key] === undefined) {
            delete dataToInsert[key];
        }
    });

    try {
        const { data, error } = await supabase
            .from('routes')
            .insert([dataToInsert])
            .select();

        if (error) {
            console.error('❌ Error de Supabase al insertar:', error.message);
            throw error;
        }

        console.log('💾 ¡Ruta v3 guardada con ETAs y stops encriptados!');
        res.status(200).json({ success: true, message: 'Ruta guardada en bitácora.', data: data });

    } catch (error) {
        console.error('❌ Error general en /api/log-route:', error.message);
        res.status(500).json({ success: false, message: 'Error al guardar en Supabase.', error: error.message });
    }
});
// --- Fin FASE 3 ---


// --- 🆕 FASE 4: Nuevos Endpoints ---

// 1. GET /api/active-route/:userId
app.get('/api/active-route/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 1)
      .order('fecha', { ascending: false }) // <-- CAMBIADO
      .order('hora', { ascending: false })  // <-- AÑADIDO
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return res.json({
          hasActiveRoute: false,
          message: 'No tienes ruta activa'
        });
      }
      throw error;
    }

    // Desencriptar paradas
    const stops = data.stops_json ? decryptStops(data.stops_json) : [];
    if (data.stops_json && !stops) {
      console.error('❌ Error desencriptando stops de ruta:', data.id);
      // Continuar sin paradas, pero reportar error
    }

    res.json({
      hasActiveRoute: true,
      route: {
        id: data.id,
        fecha: data.fecha,
        warehouse: data.warehouse,
        hora: data.hora,
        duracion_horas: data.duracion_horas,
        numero_paradas: data.numero_paradas,
        primary_city: data.primary_city,
        eta_optimista: data.eta_optimista,
        eta_normal: data.eta_normal,
        eta_pesimista: data.eta_pesimista,
        stops: stops, // Array desencriptado
        millas_totales: data.millas_totales,
        pago: data.pago
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo ruta activa:', error);
    res.status(500).json({
      hasActiveRoute: false,
      error: error.message
    });
  }
});

// 2. POST /api/calculate-live-eta

    console.log('🕐 Servidor timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('🕐 Hora servidor (now):', new Date().toString());
    console.log('🕐 Hora servidor (ISO):', new Date().toISOString());

app.post('/api/calculate-live-eta', async (req, res) => {
  const { routeId, currentStopNumber } = req.body;
  if (!routeId || !currentStopNumber) {
    return res.status(400).json({
      error: 'Falta routeId o currentStopNumber'
    });
  }

  try {
    // 1. Obtener ruta de BD
    const { data: route, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .eq('status', 1)
      .single();

    if (error) {
      throw new Error('Ruta no encontrada o ya finalizada');
    }
    // 2. Desencriptar paradas
    const allStops = decryptStops(route.stops_json);
    if (!allStops) {
      throw new Error('Error desencriptando paradas');
    }
    // 3. Filtrar paradas
    const remainingStops = allStops.filter(
      stop => stop.number >= currentStopNumber && stop.address
    );
    if (remainingStops.length === 0) {
      return res.status(400).json({
        error: 'No hay paradas restantes desde esa posición'
      });
    }

    console.log(`Recalculando desde parada ${currentStopNumber}`);
    console.log(`Paradas restantes: ${remainingStops.length} `);
    
    // 4. Construir ruta
    const currentStopAddress = remainingStops[0].address;
    // NOTA: Asumimos 'Casa' como destino. Idealmente, esto debería sacarse de la BD o un .env
    const finalDestinationAddress = '513 Alafaya Woods Blvd Oviedo, FL';
    
    const destinationForCalc = finalDestinationAddress;
    // Los waypoints son TODAS las paradas restantes EXCEPTO la actual (que es el origen)
    const waypointsForCalc = remainingStops.slice(1).map(s => s.address);


    // 5. Llamar a Google Maps API
    const routeResult = await calculateLeg(
      currentStopAddress,
      destinationForCalc, // Destino final (Casa)
      waypointsForCalc // Paradas intermedias de trabajo
    );

    if (routeResult.error) {
      throw new Error('Error calculando ruta con Google Maps');
    }

    // 6. Calcular ETAs
    const baseDriveMinutes = parseFloat(routeResult.duration) || 0;
    
    const stopCount = remainingStops.length;
    let aptCount = 0;
    let downtownCount = 0;
    remainingStops.forEach(stop => {
      if (stop.isDowntown) {
        downtownCount++;
        aptCount++; // Downtown cuenta como apt también
      } else if (stop.address && stop.address.match(/APT|UNIT|#/i)) {
        aptCount++;
      }
    });
    const regularApts = aptCount - downtownCount;

    // Función helper para calcular ETA
    const calculateETA = (multiplier) => {
      const baseStopTime = stopCount * multiplier;
      const extraAptTime = (regularApts * 1.5) + (downtownCount * 4.5);
      const totalMinutes = baseDriveMinutes + baseStopTime + extraAptTime;
      const now = new Date();
      const etaTime = new Date(now.getTime() + totalMinutes * 60000);

      return {
        totalMinutes: Math.round(totalMinutes),
        eta: etaTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York' // <-- ESTA ES LA LÍNEA MÁGICA
        })
      };
    };

    const liveETAs = {
      optimistic: calculateETA(0.90),
      normal: calculateETA(1.10),
      pessimistic: calculateETA(1.50)
    };

    console.log('✅ ETAs recalculados:', liveETAs);
    res.json({
      success: true,
      currentStop: currentStopNumber,
      remainingStops: remainingStops.length,
      remainingMiles: routeResult.distance,
      etas: liveETAs,
      breakdown: {
        baseDriveMinutes: Math.round(baseDriveMinutes),
        stopCount,
        aptCount,
        downtownCount
      }
    });

  } catch (error) {
    console.error('❌ Error en calculate-live-eta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. POST /api/complete-route
app.post('/api/complete-route', async (req, res) => {
  const { routeId, etaReal } = req.body; // etaReal: "5:11 PM"
  if (!routeId || !etaReal) {
    return res.status(400).json({
      error: 'Falta routeId o etaReal'
    });
  }

  try {
    // Convertir "5:11 PM" a "17:11:00"
    const convertToTime = (etaString) => {
      const [time, period] = etaString.trim().split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    };
    const timeFormatted = convertToTime(etaReal);

    const { data, error } = await supabase
      .from('routes')
      .update({
        status: 0,
        eta_real: timeFormatted,
        eta_real_input_date: new Date().toISOString(),
        stops_json: null // BORRAR DIRECCIONES
      })
      .eq('id', routeId)
      //.eq('status', 1) // Quitado para permitir actualizar rutas pendientes
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
      });
    }

    console.log(`✅ Ruta ${routeId} completada. ETA real: ${timeFormatted}`);
    res.json({
      success: true,
      message: 'Ruta completada y ETA real guardado',
      data: data[0]
    });
  } catch (error) {
    console.error('❌ Error completando ruta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. GET /api/pending-eta/:userId
app.get('/api/pending-eta/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('routes')
      .select('id, fecha, warehouse, hora, eta_normal, primary_city')
      .eq('user_id', userId)
      .eq('status', 0)
      .is('eta_real', null)
      .is('notes', null) // No tiene "user_skipped"
      .order('fecha', { ascending: false })
      .limit(5);

    if (error) throw error;
    res.json({
      hasPending: data.length > 0,
      routes: data
    });
  } catch (error) {
    console.error('❌ Error obteniendo rutas pendientes:', error);
    res.status(500).json({
      hasPending: false,
      error: error.message
    });
  }
});

// 5. POST /api/skip-eta
app.post('/api/skip-eta', async (req, res) => {
  const { routeId } = req.body;
  try {
    const { data, error } = await supabase
      .from('routes')
      .update({ notes: 'user_skipped' })
      .eq('id', routeId)
      .select();

    if (error) throw error;
    console.log(`✅ Usuario saltó ETA de ruta ${routeId}`);
    res.json({
      success: true,
      message: 'Ruta marcada como saltada'
    });
  } catch (error) {
    console.error('❌ Error saltando ETA:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// --- Fin FASE 4 ---


// --- 🆕 FASE 5: Cleanup Automático ---
// (Ejecutar ANTES de app.listen)

// Función helper para calcular cuándo borrar stops
// REEMPLAZA ESTA FUNCIÓN
const calculateCleanupTime = (fecha, hora, duracionHoras, despuesBloqueHoras) => {
  try {
    // fecha: "2025-10-29" (string de la BD)
    // hora: "16:30" (string de la BD)
    const [hours, minutes] = hora.split(':').map(Number);
    
    // USA LA FECHA DE LA RUTA, NO new Date()
    const startTime = new Date(fecha); 
    
    // Establece la hora asumiendo que el servidor es UTC
    // y la hora guardada es local (ET, ~4-5 horas de diferencia)
    // "16:30" se guardará como 16:30 UTC en la fecha de la ruta
    // Lo cual es incorrecto pero consistente con el bug original.
    // La clave es usar la FECHA de la ruta.
    startTime.setHours(hours, minutes, 0, 0);

    const totalMinutes = (duracionHoras + despuesBloqueHoras) * 60 + 30; // +30min buffer
    return new Date(startTime.getTime() + totalMinutes * 60000);
  } catch(e) {
    console.error("Error en calculateCleanupTime", e);
    return new Date(0); 
  }
};

// Ejecutar cada 5 minutos
// REEMPLAZA ESTE BLOQUE
setInterval(async () => {
  try {
    const now = new Date();
    // Obtener rutas activas que ya deberian haberse completado
    // AÑADIMOS "fecha" AL SELECT
    const { data: activeRoutes, error } = await supabase
      .from('routes')
      .select('id, fecha, hora, duracion_horas, despues_del_bloque') // <-- CAMBIO AQUÍ
      .eq('status', 1)
      .not('stops_json', 'is', null);

    if (error) throw error;

    if (activeRoutes && activeRoutes.length > 0) {
      for (const route of activeRoutes) {
        
        // PASAMOS "route.fecha" A LA FUNCIÓN
        const cleanupTime = calculateCleanupTime(
          route.fecha,  // <-- CAMBIO AQUÍ
          route.hora,
          route.duracion_horas,
          parseFloat(route.despues_del_bloque) || 0
        );
        
        if (now >= cleanupTime) {
          // Borrar stops_json y cambiar status a 0
          await supabase
            .from('routes')
            .update({
              status: 0,
              stops_json: null
            })
            .eq('id', route.id);
          console.log(`🧹 Auto-cleanup: Ruta ${route.id} finalizada automáticamente`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error en cron job de cleanup:', error);
  }
}, 5 * 60 * 1000); // Cada 5 minutos

console.log('🧹 Cron job de cleanup iniciado (cada 5 minutos)');
// --- Fin FASE 5 ---


// --- Tu `app.listen` (movido al final) ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v3.0 (ETA en Caliente) corriendo en http://localhost:${PORT}`);
});
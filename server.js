// server.js (v3.0 - Implementación de ETA en Caliente)

const { DateTime } = require('luxon');
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
  'https://flex-optimizer-git-v20-app-layout-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-pvt01to14-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-1zyl30b71-ernestos-projects-d9e7c95d.vercel.app/',
  'https://flex-optimizer-git-feature-sc-8b70f7-ernestos-projects-d9e7c95d.vercel.app/'
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

// Verificación de timezone al iniciar
console.log('=================================================');
console.log('🌍 SERVER TIMEZONE INFO:');
console.log('   System TZ:', process.env.TZ || 'Not set');
console.log('   Node.js TZ:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('   Current Time (Luxon):', DateTime.now().setZone('America/New_York').toLocaleString(DateTime.DATETIME_FULL));
console.log('   Current Time (Native):', new Date().toString());
console.log('=================================================');
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
    // 🔥 LOGS CRÍTICOS
  console.log('═══════════════════════════════════════');
  console.log('🔍 [active-route] INICIANDO BÚSQUEDA');
  console.log('📋 User ID recibido:', userId);
  console.log('📋 User ID tipo:', typeof userId);
  console.log('📋 User ID length:', userId.length);
  console.log('═══════════════════════════════════════');
  try {
    // 🔥 SIMPLE: Traer la ruta más reciente con status=1
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 1)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({
        hasActiveRoute: false,
        message: 'No tienes ruta activa'
      });
    }

    const route = data[0];
    const stops = route.stops_json ? decryptStops(route.stops_json) : [];

    res.json({
      hasActiveRoute: true,
      route: {
        id: route.id,
        fecha: route.fecha,
        warehouse: route.warehouse,
        hora: route.hora,
        duracion_horas: route.duracion_horas,
        numero_paradas: route.numero_paradas,
        primary_city: route.primary_city,
        eta_optimista: route.eta_optimista,
        eta_normal: route.eta_normal,
        eta_pesimista: route.eta_pesimista,
        stops: stops,
        millas_totales: route.millas_totales,
        pago: route.pago
      }
    });
    
  } catch (error) {
    console.error('❌ [active-route] Error:', error);
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

// REEMPLAZA TU ENDPOINT /api/calculate-live-eta CON ESTE:

// 2. POST /api/calculate-live-eta (CON SEGMENTACIÓN)
app.post('/api/calculate-live-eta', async (req, res) => {
  const { routeId, currentStopNumber } = req.body;
  if (!routeId || !currentStopNumber) {
    return res.status(400).json({
      error: 'Falta routeId o currentStopNumber'
    });
  }

  try {
    // 1. Obtener ruta y 2. Desencriptar paradas (Sin cambios)
    const { data: route, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .eq('status', 1)
      .single();

    if (error) {
      throw new Error('Ruta no encontrada o ya finalizada');
    }
    const allStops = decryptStops(route.stops_json);
    if (!allStops) {
      throw new Error('Error desencriptando paradas');
    }
    
    // 3. Filtrar paradas (Sin cambios)
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
    
    // --- 4. 🆕 CONSTRUIR RUTA SEGMENTADA ---
    
    // Lista de todos los puntos a visitar: 
    // [ParadaActual, SiguienteParada, ..., UltimaParada, Casa]
    const finalDestinationAddress = '513 Alafaya Woods Blvd Oviedo, FL';
    const allRemainingPoints = remainingStops.map(s => s.address);
    allRemainingPoints.push(finalDestinationAddress);

    // Límite de Google: 1 Origen + 25 Waypoints + 1 Destino = 27 puntos
    // Usamos 26 por seguridad (1 Origen + 24 Waypoints + 1 Destino)
    const STOPS_PER_SEGMENT = 26; 
    const routeSegments = [];

    for (let i = 0; i < allRemainingPoints.length; i += (STOPS_PER_SEGMENT - 1)) {
        const segmentPoints = allRemainingPoints.slice(i, i + STOPS_PER_SEGMENT);
        
        if (segmentPoints.length > 0) {
            // Si es el último segmento y solo tiene 1 punto,
            // ya fue el destino del segmento anterior.
            if (segmentPoints.length === 1 && i > 0) {
               break; 
            }

            routeSegments.push({
                origin: segmentPoints[0],
                destination: segmentPoints[segmentPoints.length - 1],
                waypoints: segmentPoints.slice(1, -1) // Waypoints intermedios
            });
        }
    }
    // ========================================
// SCHEDULED BLOCKS ENDPOINTS - v4.1
// ========================================

// 1. GET /api/scheduled-blocks/:userId - Obtener bloques de un usuario
app.get('/api/scheduled-blocks/:userId', async (req, res) => {
  const { userId } = req.params;
  const { status, startDate, endDate } = req.query;
  
  try {
    let query = supabase
      .from('scheduled_blocks')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
    
    // Filtros opcionales
    if (status) {
      query = query.eq('status', status);
    }
    
    if (startDate) {
      query = query.gte('fecha', startDate);
    }
    
    if (endDate) {
      query = query.lte('fecha', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    console.log(`✅ Bloques obtenidos para user ${userId}:`, data?.length || 0);
    res.json({ success: true, blocks: data || [] });
    
  } catch (error) {
    console.error('❌ Error obteniendo bloques:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. POST /api/scheduled-blocks - Crear nuevo bloque
app.post('/api/scheduled-blocks', async (req, res) => {
  const { user_id, fecha, hora, duracion_horas, pago, warehouse, vehiculo, notes } = req.body;
  
  // Validación
  if (!user_id || !fecha || !hora || !duracion_horas || !pago || !warehouse || !vehiculo) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan campos requeridos' 
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .insert([{
        user_id,
        fecha,
        hora,
        duracion_horas,
        pago,
        warehouse,
        vehiculo,
        notes,
        status: 'scheduled'
      }])
      .select();
    
    if (error) {
      // Error de constraint (bloque duplicado)
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un bloque agendado a esa hora'
        });
      }
      throw error;
    }
    
    console.log('✅ Bloque creado:', data[0].id);
    res.json({ success: true, block: data[0] });
    
  } catch (error) {
    console.error('❌ Error creando bloque:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. PUT /api/scheduled-blocks/:blockId - Actualizar bloque
app.put('/api/scheduled-blocks/:blockId', async (req, res) => {
  const { blockId } = req.params;
  const updates = req.body;
  
  // No permitir cambiar user_id ni created_at
  delete updates.user_id;
  delete updates.created_at;
  
  try {
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .update(updates)
      .eq('id', blockId)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bloque no encontrado'
      });
    }
    
    console.log('✅ Bloque actualizado:', blockId);
    res.json({ success: true, block: data[0] });
    
  } catch (error) {
    console.error('❌ Error actualizando bloque:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. DELETE /api/scheduled-blocks/:blockId - Eliminar/Cancelar bloque
app.delete('/api/scheduled-blocks/:blockId', async (req, res) => {
  const { blockId } = req.params;
  const { soft } = req.query; // ?soft=true para cancelar en lugar de eliminar
  
  try {
    if (soft === 'true') {
      // Soft delete: Cambiar status a 'cancelled'
      const { data, error } = await supabase
        .from('scheduled_blocks')
        .update({ status: 'cancelled' })
        .eq('id', blockId)
        .select();
      
      if (error) throw error;
      
      console.log('✅ Bloque cancelado:', blockId);
      res.json({ success: true, message: 'Bloque cancelado', block: data[0] });
      
    } else {
      // Hard delete: Eliminar permanentemente
      const { error } = await supabase
        .from('scheduled_blocks')
        .delete()
        .eq('id', blockId);
      
      if (error) throw error;
      
      console.log('✅ Bloque eliminado:', blockId);
      res.json({ success: true, message: 'Bloque eliminado' });
    }
    
  } catch (error) {
    console.error('❌ Error eliminando bloque:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. POST /api/scheduled-blocks/:blockId/start - Iniciar bloque (vincula con route)
app.post('/api/scheduled-blocks/:blockId/start', async (req, res) => {
  const { blockId } = req.params;
  const { routeId } = req.body;
  
  if (!routeId) {
    return res.status(400).json({
      success: false,
      error: 'routeId es requerido'
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .update({
        status: 'started',
        route_id: routeId
      })
      .eq('id', blockId)
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Bloque ${blockId} iniciado con route ${routeId}`);
    res.json({ success: true, block: data[0] });
    
  } catch (error) {
    console.error('❌ Error iniciando bloque:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. GET /api/scheduled-blocks/:userId/week-summary - Resumen semanal
app.get('/api/scheduled-blocks/:userId/week-summary', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Obtener fecha de inicio de semana (lunes)
    const today = DateTime.now().setZone('America/New_York');
    const startOfWeek = today.startOf('week').toISODate();
    const endOfWeek = today.endOf('week').toISODate();
    
    console.log(`📊 Resumen semanal: ${startOfWeek} a ${endOfWeek}`);
    
    // Bloques agendados esta semana
    const { data: blocks, error: blocksError } = await supabase
      .from('scheduled_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('fecha', startOfWeek)
      .lte('fecha', endOfWeek)
      .neq('status', 'cancelled');
    
    if (blocksError) throw blocksError;
    
    // Rutas completadas esta semana
    const { data: routes, error: routesError } = await supabase
      .from('routes')
      .select('duracion_horas, pago, millas_totales')
      .eq('user_id', userId)
      .gte('fecha', startOfWeek)
      .lte('fecha', endOfWeek)
      .eq('status', 0); // Completadas
    
    if (routesError) throw routesError;
    
    // Calcular totales
    const totalHorasAgendadas = blocks.reduce((sum, b) => sum + (b.duracion_horas || 0), 0);
    const totalPagoAgendado = blocks.reduce((sum, b) => sum + (b.pago || 0), 0);
    
    const totalHorasTrabajadas = routes.reduce((sum, r) => sum + (r.duracion_horas || 0), 0);
    const totalPagoGanado = routes.reduce((sum, r) => sum + (r.pago || 0), 0);
    const totalMillas = routes.reduce((sum, r) => sum + (r.millas_totales || 0), 0);
    
    res.json({
      success: true,
      summary: {
        weekStart: startOfWeek,
        weekEnd: endOfWeek,
        scheduled: {
          blocks: blocks.length,
          hours: totalHorasAgendadas.toFixed(1),
          pay: totalPagoAgendado.toFixed(2)
        },
        completed: {
          routes: routes.length,
          hours: totalHorasTrabajadas.toFixed(1),
          pay: totalPagoGanado.toFixed(2),
          miles: totalMillas.toFixed(1)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error en resumen semanal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

    // 5. 🆕 LLAMAR A GOOGLE MAPS API POR SEGMENTOS
    const segmentPromises = routeSegments.map(seg => 
        calculateLeg(seg.origin, seg.destination, seg.waypoints)
    );
    
    const segmentResults = await Promise.all(segmentPromises);

    // 6. 🆕 CALCULAR TOTALES Y ETAs
    let totalDistance = 0;
    let totalDuration = 0;
    let hasError = false;

    segmentResults.forEach(res => {
      if (res.error) hasError = true;
      totalDuration += res.duration;
      totalDistance += parseFloat(res.distance);
    });

    if (hasError) {
      throw new Error('Error calculando un segmento de la ruta con Google Maps');
    }
    
    // A partir de aquí, la lógica es la misma que antes, 
    // pero usando los totales de los segmentos.
    
    const baseDriveMinutes = totalDuration; // Tiempo total de conducción (trabajo + commute)
    const remainingMiles = totalDistance;
    
    // Contar paradas de TRABAJO (sin incluir la casa)
    const stopCount = remainingStops.length; 
    let aptCount = 0;
    let downtownCount = 0;
    remainingStops.forEach(stop => {
      if (stop.isDowntown) {
        downtownCount++;
        aptCount++; 
      } else if (stop.address && stop.address.match(/APT|UNIT|#/i)) {
        aptCount++;
      }
    });
    const regularApts = aptCount - downtownCount;

    // Función helper (con la corrección de zona horaria que hicimos antes)
    const calculateETA = (multiplier) => {
      const baseStopTime = stopCount * multiplier;
      const extraAptTime = (regularApts * 1.5) + (downtownCount * 4.5);
      // Total = (Drive + Commute) + (Tiempo de Paradas)
      const totalMinutes = baseDriveMinutes + baseStopTime + extraAptTime; 
      const now = new Date();
      const etaTime = new Date(now.getTime() + totalMinutes * 60000);
      return {
        totalMinutes: Math.round(totalMinutes),
        eta: etaTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York' 
        })
      };
    };

    const liveETAs = {
      optimistic: calculateETA(0.90),
      normal: calculateETA(1.10),
      pessimistic: calculateETA(1.50)
    };

    console.log('✅ ETAs recalculados (segmentados):', liveETAs);
    res.json({
      success: true,
      currentStop: currentStopNumber,
      remainingStops: remainingStops.length,
      remainingMiles: remainingMiles.toFixed(2), // 🆕 Enviamos las millas totales
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
// 🆕 Función mejorada con Luxon
const calculateCleanupTime = (hora, duracionHoras, despuesBloqueHoras) => {
    try {
        const [hours, minutes] = hora.split(':').map(Number);
        
        // Crear fecha/hora en Eastern Time explícitamente
        let startTime = DateTime.now()
            .setZone('America/New_York')
            .set({ 
                hour: hours, 
                minute: minutes, 
                second: 0, 
                millisecond: 0 
            });
        
        // Calcular tiempo total hasta cleanup (duración + después + 30min buffer)
        const totalMinutes = (duracionHoras + despuesBloqueHoras) * 60 + 30;
        
        // Sumar los minutos y retornar como Date nativo (para Supabase)
        const cleanupTime = startTime.plus({ minutes: totalMinutes });
        
        console.log(`🧹 Cleanup calculado: ${cleanupTime.toLocaleString(DateTime.DATETIME_FULL)}`);
        
        return cleanupTime.toJSDate(); // Convertir a Date para comparación
    } catch (error) {
        console.error('❌ Error calculando cleanup time:', error);
        // Fallback: 6 horas desde ahora
        return DateTime.now()
            .setZone('America/New_York')
            .plus({ hours: 6 })
            .toJSDate();
    }
};

// Ejecutar cada 5 minutos
// REEMPLAZA ESTE BLOQUE
// ⏰ CRON JOB MEJORADO CON LUXON
setInterval(async () => {
    try {
        const now = DateTime.now().setZone('America/New_York');
        
        console.log(`🧹 [Cleanup] Ejecutando a las ${now.toLocaleString(DateTime.DATETIME_SHORT)}`);
        
        // Obtener rutas activas que aún tienen stops_json
        const { data: activeRoutes, error } = await supabase
            .from('routes')
            .select('id, hora, duracion_horas, despues_del_bloque, fecha')
            .eq('status', 1)
            .not('stops_json', 'is', null);

        if (error) throw error;

        if (activeRoutes && activeRoutes.length > 0) {
            console.log(`🔍 [Cleanup] Encontradas ${activeRoutes.length} rutas activas con stops_json`);
            
            for (const route of activeRoutes) {
                const cleanupTime = calculateCleanupTime(
                    route.hora,
                    route.duracion_horas || 0,
                    parseFloat(route.despues_del_bloque) || 0
                );

                const cleanupTimeLuxon = DateTime.fromJSDate(cleanupTime).setZone('America/New_York');
                
                console.log(`📋 [Cleanup] Ruta ${route.id}:`);
                console.log(`   - Inicio: ${route.hora}`);
                console.log(`   - Cleanup programado: ${cleanupTimeLuxon.toLocaleString(DateTime.DATETIME_SHORT)}`);
                console.log(`   - Hora actual: ${now.toLocaleString(DateTime.DATETIME_SHORT)}`);

                if (now >= cleanupTimeLuxon) {
                    // Borrar stops_json y cambiar status a 0
                    const { error: updateError } = await supabase
                        .from('routes')
                        .update({ 
                            status: 0,
                            stops_json: null 
                        })
                        .eq('id', route.id);

                    if (updateError) {
                        console.error(`❌ [Cleanup] Error actualizando ruta ${route.id}:`, updateError);
                    } else {
                        console.log(`✅ [Cleanup] Ruta ${route.id} finalizada automáticamente`);
                    }
                } else {
                    const minutesRemaining = cleanupTimeLuxon.diff(now, 'minutes').minutes;
                    console.log(`⏳ [Cleanup] Ruta ${route.id} aún activa (faltan ${Math.round(minutesRemaining)} min)`);
                }
            }
        } else {
            console.log('ℹ️ [Cleanup] No hay rutas activas con stops_json');
        }
    } catch (error) {
        console.error('❌ [Cleanup] Error en cron job:', error);
    }
}, 5 * 60 * 1000); // Cada 5 minutos

console.log('⏰ Cron job de cleanup iniciado (cada 5 minutos) usando Eastern Time');
// --- Fin FASE 5 ---


// --- Tu `app.listen` (movido al final) ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v3.0 (ETA en Caliente) corriendo en http://localhost:${PORT}`);
});
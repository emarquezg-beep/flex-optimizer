// server.js (v3.1 - Con Segmentos Inversos Reales)

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
  'https://flex-optimizer-git-feature-sc-8b70f7-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-fzy130b7l-ernestos-projects-d9e7c95d.vercel.app',
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

// --- Tu endpoint `/api/optimize-route` (CON SEGMENTOS INVERSOS) ---
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

    console.log('✅ v1.8: Calculando con método manual correcto...');
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

    // 🆕 CREAR SEGMENTOS INVERSOS (para ruta inversa)
    const inverseWorkStops = [...workStops].reverse(); // Invertir el orden de paradas
    const inverseSegments = [];

    for (let i = 0; i < inverseWorkStops.length; i += 9) {
        const segmentStops = inverseWorkStops.slice(i, i + 10);
        
        if (segmentStops.length > 0) {
            inverseSegments.push({
                origin: segmentStops[0],
                destination: segmentStops[segmentStops.length - 1],
                waypoints: segmentStops.slice(1, -1)
            });
        }
    }

    console.log(`   Segmentos inversos creados: ${inverseSegments.length}`);
    inverseSegments.forEach((seg, idx) => {
        console.log(`   Segmento Inverso ${idx + 1}: ${seg.origin} → ${seg.destination} (${seg.waypoints.length} waypoints)`);
    });

    const segmentPromises = workStopSegments.map(seg => 
        calculateLeg(seg.origin, seg.destination, seg.waypoints)
    );
    
    // 🆕 CALCULAR SEGMENTOS INVERSOS
    const inverseSegmentPromises = inverseSegments.map(seg =>
        calculateLeg(seg.origin, seg.destination, seg.waypoints)
    );
    
    const [toFirstStop, toFinalDestination, toLastStopForInverse, fromFirstStopToHome, ...allSegmentResults] = await Promise.all([
        toFirstStopPromise,
        toFinalDestinationPromise,
        toLastStopForInversePromise,
        fromFirstStopToHomePromise,
        ...segmentPromises,
        ...inverseSegmentPromises // 🆕 AGREGAR PROMESAS INVERSAS
    ]);

    // 🆕 SEPARAR RESULTADOS
    const normalSegmentCount = workStopSegments.length;
    const segmentResults = allSegmentResults.slice(0, normalSegmentCount);
    const inverseSegmentResults = allSegmentResults.slice(normalSegmentCount);

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
            type: 'Warehouse → Última Parada (Inversa)',
            from: origin,
            to: lastStop,
            errorType: toLastStopForInverse.errorType
        });
    }
    
    if (fromFirstStopToHome.error) {
        failedAddresses.push({
            type: 'Primera Parada → Destino (Inversa)',
            from: firstStop,
            to: finalDestination,
            errorType: fromFirstStopToHome.errorType
        });
    }

    segmentResults.forEach((result, idx) => {
        if (result.error) {
            failedAddresses.push({
                type: `Segmento ${idx + 1}`,
                from: workStopSegments[idx].origin,
                to: workStopSegments[idx].destination,
                errorType: result.errorType
            });
        }
    });

    // 🆕 VERIFICAR ERRORES EN SEGMENTOS INVERSOS
    inverseSegmentResults.forEach((result, idx) => {
        if (result.error) {
            failedAddresses.push({
                type: `Segmento Inverso ${idx + 1}`,
                from: inverseSegments[idx].origin,
                to: inverseSegments[idx].destination,
                errorType: result.errorType
            });
        }
    });

    if (failedAddresses.length > 0) {
        console.error('❌ Errores en el cálculo de rutas:', failedAddresses);
        return res.status(422).json({
            message: 'Error calculando algunas direcciones',
            hasErrors: true,
            failedAddresses
        });
    }

    const segmentsWithStops = segmentResults.map((result, idx) => {
        const segStops = workStopSegments[idx].waypoints.length > 0 
            ? [workStopSegments[idx].origin, ...workStopSegments[idx].waypoints, workStopSegments[idx].destination]
            : [workStopSegments[idx].origin, workStopSegments[idx].destination];
        
        return {
            distance: result.distance,
            duration: result.duration,
            stops: segStops
        };
    });

    // 🆕 AGREGAR STOPS A SEGMENTOS INVERSOS
    const inverseSegmentsWithStops = inverseSegmentResults.map((result, idx) => {
        const segStops = inverseSegments[idx].waypoints.length > 0 
            ? [inverseSegments[idx].origin, ...inverseSegments[idx].waypoints, inverseSegments[idx].destination]
            : [inverseSegments[idx].origin, inverseSegments[idx].destination];
        
        return {
            distance: result.distance,
            duration: result.duration,
            stops: segStops
        };
    });

    console.log('🎉 v1.8: Cálculo completado correctamente (con ruta inversa real)');
    console.log('   RUTA NORMAL:');
    console.log(`   Warehouse → Primera: ${toFirstStop.distance} mi`);
    segmentsWithStops.forEach((seg, idx) => {
        console.log(`   Segmento ${idx + 1}: ${seg.distance} mi (${seg.stops.length} paradas)`);
    });
    console.log(`   Última → Destino: ${toFinalDestination.distance} mi`);
    console.log('   ');
    console.log('   RUTA INVERSA:');
    console.log(`   Warehouse → Última: ${toLastStopForInverse.distance} mi`);
    inverseSegmentsWithStops.forEach((seg, idx) => {
        console.log(`   Segmento Inverso ${idx + 1}: ${seg.distance} mi (${seg.stops.length} paradas)`);
    });
    console.log(`   Primera → Destino: ${fromFirstStopToHome.distance} mi`);

    res.json({
      hasErrors: false,
      toFirstStop,
      segments: segmentsWithStops,
      toFinalDestination,
      inverseRouteLegs: {
        toLastStop: toLastStopForInverse,
        fromFirstStop: fromFirstStopToHome,
        segments: inverseSegmentsWithStops // 🆕 SEGMENTOS INVERSOS REALES
      }
    });

  } catch (error) {
    console.error('❌ Error general:', error);
    res.status(500).json({
      message: 'Error interno del servidor',
      hasErrors: true,
      error: error.message
    });
  }
});

// --- 🆕 FASE 3: Endpoint POST /api/save-route ---
app.post('/api/save-route', async (req, res) => {
  const { username, fecha, hora, duracion_horas, antes_del_bloque, despues_del_bloque, stops } = req.body;
  
  if (!username || !fecha || !hora || !stops || stops.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan campos requeridos' 
    });
  }
  
  try {
    // 🔐 ENCRIPTAR STOPS ANTES DE GUARDAR
    const encryptedStops = encryptStops(stops);
    
    if (!encryptedStops) {
      return res.status(500).json({
        success: false,
        error: 'Error encriptando las paradas'
      });
    }
    
    const { data, error } = await supabase
      .from('routes')
      .insert([{
        username,
        fecha,
        hora,
        duracion_horas,
        antes_del_bloque,
        despues_del_bloque,
        stops_json: encryptedStops, // 🔐 Guardar encriptado
        status: 1
      }])
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Ruta creada: ID ${data[0].id} (stops encriptados)`);
    
    res.json({
      success: true,
      message: 'Ruta guardada correctamente',
      route: {
        id: data[0].id,
        username: data[0].username,
        fecha: data[0].fecha,
        hora: data[0].hora,
        status: data[0].status
      }
    });
    
  } catch (error) {
    console.error('❌ Error guardando ruta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- 🆕 FASE 3: Endpoint GET /api/routes (con desencriptación) ---
app.get('/api/routes', async (req, res) => {
  const { username, status } = req.query;
  
  try {
    let query = supabase.from('routes').select('*');
    
    if (username) {
      query = query.eq('username', username);
    }
    
    if (status !== undefined) {
      query = query.eq('status', parseInt(status));
    }
    
    const { data, error } = await supabase.from('routes').select('*').order('fecha', { ascending: false });
    
    if (error) throw error;
    
    // 🔓 DESENCRIPTAR STOPS SI EXISTEN
    const routesWithDecryptedStops = data.map(route => {
      if (route.stops_json) {
        const decrypted = decryptStops(route.stops_json);
        return {
          ...route,
          stops: decrypted || [] // Si falla desencriptación, retornar array vacío
        };
      }
      return {
        ...route,
        stops: []
      };
    });
    
    res.json({
      success: true,
      routes: routesWithDecryptedStops
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo rutas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- 🆕 FASE 4: Endpoint GET /api/routes/:id (con desencriptación) ---
app.get('/api/routes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    }
    
    // 🔓 DESENCRIPTAR STOPS
    let decryptedStops = [];
    if (data.stops_json) {
      decryptedStops = decryptStops(data.stops_json) || [];
    }
    
    res.json({
      success: true,
      route: {
        ...data,
        stops: decryptedStops
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo ruta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- 🆕 FASE 4: Endpoint PUT /api/routes/:id/finish ---
app.put('/api/routes/:id/finish', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('routes')
      .update({ 
        status: 0,
        stops_json: null // Borrar stops al finalizar
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    }
    
    console.log(`✅ Ruta ${id} finalizada y stops borrados`);
    
    res.json({
      success: true,
      message: 'Ruta finalizada correctamente',
      route: data[0]
    });
    
  } catch (error) {
    console.error('❌ Error finalizando ruta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- 🆕 FASE 6: Endpoints de Scheduled Blocks ---

// 1. GET /api/scheduled-blocks
// Obtiene todos los bloques agendados (opcionalmente filtrados por usuario y/o fecha)
app.get('/api/scheduled-blocks', async (req, res) => {
  const { username, fecha } = req.query;
  
  try {
    let query = supabase
      .from('scheduled_blocks')
      .select('*')
      .neq('status', 'cancelled') // Excluir bloques cancelados por defecto
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
    
    if (username) {
      query = query.eq('username', username);
    }
    
    if (fecha) {
      query = query.eq('fecha', fecha);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    console.log(`✅ ${data.length} bloques agendados obtenidos`);
    
    res.json({
      success: true,
      blocks: data
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo bloques agendados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. GET /api/scheduled-blocks/:id
// Obtiene un bloque específico por ID
app.get('/api/scheduled-blocks/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Bloque no encontrado'
      });
    }
    
    res.json({
      success: true,
      block: data
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo bloque:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. POST /api/scheduled-blocks
// Crea un nuevo bloque agendado
app.post('/api/scheduled-blocks', async (req, res) => {
  const { username, fecha, hora, duracion_horas, antes_del_bloque, despues_del_bloque } = req.body;
  
  // Validación básica
  if (!username || !fecha || !hora) {
    return res.status(400).json({
      success: false,
      error: 'Faltan campos requeridos: username, fecha, hora'
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .insert([{
        username,
        fecha,
        hora,
        duracion_horas: duracion_horas || 4,
        antes_del_bloque: antes_del_bloque || '0',
        despues_del_bloque: despues_del_bloque || '0',
        status: 'scheduled'
      }])
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Bloque agendado creado: ID ${data[0].id}`);
    
    res.json({
      success: true,
      message: 'Bloque agendado correctamente',
      block: data[0]
    });
    
  } catch (error) {
    console.error('❌ Error creando bloque agendado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. PUT /api/scheduled-blocks/:id
// Actualiza un bloque existente
app.put('/api/scheduled-blocks/:id', async (req, res) => {
  const { id } = req.params;
  const { fecha, hora, duracion_horas, antes_del_bloque, despues_del_bloque, status } = req.body;
  
  try {
    // Construir objeto de actualización solo con campos proporcionados
    const updates = {};
    if (fecha !== undefined) updates.fecha = fecha;
    if (hora !== undefined) updates.hora = hora;
    if (duracion_horas !== undefined) updates.duracion_horas = duracion_horas;
    if (antes_del_bloque !== undefined) updates.antes_del_bloque = antes_del_bloque;
    if (despues_del_bloque !== undefined) updates.despues_del_bloque = despues_del_bloque;
    if (status !== undefined) updates.status = status;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionaron campos para actualizar'
      });
    }
    
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bloque no encontrado'
      });
    }
    
    console.log(`✅ Bloque ${id} actualizado`);
    
    res.json({
      success: true,
      message: 'Bloque actualizado correctamente',
      block: data[0]
    });
    
  } catch (error) {
    console.error('❌ Error actualizando bloque:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. DELETE /api/scheduled-blocks/:id
// Cancela un bloque (soft delete)
app.delete('/api/scheduled-blocks/:id', async (req, res) => {
  const { id } = req.params;
  const { soft } = req.query; // ?soft=true para soft delete
  
  try {
    if (soft === 'true') {
      // Soft delete: cambiar status a 'cancelled'
      const { data, error } = await supabase
        .from('scheduled_blocks')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Bloque no encontrado'
        });
      }
      
      console.log(`✅ Bloque ${id} cancelado (soft delete)`);
      
      res.json({
        success: true,
        message: 'Bloque cancelado',
        block: data[0]
      });
      
    } else {
      // Hard delete: borrar permanentemente
      const { error } = await supabase
        .from('scheduled_blocks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      console.log(`✅ Bloque ${id} eliminado (hard delete)`);
      
      res.json({
        success: true,
        message: 'Bloque eliminado permanentemente'
      });
    }
    
  } catch (error) {
    console.error('❌ Error eliminando bloque:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. POST /api/scheduled-blocks/:id/start
// Marca un bloque como "en progreso" y lo vincula con la ruta creada
app.post('/api/scheduled-blocks/:id/start', async (req, res) => {
  const { id } = req.params;
  const { routeId } = req.body;
  
  if (!routeId) {
    return res.status(400).json({
      success: false,
      error: 'routeId es requerido'
    });
  }
  
  try {
    // Actualizar el bloque agendado
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .update({ 
        status: 'in_progress',
        route_id: routeId
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bloque no encontrado'
      });
    }
    
    console.log(`✅ Bloque ${id} marcado como en progreso (route_id: ${routeId})`);
    
    res.json({
      success: true,
      message: 'Bloque vinculado con ruta',
      block: data[0]
    });
    
  } catch (error) {
    console.error('❌ Error vinculando bloque con ruta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- Fin FASE 6 ---


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
  console.log(`🚀 Servidor backend v3.1 (Con Segmentos Inversos Reales) corriendo en http://localhost:${PORT}`);
});
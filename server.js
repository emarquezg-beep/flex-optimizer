// server.js (v3.1 - ETA en Caliente + Segmentos Inversos v1.8)

import { DateTime } from 'luxon';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { Client } from '@googlemaps/google-maps-services-js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// IMPORTANTE: Asegúrate que STOPS_ENCRYPTION_KEY esté en tu .env
const ENCRYPTION_KEY = process.env.STOPS_ENCRYPTION_KEY; // Debe ser 32 bytes (64 hex)
const IV_LENGTH = 16;
// --- Fin FASE 2 ---

const app = express();
const PORT = 3000;

// Tu configuración de CORS (sin cambios)
// forzando commit
const allowedOrigins = [
  'http://localhost:5173',
  'https://flex-optimizer.vercel.app',
  'https://flex-optimizer-git-user-profi-b2628b-ernestos-projects-d9e7c95d.vercel.app',
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
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
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

// ═══════════════════════════════════════════════════════════════
// 🔐 MIDDLEWARE DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════

async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No se proporcionó token de autenticación'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ Token inválido:', error?.message || 'Usuario no encontrado');
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    // Agregar usuario al request
    req.user = user;
    req.userId = user.id;
    
    console.log('✅ Usuario autenticado:', user.email, '- ID:', user.id);
    
    next();
  } catch (error) {
    console.error('❌ Error en autenticación:', error);
    return res.status(401).json({
      success: false,
      error: 'Error de autenticación'
    });
  }
}

console.log('🔐 Middleware de autenticación configurado');

// ═══════════════════════════════════════════════════════════════
// FIN MIDDLEWARE DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// 🤖 ARIA SYSTEM (Adaptive Route Intelligence Algorithm)
// ═══════════════════════════════════════════════════════════════

async function calcularMultiplierARIA(userId) {
  try {
    console.log('🤖 ARIA: Calculando multiplier dinámico para user:', userId);
    
    // Obtener últimas 20 rutas con ETA normal Y real
    const { data, error } = await supabase
      .from('routes')
      .select('error_por_parada, numero_paradas, fecha')
      .eq('user_id', userId)
      .eq('destination_changed', false) // 🆕 SOLO rutas válidas para ARIA
      .not('eta_normal', 'is', null)
      .not('eta_real', 'is', null)
      .not('numero_paradas', 'is', null)
      .gt('numero_paradas', 10) // Filtrar rutas muy cortas
      .order('fecha', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('❌ ARIA: Error al obtener datos:', error);
      return { multiplier: 0.9, rutasAnalizadas: 0, ajuste: 0 };
    }
    
    if (!data || data.length < 5) {
      console.log('⚠️ ARIA: No hay suficientes datos (mínimo 5 rutas), usando default 0.9');
      return { multiplier: 0.9, rutasAnalizadas: data?.length || 0, ajuste: 0 };
    }
    
    // Calcular promedio del error por parada
    const erroresValidos = data.filter(r => 
      r.error_por_parada !== null && 
      Math.abs(r.error_por_parada) < 3 // Filtrar outliers extremos (>3 min/parada)
    );
    
    if (erroresValidos.length === 0) {
      console.log('⚠️ ARIA: No hay errores válidos, usando default 0.9');
      return { multiplier: 0.9, rutasAnalizadas: 0, ajuste: 0 };
    }
    
    const avgError = erroresValidos.reduce((sum, r) => sum + r.error_por_parada, 0) / erroresValidos.length;
    
    // Ajustar multiplier base (0.9)
    let nuevoMultiplier = 0.9 + avgError;
    
    // Límites de seguridad
    nuevoMultiplier = Math.max(0.3, Math.min(2.0, nuevoMultiplier));
    
    console.log('✅ ARIA: Multiplier calculado');
    console.log(`   📊 Rutas analizadas: ${erroresValidos.length}`);
    console.log(`   📉 Error promedio: ${avgError.toFixed(3)} min/parada`);
    console.log(`   🎯 Multiplier ajustado: ${nuevoMultiplier.toFixed(2)} (base: 0.9)`);
    
    return {
      multiplier: nuevoMultiplier,
      rutasAnalizadas: erroresValidos.length,
      ajuste: avgError
    };
    
  } catch (error) {
    console.error('❌ ARIA: Error inesperado:', error);
    return { multiplier: 0.9, rutasAnalizadas: 0, ajuste: 0 };
  }
}

// 🤖 ARIA: Helper para convertir TIME a minutos desde medianoche
function convertTimeToMinutes(timeString) {
  // timeString formato: "10:33:00" o "22:15:00"
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

console.log('🤖 ARIA System activado');

// ═══════════════════════════════════════════════════════════════
// FIN ARIA SYSTEM
// ═══════════════════════════════════════════════════════════════

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
app.post('/api/optimize-route', authenticateUser, async (req, res) => {
    let { addresses, finalDestination: customFinalDestination } = req.body;
  addresses = addresses.filter(addr => addr && addr.trim() !== '');

  if (!addresses || addresses.length < 3) {
    return res.status(400).json({ 
      message: 'Se necesitan al menos Origen, una Parada y un Destino.',
      hasErrors: true 
    });
  }

  try {
    // 🤖 ARIA: Calcular multiplier dinámico ANTES de calcular la ruta
    const ariaResult = await calcularMultiplierARIA(req.userId);
    console.log(`🤖 ARIA: Usando multiplier ${ariaResult.multiplier.toFixed(2)} para esta ruta`);
    
    const origin = addresses[0]; // Warehouse
    const finalDestination = customFinalDestination || addresses[addresses.length - 1];
    
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
                fromFirstStop: fromFirstStopToHome,
                segments: inverseSegmentResults.map((result, index) => ({
                    ...result,
                    stops: inverseSegments[index] ? 
                        [inverseSegments[index].origin, ...inverseSegments[index].waypoints, inverseSegments[index].destination] : 
                        []
                }))
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
        },
        // 🤖 ARIA: Devolver datos del sistema inteligente
        aria: {
            multiplier: ariaResult.multiplier,
            rutasAnalizadas: ariaResult.rutasAnalizadas,
            ajuste: ariaResult.ajuste
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
app.post('/api/log-route', authenticateUser, async (req, res) => {    const logData = req.body;
  const { user_id } = req.body;  
  console.log('📦 Recibiendo datos v3 para guardar en bitácora');
  // Validar que el usuario solo registre rutas para sí mismo
  if (user_id && user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para registrar rutas de otro usuario'
    });
  }
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
        vehicle_id: logData.vehicle_id,  // ← UUID del vehículo
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
        notes: null,
        // 🆕 Guardar destino final original
        destination_address: logData.destination_address || null,
        destination_changed: false, // Por defecto, no ha cambiado
        // 🤖 ARIA: Guardar multiplier usado
        multiplier_usado: logData.multiplier_usado || null
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
app.get('/api/active-route/:userId', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  
  console.log('═══════════════════════════════════════');
  console.log('🔍 ACTIVE ROUTE - userId del param:', userId);
  console.log('🔍 ACTIVE ROUTE - userId del token:', req.userId);
  
  // Validar ownership
  if (userId !== req.userId) {
    console.log('❌ ACTIVE ROUTE - IDs no coinciden');
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para ver la ruta activa de otro usuario'
    });
  }
  
  try {
    console.log('🔍 ACTIVE ROUTE - Buscando en DB...');
    
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 1)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(1);

    console.log('🔍 ACTIVE ROUTE - Error DB:', error);
    console.log('🔍 ACTIVE ROUTE - Data length:', data?.length);
    
    if (data && data.length > 0) {
      console.log('✅ ACTIVE ROUTE - Ruta encontrada:', {
        id: data[0].id,
        fecha: data[0].fecha,
        hora: data[0].hora,
        status: data[0].status,
        warehouse: data[0].warehouse
      });
    } else {
      console.log('❌ ACTIVE ROUTE - No se encontró ruta activa');
    }
    
    console.log('═══════════════════════════════════════');

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
    console.error('❌ ACTIVE ROUTE - Error general:', error);
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

// ========================================
// LIVE ETA CALCULATION - CON ARIA
// ========================================
app.post('/api/calculate-live-eta', authenticateUser, async (req, res) => {
  const { routeId, currentStopNumber, customDestination } = req.body;
  
  if (!routeId || !currentStopNumber) {
    return res.status(400).json({
      success: false,
      error: 'Falta routeId o currentStopNumber'
    });
  }

  try {
    console.log(`🔄 Calculando Live ETA para ruta ${routeId} desde parada ${currentStopNumber}`);
    
    // 1. Obtener ruta activa
    const { data: route, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .eq('status', 1)
      .single();

    if (error || !route) {
      throw new Error('Ruta no encontrada o ya finalizada');
    }
     // 2. Determinar destino final a usar
    let finalDestinationAddress = customDestination || 
                                  route.destination_address || 
                                  '513 Alafaya Woods Blvd Oviedo, FL'; // Default fallback
    
    // 3. 🆕 Detectar si el destino cambió
    const destinationChanged = customDestination && 
                              customDestination.trim() !== '' && 
                              route.destination_address && 
                              customDestination.trim().toLowerCase() !== route.destination_address.toLowerCase();
    
    if (destinationChanged) {
      console.log(`⚠️ Destino cambió: "${route.destination_address}" → "${customDestination}"`);
      console.log(`⚠️ Esta ruta NO se usará para ARIA al finalizarse`);
    }
       
    // 4. Desencriptar paradas
    const allStops = decryptStops(route.stops_json);
    if (!allStops) {
      throw new Error('Error desencriptando paradas');
    }
    
    // 5. Filtrar paradas restantes
    const remainingStops = allStops.filter(
      stop => stop.number >= currentStopNumber && stop.address
    );
    
    if (remainingStops.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay paradas restantes desde esa posición'
      });
    }

    console.log(`   📍 Paradas restantes: ${remainingStops.length}`);
    
    // 6. 🤖 ARIA: Calcular multiplier dinámico
    const ariaResult = await calcularMultiplierARIA(req.userId);
    console.log(`   🤖 ARIA multiplier: ${ariaResult.multiplier.toFixed(2)}`);
    
    // 7. Construir ruta segmentada para Google Maps
    const allRemainingPoints = remainingStops.map(s => s.address);
    allRemainingPoints.push(finalDestinationAddress);

    const STOPS_PER_SEGMENT = 26;
    const routeSegments = [];

    for (let i = 0; i < allRemainingPoints.length; i += (STOPS_PER_SEGMENT - 1)) {
      const segmentPoints = allRemainingPoints.slice(i, i + STOPS_PER_SEGMENT);
      
      if (segmentPoints.length > 0) {
        if (segmentPoints.length === 1 && i > 0) {
          break;
        }

        routeSegments.push({
          origin: segmentPoints[0],
          destination: segmentPoints[segmentPoints.length - 1],
          waypoints: segmentPoints.slice(1, -1)
        });
      }
    }
    
    console.log(`   🗺️  Segmentos creados: ${routeSegments.length}`);
    
    // 8. Llamar a Google Maps API
    const segmentPromises = routeSegments.map(seg => 
      calculateLeg(seg.origin, seg.destination, seg.waypoints)
    );
    
    const segmentResults = await Promise.all(segmentPromises);
    
    // 9. Sumar distancias y tiempos de Google Maps
    let totalDistance = 0;
    let totalGoogleDuration = 0;
    
    segmentResults.forEach(result => {
      totalDistance += parseFloat(result.distance || 0);
      totalGoogleDuration += parseFloat(result.duration || 0);
    });
    
    console.log(`   📊 Google Maps: ${totalDistance.toFixed(2)} mi, ${totalGoogleDuration} min`);
    
    // 10. Detectar apartamentos y downtown (usando campo isApartment del JSON)
    let aptCount = 0;
    let downtownCount = 0;
    
    remainingStops.forEach(stop => {
      // Asegurar que isApartment existe (para rutas viejas)
      if (stop.isApartment === undefined) {
        stop.isApartment = stop.address && stop.address.toUpperCase().match(/APT|UNIT|#/);
      }
      
      if (stop.isDowntown) {
        downtownCount++;
      } else if (stop.isApartment) {
        aptCount++;
      }
    });
    
    console.log(`   🏢 Apartamentos: ${aptCount}, Downtown: ${downtownCount}`);
    
    // 11. Calcular tiempos de parada con ARIA
    const stopCount = remainingStops.length;
    const baseStopTime = stopCount * ariaResult.multiplier;
    const extraAptTime = aptCount * 0.75;
    const extraDowntownTime = downtownCount * 3;
    const totalStopTime = baseStopTime + extraAptTime + extraDowntownTime;
    
    console.log(`   ⏱️  Tiempo paradas: ${totalStopTime.toFixed(1)} min (${baseStopTime.toFixed(1)} base + ${extraAptTime.toFixed(1)} apts + ${extraDowntownTime.toFixed(1)} DT)`);
    
   // 11. Calcular ETAs (optimista, normal, pesimista)
const nowEST = DateTime.now().setZone('America/New_York');
const totalNormalMinutes = totalGoogleDuration + totalStopTime;

const optimisticMultiplier = ariaResult.multiplier * 0.44;
const pessimisticMultiplier = ariaResult.multiplier * 1.39;

const optimisticStopTime = stopCount * optimisticMultiplier + extraAptTime + extraDowntownTime;
const pessimisticStopTime = stopCount * pessimisticMultiplier + extraAptTime + extraDowntownTime;

// ✅ Usar Luxon para todo el cálculo
const etaOptimistic = nowEST.plus({ minutes: totalGoogleDuration + optimisticStopTime });
const etaNormal = nowEST.plus({ minutes: totalNormalMinutes });
const etaPessimistic = nowEST.plus({ minutes: totalGoogleDuration + pessimisticStopTime });

console.log(`   🎯 ETA Normal: ${etaNormal.toLocaleString(DateTime.TIME_SIMPLE)}`);
console.log(`✅ Live ETA calculado exitosamente`);

// 12. Respuesta
res.json({
  success: true,
  remainingStops: stopCount,
  remainingMiles: totalDistance.toFixed(2),
  remainingMinutes: Math.round(totalNormalMinutes),
  destinationChanged: destinationChanged, // 🆕 Informar al frontend
  destinationUsed: finalDestinationAddress, // 🆕 Mostrar qué destino se usó
  aria: {
    multiplier: ariaResult.multiplier,
    rutasAnalizadas: ariaResult.rutasAnalizadas,
    ajuste: ariaResult.ajuste
  },
  breakdown: {
    googleTime: Math.round(totalGoogleDuration),
    googleMiles: totalDistance.toFixed(2),
    baseStopTime: Math.round(baseStopTime),
    apartmentCount: aptCount,
    apartmentTime: Math.round(extraAptTime),
    downtownCount: downtownCount,
    downtownTime: Math.round(extraDowntownTime),
    totalStopTime: Math.round(totalStopTime)
  },
  etas: {
    optimistic: {
      time: etaOptimistic.toLocaleString(DateTime.TIME_SIMPLE),
      minutes: Math.round(totalGoogleDuration + optimisticStopTime)
    },
    normal: {
      time: etaNormal.toLocaleString(DateTime.TIME_SIMPLE),
      minutes: Math.round(totalNormalMinutes)
    },
    pessimistic: {
      time: etaPessimistic.toLocaleString(DateTime.TIME_SIMPLE),
      minutes: Math.round(totalGoogleDuration + pessimisticStopTime)
    }
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

    // ========================================
// SCHEDULED BLOCKS ENDPOINTS - v4.1
// ========================================

// 1. GET /api/scheduled-blocks/:userId - Obtener bloques de un usuario
app.get('/api/scheduled-blocks/:userId', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  const { status, startDate, endDate } = req.query;
  
  if (userId !== req.userId) {
    return res.status(403).json({ success: false, error: 'No tienes permiso' });
  }

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
app.post('/api/scheduled-blocks', authenticateUser, async (req, res) => {
  const { user_id, fecha, hora, duracion_horas, pago, warehouse, vehicle_id, notes } = req.body;
 
  if (user_id && user_id !== req.userId) {
    return res.status(403).json({ success: false, error: 'No tienes permiso' });
  }

  // Validación
  if (!user_id || !fecha || !hora || !duracion_horas || !pago || !warehouse || !vehicle_id) {
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
        vehicle_id,  // ← UUID del vehículo
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
app.put('/api/scheduled-blocks/:id', authenticateUser, async (req, res) => {
  const { user_id, fecha, hora, duracion_horas, pago, warehouse, vehicle_id, notes } = req.body;
  const blockId = req.params.id;
  
  if (user_id && user_id !== req.userId) {
    return res.status(403).json({ success: false, error: 'No tienes permiso' });
  }

  // Validación
  if (!user_id || !fecha || !hora || !duracion_horas || !pago || !warehouse || !vehicle_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan campos requeridos' 
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('scheduled_blocks')
      .update({
        fecha,
        hora,
        duracion_horas,
        pago,
        warehouse,
        vehicle_id,  // ← UUID del vehículo
        notes
      })
      .eq('id', blockId)
      .eq('user_id', user_id)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bloque no encontrado'
      });
    }
    
    console.log('✅ Bloque actualizado:', data[0].id);
    res.json({ success: true, block: data[0] });
    
  } catch (error) {
    console.error('❌ Error actualizando bloque:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. DELETE /api/scheduled-blocks/:blockId - Eliminar/Cancelar bloque
app.delete('/api/scheduled-blocks/:blockId', authenticateUser, async (req, res) => {
  const { blockId } = req.params;
  const { soft } = req.query; // ?soft=true para cancelar en lugar de eliminar
  
  // Verificar ownership del bloque
  const { data: block } = await supabase
    .from('scheduled_blocks')
    .select('user_id')  // ← user_id de la DB
    .eq('id', blockId)
    .single();
  
  if (block.user_id !== req.userId) {  // ← Comparar user_id con req.userId
    return res.status(403).json({ success: false, error: 'No tienes permiso' });
  }

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
app.post('/api/scheduled-blocks/:blockId/start', authenticateUser, async (req, res) => {
  const { blockId } = req.params;
  const { routeId } = req.body;
  
  // Verificar que el bloque pertenece al usuario
  const { data: block, error: fetchError } = await supabase
    .from('scheduled_blocks')
    .select('user_id')
    .eq('id', blockId)
    .single();
  
  if (fetchError || !block) {
    return res.status(404).json({
      success: false,
      error: 'Bloque no encontrado'
    });
  }
  
  if (block.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para iniciar este bloque'
    });
  }

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
app.get('/api/scheduled-blocks/:userId/week-summary', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  
  // Validar que el usuario solo vea su propio resumen
  if (userId !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para ver el resumen de otro usuario'
    });
  }
  
  try {
    // Obtener fecha de inicio de semana (lunes)
    const today = DateTime.now().setZone('America/New_York');
    const startOfWeek = today.startOf('week').toISODate();
    const endOfWeek = today.endOf('week').toISODate();
    
    console.log(`📊 === WEEK SUMMARY REQUEST ===`);
    console.log(`📅 Rango: ${startOfWeek} a ${endOfWeek}`);
    console.log(`👤 User: ${userId}`);
    
    // 🔥 QUERY CON LOGGING DETALLADO
    const { data: blocks, error: blocksError } = await supabase
      .from('scheduled_blocks')
      .select('id, fecha, duracion_horas, pago, status')  // ← Especifica columnas
      .eq('user_id', userId)
      .gte('fecha', startOfWeek)
      .lte('fecha', endOfWeek)
      .eq('status', 'scheduled')
      .order('fecha', { ascending: true });
    
    if (blocksError) {
      console.error('❌ Error en query de blocks:', blocksError);
      throw blocksError;
    }
    
    console.log(`📦 Bloques encontrados: ${blocks?.length || 0}`);
    if (blocks && blocks.length > 0) {
      console.log('📋 Detalle de bloques:');
      blocks.forEach(b => {
        console.log(`  - ID: ${b.id}, Fecha: ${b.fecha}, Status: ${b.status}, Horas: ${b.duracion_horas}, Pago: ${b.pago}`);
      });
    }
    
    // Rutas completadas esta semana
    const { data: routes, error: routesError } = await supabase
      .from('routes')
      .select('duracion_horas, pago, millas_totales')
      .eq('user_id', userId)
      .gte('fecha', startOfWeek)
      .lte('fecha', endOfWeek)
      .eq('status', 0); // Completadas
    
    if (routesError) {
      console.error('❌ Error en query de routes:', routesError);
      throw routesError;
    }
    
    console.log(`✅ Rutas completadas: ${routes?.length || 0}`);
    
    // 🔥 CALCULAR TOTALES - INICIALIZADOS EN CADA REQUEST
    let totalHorasAgendadas = 0;
    let totalPagoAgendado = 0;
    
    if (blocks && Array.isArray(blocks)) {
      totalHorasAgendadas = blocks.reduce((sum, b) => sum + (parseFloat(b.duracion_horas) || 0), 0);
      totalPagoAgendado = blocks.reduce((sum, b) => sum + (parseFloat(b.pago) || 0), 0);
    }
    
    console.log(`💰 Total calculado: ${totalHorasAgendadas}h, $${totalPagoAgendado}`);
    
    let totalHorasTrabajadas = 0;
    let totalPagoGanado = 0;
    let totalMillas = 0;
    
    if (routes && Array.isArray(routes)) {
      totalHorasTrabajadas = routes.reduce((sum, r) => sum + (parseFloat(r.duracion_horas) || 0), 0);
      totalPagoGanado = routes.reduce((sum, r) => sum + (parseFloat(r.pago) || 0), 0);
      totalMillas = routes.reduce((sum, r) => sum + (parseFloat(r.millas_totales) || 0), 0);
    }
    
    const summary = {
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      scheduled: {
        blocks: blocks?.length || 0,
        hours: totalHorasAgendadas.toFixed(1),
        pay: totalPagoAgendado.toFixed(2)
      },
      completed: {
        routes: routes?.length || 0,
        hours: totalHorasTrabajadas.toFixed(1),
        pay: totalPagoGanado.toFixed(2),
        miles: totalMillas.toFixed(1)
      }
    };
    
    console.log(`📊 Summary response:`, JSON.stringify(summary, null, 2));
    console.log(`=== END WEEK SUMMARY ===\n`);
    
    res.json({
      success: true,
      summary: summary
    });
    
  } catch (error) {
    console.error('❌ Error en resumen semanal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /api/complete-route
app.post('/api/complete-route', authenticateUser, async (req, res) => {
  const { userId: userIdFromBody, routeId, etaReal, destinationUsed } = req.body; // etaReal: "5:11 PM"
  // Validar que el usuario solo complete sus propias rutas
  if (userIdFromBody && userIdFromBody !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para completar rutas de otro usuario'
    });
  }
  
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
    
    // 🤖 ARIA: Obtener datos de la ruta para calcular error
    const { data: routeData, error: fetchError } = await supabase
      .from('routes')
      .select('eta_normal, numero_paradas, destination_address')
      .eq('id', routeId)
      .single();

      if (fetchError) {
      console.error('⚠️ ARIA: No se pudo obtener datos de la ruta:', fetchError);
    }
    
    // 🆕 Verificar si el destino cambió
    const destinationChanged = destinationUsed && 
                            routeData.destination_address &&
                            destinationUsed.toLowerCase() !== routeData.destination_address.toLowerCase();
  
    
    // 🤖 ARIA: Calcular error si tenemos los datos necesarios
    let errorMinutos = null;
    let errorPorParada = null;
    
  // Solo calcular error si el destino NO cambió
  if (routeData && routeData.eta_normal && routeData.numero_paradas && !destinationChanged) {
    try {
      const realMinutes = convertTimeToMinutes(timeFormatted);
      const normalMinutes = convertTimeToMinutes(routeData.eta_normal);
      
      errorMinutos = realMinutes - normalMinutes;
      errorPorParada = errorMinutos / routeData.numero_paradas;
      
      console.log('🤖 ARIA: Error calculado');
      console.log(`   ETA Normal: ${routeData.eta_normal}`);
      console.log(`   ETA Real: ${timeFormatted}`);
      console.log(`   Error: ${errorMinutos} min (${errorPorParada.toFixed(3)} min/parada)`);
    } catch (e) {
      console.error('⚠️ ARIA: Error al calcular diferencia:', e);
    }
  } else if (destinationChanged) {
    console.log('⚠️ ARIA: Destino cambió - NO se calculará error para ARIA');
  }


    const { data, error } = await supabase
      .from('routes')
      .update({
        status: 0,
        eta_real: timeFormatted,
        eta_real_input_date: new Date().toISOString(),
        stops_json: null, // BORRAR DIRECCIONES
       // 🤖 ARIA: Guardar error calculado (o NULL si destino cambió)
      error_minutos: errorMinutos,
      error_por_parada: errorPorParada,
      destination_changed: destinationChanged // 🆕 Marcar si cambió
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
    
    // 🆕 Si esta ruta vino de un bloque agendado, marcarlo como completado
    try {
      const { data: blockData, error: blockError } = await supabase
        .from('scheduled_blocks')
        .update({ status: 'completed' })
        .eq('route_id', routeId)
        .select();
      
      if (!blockError && blockData && blockData.length > 0) {
        console.log(`✅ Bloque agendado ${blockData[0].id} marcado como completado`);
      }
    } catch (blockError) {
      // No fallar si hay error actualizando el bloque
      console.warn('⚠️ No se pudo actualizar bloque agendado:', blockError);
    }
    
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
app.get('/api/pending-eta/:userId', authenticateUser, async (req, res) => {
  const { userId } = req.params;
   // Validar que el usuario solo vea su propio pending ETA
  if (userId !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para ver el pending ETA de otro usuario'
    });
  }
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
app.post('/api/skip-eta', authenticateUser, async (req, res) => {
  const { userId, routeId } = req.body;
   // Validar que el usuario solo saltee su propio ETA
  if (userId && userId !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para saltear el ETA de otro usuario'
    });
  }
  
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


// ========================================
// 🆕 FASE 6: SCHEDULED BLOCKS ENDPOINTS
// ========================================

// 1. GET /api/scheduled-blocks/:userId/week-summary
// Obtiene resumen de la semana actual (horas, pago, millas, bloques)
app.get('/api/scheduled-blocks/:userId/week-summary', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  
  // Validar que el usuario solo vea su propio resumen
  if (userId !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para ver el resumen de otro usuario'
    });
  }
  
  try {
    // Obtener inicio y fin de semana (domingo a sábado)
    const now = DateTime.now().setZone('America/New_York');
    const startOfWeek = now.startOf('week').toISODate(); // Domingo
    const endOfWeek = now.endOf('week').toISODate(); // Sábado
    
    console.log(`📊 Calculando resumen semanal para ${userId}`);
    console.log(`   Semana: ${startOfWeek} a ${endOfWeek}`);
    
    // Bloques completados (rutas con status = 0)
    const { data: completedRoutes, error: routesError } = await supabase
      .from('routes')
      .select('duracion_horas, pago, millas_totales')
      .eq('user_id', userId)
      .eq('status', 0)
      .gte('fecha', startOfWeek)
      .lte('fecha', endOfWeek);
    
    if (routesError) throw routesError;
    
    // Bloques agendados (scheduled_blocks con status = 'scheduled')
    const { data: scheduledBlocks, error: blocksError } = await supabase
      .from('scheduled_blocks')
      .select('duracion_horas, pago')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('fecha', startOfWeek)
      .lte('fecha', endOfWeek);
    
    if (blocksError) throw blocksError;
    
    // Calcular totales
    const completedHours = completedRoutes.reduce((sum, r) => sum + (parseFloat(r.duracion_horas) || 0), 0);
    const completedPay = completedRoutes.reduce((sum, r) => sum + (parseFloat(r.pago) || 0), 0);
    const completedMiles = completedRoutes.reduce((sum, r) => sum + (parseFloat(r.millas_totales) || 0), 0);
    
    const scheduledHours = scheduledBlocks.reduce((sum, b) => sum + (parseFloat(b.duracion_horas) || 0), 0);
    const scheduledPay = scheduledBlocks.reduce((sum, b) => sum + (parseFloat(b.pago) || 0), 0);
    
    res.json({
      success: true,
      summary: {
        completed: {
          routes: completedRoutes.length,
          hours: completedHours.toFixed(1),
          pay: completedPay.toFixed(2),
          miles: completedMiles.toFixed(1)
        },
        scheduled: {
          blocks: scheduledBlocks.length,
          hours: scheduledHours.toFixed(1),
          pay: scheduledPay.toFixed(2)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo resumen semanal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. GET /api/scheduled-blocks/:userId
// Obtiene bloques agendados con filtros opcionales
app.get('/api/scheduled-blocks/:userId', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  const { status, startDate, endDate } = req.query;
  
    if (userId !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para ver bloques de otro usuario'
    });
  }

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
    
    console.log(`✅ ${data.length} bloques encontrados para usuario ${userId}`);
    
    res.json({
      success: true,
      blocks: data
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo bloques:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. DELETE /api/scheduled-blocks/:id
// Cancela un bloque (soft delete)
app.delete('/api/scheduled-blocks/:id', authenticateUser, async (req, res) => {
  const { userID, id } = req.params;
  const { soft } = req.query; // ?soft=true para soft delete
   // Verificar ownership
  const { data: block, error: fetchError } = await supabase
    .from('scheduled_blocks')
    .select('user_id')
    .eq('id', id)
    .single();
  
  if (fetchError || !block) {
    return res.status(404).json({
      success: false,
      error: 'Bloque no encontrado'
    });
  }
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
app.post('/api/scheduled-blocks/:id/start', authenticateUser, async (req, res) => {
  const { userID, id } = req.params;
  const { routeId } = req.body;
 
   // Verificar ownership
  const { data: block, error: fetchError } = await supabase
    .from('scheduled_blocks')
    .select('user_id')
    .eq('id', id)
    .single();
  
  if (fetchError || !block) {
    return res.status(404).json({
      success: false,
      error: 'Bloque no encontrado'
    });
  }
  
  if (block.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permiso para iniciar este bloque'
    });
  }

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


// ═══════════════════════════════════════════════════════════════
// 🔍 ENDPOINT DE DEBUGGING - Ver Stops Desencriptados
// ═══════════════════════════════════════════════════════════════
// ⚠️ PARA DESARROLLO - Remover en producción si es necesario
// ═══════════════════════════════════════════════════════════════

// Helper functions para análisis
function checkIfSequential(stops) {
  if (!stops || stops.length === 0) return false;
  
  for (let i = 0; i < stops.length - 1; i++) {
    const current = parseInt(stops[i].number) || 0;
    const next = parseInt(stops[i + 1].number) || 0;
    if (next !== current + 1) {
      return false;
    }
  }
  return true;
}

function checkIfReversed(stops) {
  if (!stops || stops.length === 0) return false;
  
  for (let i = 0; i < stops.length - 1; i++) {
    const current = parseInt(stops[i].number) || 0;
    const next = parseInt(stops[i + 1].number) || 0;
    if (next !== current - 1) {
      return false;
    }
  }
  return true;
}

app.get('/api/debug/route/:routeId', async (req, res) => {
  const { routeId } = req.params;
  
  try {
    // Obtener la ruta de la base de datos
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    }
    
    // Desencriptar stops si existen
    let decryptedStops = null;
    if (data.stops_json) {
      decryptedStops = decryptStops(data.stops_json);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Log en consola del servidor (para debugging fácil)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('🔍 ═══════════════════════════════════════════════════════════');
    console.log('🔍 DEBUG - RUTA ID:', routeId);
    console.log('🔍 ═══════════════════════════════════════════════════════════');
    console.log('📅 Fecha:', data.fecha);
    console.log('🕐 Hora:', data.hora);
    console.log('🏢 Warehouse:', data.warehouse);
    console.log('🏠 First Stop (campo):', data.first_stop);
    console.log('📊 Total Paradas:', data.numero_paradas);
    console.log('🔢 Status:', data.status, data.status === 1 ? '(Activa)' : '(Finalizada)');
    console.log('🚗 Millas Totales:', data.millas_totales);
    console.log('💰 Pago:', data.pago);
    console.log('');
    
    if (decryptedStops && decryptedStops.length > 0) {
      console.log('📍 STOPS DESENCRIPTADOS (Total:', decryptedStops.length, '):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      decryptedStops.forEach((stop, idx) => {
        const posicion = (idx + 1).toString().padStart(3, ' ');
        const numero = (stop.number || 'N/A').toString().padStart(3, ' ');
        const downtown = stop.isDowntown ? '🏙️  DOWNTOWN' : '';
        console.log(`  ${posicion}. #${numero} │ ${stop.address || 'Sin dirección'} ${downtown}`);
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      // Análisis del orden
      const isSequential = checkIfSequential(decryptedStops);
      const isReversed = checkIfReversed(decryptedStops);
      const downtownCount = decryptedStops.filter(s => s.isDowntown).length;
      
      console.log('📊 ANÁLISIS:');
      console.log('  ├─ Primera parada (posición 1):');
      console.log('  │  ├─ Número: #' + (decryptedStops[0]?.number || 'N/A'));
      console.log('  │  └─ Dirección:', decryptedStops[0]?.address || 'N/A');
      console.log('  │');
      console.log('  ├─ Última parada (posición ' + decryptedStops.length + '):');
      console.log('  │  ├─ Número: #' + (decryptedStops[decryptedStops.length - 1]?.number || 'N/A'));
      console.log('  │  └─ Dirección:', decryptedStops[decryptedStops.length - 1]?.address || 'N/A');
      console.log('  │');
      console.log('  ├─ Paradas downtown:', downtownCount, 'de', decryptedStops.length);
      console.log('  │');
      console.log('  ├─ Orden secuencial (1→2→3...):', isSequential ? '✅ SÍ' : '❌ NO');
      console.log('  └─ Orden inverso (23→22→21...):', isReversed ? '✅ SÍ' : '❌ NO');
      
      // Advertencia si los números no coinciden
      if (!isSequential && !isReversed) {
        console.log('');
        console.log('  ⚠️  ADVERTENCIA: Los números de parada no están en orden');
        console.log('  ⚠️  secuencial ni inverso. Revisar la lógica de guardado.');
      }
      
      // Verificar discrepancia con first_stop
      if (data.first_stop && decryptedStops[0]?.address) {
        const matchesFirstStop = data.first_stop.toLowerCase().includes(
          decryptedStops[0].address.substring(0, 20).toLowerCase()
        );
        
        if (!matchesFirstStop) {
          console.log('');
          console.log('  ⚠️  DISCREPANCIA DETECTADA:');
          console.log('  ⚠️  El campo first_stop no coincide con la primera parada del array');
          console.log('  ⚠️  Campo first_stop:', data.first_stop);
          console.log('  ⚠️  Primera parada array:', decryptedStops[0].address);
        }
      }
      
    } else {
      console.log('⚠️  No hay stops guardados o no se pudieron desencriptar');
      
      if (data.stops_json) {
        console.log('ℹ️  Datos encriptados presentes pero no se pudieron desencriptar');
        console.log('ℹ️  Verifica que STOPS_ENCRYPTION_KEY esté configurado correctamente');
      } else {
        console.log('ℹ️  El campo stops_json está vacío en la base de datos');
      }
    }
    
    console.log('🔍 ═══════════════════════════════════════════════════════════');
    console.log('\n');
    
    // ═══════════════════════════════════════════════════════════════
    // Responder con datos completos en JSON (para llamadas API)
    // ═══════════════════════════════════════════════════════════════
    res.json({
      success: true,
      route: {
        id: data.id,
        fecha: data.fecha,
        hora: data.hora,
        warehouse: data.warehouse,
        first_stop: data.first_stop,
        numero_paradas: data.numero_paradas,
        status: data.status,
        millas_totales: data.millas_totales,
        millas_de_trabajo: data.millas_de_trabajo,
        pago: data.pago,
        commute_1: data.commute_1,
        commute_2: data.commute_2
      },
      stops: decryptedStops,
      analysis: {
        total_stops: decryptedStops ? decryptedStops.length : 0,
        first_stop: {
          number: decryptedStops?.[0]?.number || null,
          address: decryptedStops?.[0]?.address || null,
          isDowntown: decryptedStops?.[0]?.isDowntown || false
        },
        last_stop: {
          number: decryptedStops?.[decryptedStops.length - 1]?.number || null,
          address: decryptedStops?.[decryptedStops.length - 1]?.address || null,
          isDowntown: decryptedStops?.[decryptedStops.length - 1]?.isDowntown || false
        },
        downtown_count: decryptedStops ? decryptedStops.filter(s => s.isDowntown).length : 0,
        is_sequential: decryptedStops ? checkIfSequential(decryptedStops) : null,
        is_reversed: decryptedStops ? checkIfReversed(decryptedStops) : null,
        matches_first_stop_field: data.first_stop && decryptedStops?.[0]?.address
          ? data.first_stop.toLowerCase().includes(
              decryptedStops[0].address.substring(0, 20).toLowerCase()
            )
          : null
      }
    });
    
  } catch (error) {
    console.error('❌ Error en debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('🔍 Debug endpoint activado: GET /api/debug/route/:routeId');

// ═══════════════════════════════════════════════════════════════
// FIN DEL ENDPOINT DE DEBUGGING
// ═══════════════════════════════════════════════════════════════


// --- Tu `app.listen` (movido al final) ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v3.1 (ETA en Caliente + Segmentos Inversos v1.8) corriendo en http://localhost:${PORT}`);
});

// Agregar estos endpoints a tu server.js (después de la línea 1586)

// ═══════════════════════════════════════════════════════════════
// 🏥 HEALTH & KEEP-ALIVE ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Endpoint simple para keep-alive
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: DateTime.now().setZone('America/New_York').toISO(),
    message: '🏓 Pong!' 
  });
});

// Endpoint que verifica la conexión a Supabase
app.get('/api/health', async (req, res) => {
  try {
    // Hacer una query ligera a Supabase para mantenerla despierta
    const { data, error } = await supabase
      .from('routes')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('⚠️ Health check - Error en Supabase:', error);
      return res.status(500).json({
        status: 'unhealthy',
        database: 'error',
        error: error.message,
        timestamp: DateTime.now().setZone('America/New_York').toISO()
      });
    }
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: DateTime.now().setZone('America/New_York').toISO(),
      message: '✅ Backend y DB funcionando correctamente'
    });
    
  } catch (error) {
    console.error('❌ Health check - Error general:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: DateTime.now().setZone('America/New_York').toISO()
    });
  }
});

console.log('🏥 Health endpoints activados:');
console.log('   GET /api/ping - Keep-alive simple');
console.log('   GET /api/health - Health check + Supabase wake-up');

// ═══════════════════════════════════════════════════════════════
// FIN DE HEALTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════
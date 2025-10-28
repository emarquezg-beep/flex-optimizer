// server.js (v1.7 - Segmentos Corregidos + Error Detection)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Conectando a Supabase en:", supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'URL no encontrada');

// --- FUNCIÓN CON DETECCIÓN DE ERRORES ---
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

// --- 🆕 ENDPOINT CORREGIDO (TU MÉTODO MANUAL) ---
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
    
    // 🆕 CAMBIO CRÍTICO: workStops AHORA INCLUYE la primera parada (índice 1)
    const workStops = addresses.slice(1, -1); // Desde parada #2 hasta la última parada
    const firstStop = workStops[0]; // Primera parada (la #2 en tu numeración)
    const lastStop = workStops[workStops.length - 1]; // Última parada

    console.log('✅ v1.7: Calculando con método manual correcto...');
    console.log(`   Warehouse: ${origin}`);
    console.log(`   Primera Parada: ${firstStop}`);
    console.log(`   Última Parada: ${lastStop}`);
    console.log(`   Total de paradas de trabajo: ${workStops.length}`);

    // Calcular tramos especiales (sin cambios)
    const toFirstStopPromise = calculateLeg(origin, firstStop);
    const toFinalDestinationPromise = calculateLeg(lastStop, finalDestination);
    const toLastStopForInversePromise = calculateLeg(origin, lastStop);
    const fromFirstStopToHomePromise = calculateLeg(firstStop, finalDestination);

    // 🆕 SEGMENTACIÓN CORRECTA (COMO TU MÉTODO MANUAL)
    const STOPS_PER_SEGMENT = 10; // 1 origen + 9 waypoints = 10 paradas por segmento
    const workStopSegments = [];
    
    for (let i = 0; i < workStops.length; i += 9) { // Avanzamos de 9 en 9
        const segmentStops = workStops.slice(i, i + 10); // Tomamos 10 (1 origen + hasta 9 siguientes)
        
        if (segmentStops.length > 0) {
            workStopSegments.push({
                origin: segmentStops[0], // Primera parada del segmento
                destination: segmentStops[segmentStops.length - 1], // Última del segmento
                waypoints: segmentStops.slice(1, -1) // Intermedias (máximo 9)
            });
        }
    }

    console.log(`   Segmentos creados: ${workStopSegments.length}`);
    workStopSegments.forEach((seg, idx) => {
        console.log(`   Segmento ${idx + 1}: ${seg.origin} → ${seg.destination} (${seg.waypoints.length} waypoints)`);
    });

    // Calcular todos los segmentos
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

    // --- DETECTAR ERRORES ---
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

    // SI HAY ERRORES, DEVOLVER RESPUESTA ESPECIAL
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

    // ✅ TODO OK - RESPUESTA NORMAL
    const segmentsWithStops = segmentResults.map((result, index) => {
        const seg = workStopSegments[index];
        return {
            ...result,
            stops: [seg.origin, ...seg.waypoints, seg.destination] // Todas las paradas del segmento
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

// --- ENDPOINT LOG-ROUTE (sin cambios) ---
app.post('/api/log-route', async (req, res) => {
    const logData = req.body;
    console.log('📦 Recibiendo datos v2 para guardar en bitácora:', logData);

    const dataToInsert = {
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
        status: 1,
        first_stop: logData.first_stop
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

        console.log('💾 ¡Ruta v2 guardada en Supabase con éxito!:', data);
        res.status(200).json({ success: true, message: 'Ruta guardada en bitácora.', data: data });

    } catch (error) {
        console.error('❌ Error general en /api/log-route:', error.message);
        res.status(500).json({ success: false, message: 'Error al guardar en Supabase.', error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v1.7 (segmentos corregidos) corriendo en http://localhost:${PORT}`);
});
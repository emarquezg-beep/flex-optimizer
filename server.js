// server.js (v1.5)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');
const { createClient } = require('@supabase/supabase-js'); // <-- 1. IMPORTAR SUPABASE

const app = express();
const PORT = 3000;

const allowedOrigins = [
  'http://localhost:5173',
  'https://flex-optimizer.vercel.app',
  'https://flex-optimizer-git-v15-logbook-ernestos-projects-d9e7c95d.vercel.app', // (Podrías borrar esta)
  'https://flex-optimizer-git-v20-app-layout-ernestos-projects-d9e7c95d.vercel.app' // ¡La URL de tu rama v2.0!
];

// 2. LA FUNCIÓN MEJORADA (que limpia el slash)
const corsOptions = {
  origin: function (origin, callback) {
    
    // --- INICIO DEL CÓDIGO DE DEPURACIÓN ---
    // ¡ESTO NOS DIRÁ LA VERDAD!
    console.log("--- INICIO DEPURACIÓN CORS ---");
    console.log("Origen (Navegador):", origin);
    console.log("Lista 'allowedOrigins' (En Memoria del Servidor):", allowedOrigins);
    // --- FIN DEPURACIÓN ---
    
    let originToTest = origin;
    if (originToTest && originToTest.endsWith('/')) {
      originToTest = originToTest.slice(0, -1);
    }

    if (allowedOrigins.indexOf(originToTest) !== -1 || !origin) {
      console.log("RESULTADO: Permitido");
      callback(null, true);
    } else {
      // Este es el error que ya vemos
      console.error('❌ CORS RECHAZADO: Origen no permitido ->', origin);
      callback(new Error('No permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());
const mapsClient = new Client({});

// --- 2. INICIALIZAR CLIENTE SUPABASE ---
// Asegúrate de añadir estas dos variables a tu archivo .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Usa la Service Role Key (secreta)
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Conectando a Supabase en:", supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'URL no encontrada');

// --- FUNCIÓN ASISTENTE PARA CALCULAR UN TRAMO (sin cambios) ---
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
        const leg = response.data.routes[0]?.legs[0];
        if (!leg) return { distance: 0, duration: 0 };
        
        let totalDistance = 0;
        let totalDuration = 0;
        response.data.routes[0].legs.forEach(l => {
            totalDistance += l.distance.value;
            totalDuration += l.duration.value;
        });

        return {
            distance: (totalDistance / 1609.34).toFixed(2),
            duration: Math.round(totalDuration / 60)
        };
    } catch (error) {
        console.error(`Error calculando tramo de ${origin} a ${destination}:`, error.response?.data?.error_message || error.message);
        return { distance: 0, duration: 0, error: true };
    }
}

// --- ENDPOINT /api/optimize-route (sin cambios) ---
app.post('/api/optimize-route', async (req, res) => {
  // ... (Toda tu lógica de v1.2 para calcular escenarios va aquí, sin cambios)
  // ...
  let { addresses } = req.body;
  addresses = addresses.filter(addr => addr && addr.trim() !== '');

  if (!addresses || addresses.length < 3) {
    return res.status(400).json({ message: 'Se necesitan al menos Origen, una Parada y un Destino.' });
  }

  try {
    const origin = addresses[0];
    const firstStop = addresses[1];
    const lastStop = addresses[addresses.length - 2];
    const finalDestination = addresses[addresses.length - 1];
    const workStops = addresses.slice(1, -1);

    console.log('✅ v1.2: Calculando informe de ruta por segmentos...');

    const toFirstStopPromise = calculateLeg(origin, firstStop);
    const toFinalDestinationPromise = calculateLeg(lastStop, finalDestination);
    const toLastStopForInversePromise = calculateLeg(origin, lastStop);
    const fromFirstStopToHomePromise = calculateLeg(firstStop, finalDestination);

    const STOPS_PER_SEGMENT = 9;
    const workStopChunks = [];
    for (let i = 0; i < workStops.length; i += STOPS_PER_SEGMENT) {
        workStopChunks.push(workStops.slice(i, i + STOPS_PER_SEGMENT));
    }

    const segmentPromises = workStopChunks.map(chunk => 
        calculateLeg(chunk[0], chunk[chunk.length - 1], chunk.slice(1, -1))
    );
    
    const [toFirstStop, toFinalDestination, toLastStopForInverse, fromFirstStopToHome, ...segmentResults] = await Promise.all([
        toFirstStopPromise,
        toFinalDestinationPromise,
        toLastStopForInversePromise,
        fromFirstStopToHomePromise,
        ...segmentPromises
    ]);

    const segmentsWithStops = segmentResults.map((result, index) => ({
        ...result,
        stops: workStopChunks[index]
    }));

    console.log('🎉 v1.2: Informe calculado con éxito!');
    res.json({
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
    res.status(500).json({ message: 'Error al calcular los escenarios.' });
  }
});


// --- 3. NUEVO ENDPOINT PARA GUARDAR EN BITÁCORA ---

app.post('/api/log-route', async (req, res) => {
    const logData = req.body;
    console.log('📦 Recibiendo datos v2 para guardar en bitácora:', logData);

    // Mapeamos los nombres del JS a los nombres de la BD (lowercase)
    const dataToInsert = {
        // --- Existing fields (lowercase) ---
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
        conmute_1: logData.conmute_1, // This is the manual commute 1 distance
        conmute_2: logData.conmute_2, // API distance: last stop -> home
        millas_de_trabajo: logData.millas_de_trabajo, // API distance: WH -> first + between stops
        millas_totales: logData.millas_totales,
        millas_por_hora: logData.millas_por_hora,
        gasto_de_gasolina: logData.gasto_de_gasolina,
        desgaste_vehiculo: logData.desgaste_vehiculo,
        tax: logData.tax,
        claim_por_milla: logData.claim_por_milla,

        // --- NEW fields (lowercase) ---
        user_id: logData.user_id,             // Temporary UUID or null
        primary_city: logData.primary_city,   // Most frequent city
        status: 1,                            // Always save as 'active' initially
        first_stop: logData.first_stop       // API distance: WH -> first stop
    };

    // Remove null/undefined values to allow DB defaults if any (like status)
    Object.keys(dataToInsert).forEach(key => {
        if (dataToInsert[key] === null || dataToInsert[key] === undefined) {
            delete dataToInsert[key];
        }
    });

    try {
        const { data, error } = await supabase
            .from('routes') // Your table name
            .insert([dataToInsert])
            .select(); // Returns the inserted record

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
  console.log(`🚀 Servidor backend v1.5 (con Supabase) corriendo en http://localhost:${PORT}`);
});
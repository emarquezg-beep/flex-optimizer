require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const PORT = 3000;

const allowedOrigins = [
  'http://localhost:5173',
  'https://flex-optimizer.vercel.app'
];
const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());
const mapsClient = new Client({});

app.get('/', (req, res) => {
  res.send('<h1>Servidor Backend Activo y Listo para Rutas Largas</h1>');
});

// Función asistente para dividir un array en segmentos de un tamaño específico.
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

app.post('/api/optimize-route', async (req, res) => {
  const { addresses } = req.body;
  if (!addresses || addresses.length < 2) {
    return res.status(400).json({ message: 'Se necesitan al menos un origen y un destino.' });
  }

  try {
    const origin = addresses[0];
    const finalDestination = addresses[addresses.length - 1];
    const workStops = addresses.slice(1, -1);
    
    const MAX_WAYPOINTS = 25; // Límite de la API de Google
    
    let fullOptimizedAddressList = [];
    let totalWorkDistance = 0;
    let totalWorkDuration = 0;
    
    if (workStops.length <= MAX_WAYPOINTS) {
        // --- LÓGICA PARA RUTAS NORMALES (MENOS DE 25 PARADAS) ---
        console.log(`✅ Ruta estándar detectada. Optimizando...`);
        const response = await mapsClient.directions({
            params: {
                origin: origin,
                destination: workStops.length > 0 ? workStops[workStops.length - 1] : origin,
                waypoints: workStops.slice(0, -1),
                optimize: true,
                avoid: ['tolls'],
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        const route = response.data.routes[0];
        if (route) {
            const orderedWaypoints = route.waypoint_order.map(index => workStops[index]);
            fullOptimizedAddressList = [...orderedWaypoints, workStops[workStops.length - 1]];
            route.legs.forEach(leg => {
                totalWorkDistance += leg.distance.value;
                totalWorkDuration += leg.duration.value;
            });
        }
    } else {
        // --- LÓGICA MEJORADA PARA RUTAS LARGAS ---
        const workStopChunks = chunkArray(workStops, MAX_WAYPOINTS);
        console.log(`✅ Ruta larga detectada. Procesando en ${workStopChunks.length} segmentos...`);
        
        let lastStopOfPreviousChunk = origin;

        for (const [index, chunk] of workStopChunks.entries()) {
            console.log(`-- Optimizando segmento ${index + 1}/${workStopChunks.length}...`);
            const response = await mapsClient.directions({
                params: {
                    origin: lastStopOfPreviousChunk,
                    destination: chunk[chunk.length - 1],
                    waypoints: chunk.slice(0, -1),
                    optimize: true,
                    avoid: ['tolls'],
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });
            const route = response.data.routes[0];
            if (!route) continue;

            const orderedWaypoints = route.waypoint_order.map(i => chunk[i]);
            const orderedChunk = [...orderedWaypoints, chunk[chunk.length - 1]];
            fullOptimizedAddressList.push(...orderedChunk);

            route.legs.forEach(leg => {
                totalWorkDistance += leg.distance.value;
                totalWorkDuration += leg.duration.value;
            });
            lastStopOfPreviousChunk = chunk[chunk.length - 1];
        }
    }
    
    // --- CÁLCULO DE COMMUTE (SIN CAMBIOS) ---
    const lastWorkStop = fullOptimizedAddressList[fullOptimizedAddressList.length - 1];
    const commuteWithTollsPromise = mapsClient.directions({ params: { origin: lastWorkStop, destination: finalDestination, key: process.env.GOOGLE_MAPS_API_KEY } });
    const commuteWithoutTollsPromise = mapsClient.directions({ params: { origin: lastWorkStop, destination: finalDestination, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } });
    
    const [withTollsResult, withoutTollsResult] = await Promise.all([commuteWithTollsPromise, commuteWithoutTollsPromise]);
    const withTollsLeg = withTollsResult.data.routes[0]?.legs[0];
    const withoutTollsLeg = withoutTollsResult.data.routes[0]?.legs[0];
    const tollCost = withTollsResult.data.routes[0]?.fare?.text || '$0.00';

    console.log(`🎉 Optimización completada. Total de ${fullOptimizedAddressList.length} paradas de trabajo ordenadas.`);
    res.json({
        workDistance: (totalWorkDistance / 1609.34).toFixed(2),
        workDuration: Math.round(totalWorkDuration / 60),
        optimizedAddressList: fullOptimizedAddressList,
        commute: {
            withTolls: { distance: (withTollsLeg.distance.value / 1609.34).toFixed(2), duration: Math.round(withTollsLeg.duration.value / 60), cost: tollCost },
            withoutTolls: { distance: (withoutTollsLeg.distance.value / 1609.34).toFixed(2), duration: Math.round(withoutTollsLeg.duration.value / 60), }
        }
    });

  } catch (error) {
    console.error("❌ Error con Google Maps:", error.response?.data?.error_message || error.message);
    res.status(500).json({ message: 'Error al optimizar la ruta.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
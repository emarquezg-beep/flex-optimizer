require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const PORT = 3000;

const allowedOrigins = [ 'http://localhost:5173', 'https://flex-optimizer.vercel.app' ];
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

// --- FUNCIONES ASISTENTES (sin cambios) ---
function getDistance(p1, p2) {
    const R = 6371e3; const φ1 = p1.lat * Math.PI/180; const φ2 = p2.lat * Math.PI/180;
    const Δφ = (p2.lat-p1.lat) * Math.PI/180; const Δλ = (p2.lng-p1.lng) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) { chunks.push(array.slice(i, i + size)); }
    return chunks;
}

app.post('/api/optimize-route', async (req, res) => {
  let { addresses } = req.body;
  addresses = addresses.filter(addr => addr && addr.trim() !== '');

  if (!addresses || addresses.length < 2) {
    return res.status(400).json({ message: 'Se necesitan al menos un origen y un destino.' });
  }

  try {
    const originAddress = addresses[0];
    const finalDestination = addresses[addresses.length - 1];
    let workStops = addresses.slice(1, -1);
    
    // --- PASO CERO: GEOCODIFICACIÓN CON LOGGING MEJORADO ---
    console.log(`Geocodificando ${workStops.length + 1} puntos de ruta...`);
    const geocodePromises = [originAddress, ...workStops].map(addr => 
        mapsClient.geocode({ params: { address: addr, key: process.env.GOOGLE_MAPS_API_KEY } })
    );
    const geocodeResults = await Promise.all(geocodePromises);
    
    const validLocations = [];
    geocodeResults.forEach((result, i) => {
        const locationData = result.data.results[0];
        const currentAddress = [originAddress, ...workStops][i];
        if (locationData && locationData.geometry.location_type !== 'APPROXIMATE') {
            validLocations.push({ address: currentAddress, coords: locationData.geometry.location });
        } else {
            // ¡LOGGING EXPLÍCITO DE LA DIRECCIÓN DESCARTADA!
            console.log(`🕵️‍♂️ DIRECCIÓN DESCARTADA: "${currentAddress}" (Razón: No encontrada o imprecisa)`);
        }
    });

    const originLocation = validLocations.shift();
    if (!originLocation) { return res.status(400).json({ message: 'La dirección de origen no es válida.' }); }
    
    // --- PASO UNO: PRE-CLASIFICACIÓN ---
    console.log(`Realizando pre-clasificación con ${validLocations.length} paradas válidas...`);
    const sortedStops = [];
    let currentLocation = originLocation;
    let unvisited = validLocations;
    while (unvisited.length > 0) {
        let nearestIndex = -1; let minDistance = Infinity;
        unvisited.forEach((stop, index) => {
            const distance = getDistance(currentLocation.coords, stop.coords);
            if (distance < minDistance) { minDistance = distance; nearestIndex = index; }
        });
        currentLocation = unvisited[nearestIndex];
        sortedStops.push(currentLocation.address);
        unvisited.splice(nearestIndex, 1);
    }
    workStops = sortedStops;

    // --- PASO DOS: OPTIMIZACIÓN POR SEGMENTOS (LÓGICA CORREGIDA) ---
    const MAX_WAYPOINTS = 25;
    let fullOptimizedAddressList = [];
    let totalWorkDistance = 0;
    let totalWorkDuration = 0;
    
    if (workStops.length > 0) {
        const workStopChunks = chunkArray(workStops, MAX_WAYPOINTS);
        console.log(`Procesando en ${workStopChunks.length} segmentos...`);
        let lastStopOfPreviousChunk = originAddress;

        for (const chunk of workStopChunks) {
            const response = await mapsClient.directions({ params: { origin: lastStopOfPreviousChunk, destination: chunk[chunk.length - 1], waypoints: chunk.slice(0, -1), optimize: true, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } });
            const route = response.data.routes[0];
            if (!route) continue;
            
            // ¡LA CORRECCIÓN ESTÁ AQUÍ!
            // 1. Reordenamos el segmento actual
            const orderedWaypoints = route.waypoint_order.map(i => chunk[i]);
            const orderedChunk = [...orderedWaypoints, chunk[chunk.length - 1]];
            
            // 2. Acumulamos los resultados en lugar de sobreescribirlos
            fullOptimizedAddressList = fullOptimizedAddressList.concat(orderedChunk);
            route.legs.forEach(leg => { 
                totalWorkDistance += leg.distance.value; 
                totalWorkDuration += leg.duration.value; 
            });

            lastStopOfPreviousChunk = chunk[chunk.length - 1];
        }
    }
    
    // --- CÁLCULO DE COMMUTE ---
    const lastWorkStop = fullOptimizedAddressList.length > 0 ? fullOptimizedAddressList[fullOptimizedAddressList.length - 1] : originAddress;
    const commutePromises = [
        mapsClient.directions({ params: { origin: lastWorkStop, destination: finalDestination, key: process.env.GOOGLE_MAPS_API_KEY } }),
        mapsClient.directions({ params: { origin: lastWorkStop, destination: finalDestination, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } })
    ];
    const [withTollsResult, withoutTollsResult] = await Promise.all(commutePromises);
    
    const withTollsLeg = withTollsResult.data.routes[0]?.legs[0];
    const withoutTollsLeg = withoutTollsResult.data.routes[0]?.legs[0];
    const tollCost = withTollsResult.data.routes[0]?.fare?.text || '$0.00';

    res.json({
        workDistance: (totalWorkDistance / 1609.34).toFixed(2),
        workDuration: Math.round(totalWorkDuration / 60),
        optimizedAddressList: fullOptimizedAddressList,
        commute: {
            withTolls: { distance: (withTollsLeg?.distance.value / 1609.34).toFixed(2), duration: Math.round(withTollsLeg?.duration.value / 60), cost: tollCost },
            withoutTolls: { distance: (withoutTollsLeg?.distance.value / 1609.34).toFixed(2), duration: Math.round(withoutTollsLeg?.duration.value / 60), }
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
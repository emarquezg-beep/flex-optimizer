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
    
    // --- PASO CERO: GEOCODIFICACIÓN ---
    console.log(`Geocodificando ${workStops.length + 1} puntos de ruta...`);
    const allPointsToGeocode = [originAddress, ...workStops];
    const geocodePromises = allPointsToGeocode.map(addr => 
        mapsClient.geocode({ params: { address: addr, key: process.env.GOOGLE_MAPS_API_KEY } })
    );
    const geocodeResults = await Promise.all(geocodePromises);
    
    const validLocations = [];
    geocodeResults.forEach((result, i) => {
        const locationData = result.data.results[0];
        const currentAddress = allPointsToGeocode[i];
        if (locationData && locationData.geometry.location_type !== 'APPROXIMATE') {
            validLocations.push({ address: currentAddress, coords: locationData.geometry.location });
        } else {
            console.log(`\n\n🕵️‍♂️ ALERTA: DIRECCIÓN DESCARTADA 🕵️‍♂️\n   "${currentAddress}"\n   (Razón: No encontrada o imprecisa)\n\n`);
        }
    });

    const originLocation = validLocations.find(loc => loc.address === originAddress);
    if (!originLocation) { return res.status(400).json({ message: 'La dirección de origen no es válida.' }); }
    
    const validWorkStops = validLocations.filter(loc => loc.address !== originAddress);

    // --- PASO UNO: PRE-CLASIFICACIÓN ---
    console.log(`Realizando pre-clasificación con ${validWorkStops.length} paradas válidas...`);
    const sortedStops = [];
    let currentLocation = originLocation;
    let unvisited = [...validWorkStops];
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

    // --- PASO DOS: OPTIMIZACIÓN POR SEGMENTOS ---
    const MAX_WAYPOINTS = 25;
    let fullOptimizedAddressList = [];
    let totalWorkDistance = 0;
    let totalWorkDuration = 0;
    
    const workStopChunks = chunkArray(workStops, MAX_WAYPOINTS);
    console.log(`Procesando en ${workStopChunks.length} segmentos...`);
    let lastStopOfPreviousChunk = originAddress;

    for (const [index, chunk] of workStopChunks.entries()) {
        if(chunk.length === 0) continue;

        const destination = chunk[chunk.length - 1];
        const waypoints = chunk.slice(0, -1);
        
        // --- ¡NUEVO LOG DE DEPURACIÓN! ---
        console.log(`\n-- Optimizando segmento ${index + 1}/${workStopChunks.length}...`);
        console.log(`   ORIGEN: ${lastStopOfPreviousChunk}`);
        console.log(`   DESTINO: ${destination}`);
        console.log(`   WAYPOINTS: ${waypoints.length}`);
        
        const response = await mapsClient.directions({ 
            params: { 
                origin: lastStopOfPreviousChunk, 
                destination: destination, 
                waypoints: waypoints, 
                optimize: true, 
                avoid: ['tolls'], 
                key: process.env.GOOGLE_MAPS_API_KEY 
            } 
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

        console.log(`-- Segmento ${index + 1} completado. Total acumulado: ${fullOptimizedAddressList.length} paradas.`);
        lastStopOfPreviousChunk = chunk[chunk.length - 1];
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
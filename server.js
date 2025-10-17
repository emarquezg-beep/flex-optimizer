require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const PORT = 3000;

// --- CONFIGURACIÓN DE CORS DEFINITIVA ---
const allowedOrigins = [
  'http://localhost:5173', // Para tus pruebas locales
  'https://flex-optimizer.vercel.app' // ¡LA URL CORRECTA DE TU APP EN VIVO!
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
// --- FIN DE LA CONFIGURACIÓN ---

app.use(express.json());
const mapsClient = new Client({});

app.get('/', (req, res) => {
  res.send('<h1>Servidor Backend Activo y Listo para Comparar Peajes</h1>');
});

app.post('/api/optimize-route', async (req, res) => {
  const { addresses } = req.body;
  if (!addresses || addresses.length < 2) {
    return res.status(400).json({ message: 'Se necesitan al menos un origen y un destino.' });
  }

  console.log(`✅ Recibidas ${addresses.length} paradas. Optimizando ruta de trabajo (SIN PEAJES)...`);
  
  try {
    const waypoints = addresses.slice(1, -2);
    const workDestination = addresses[addresses.length - 2];

    const workRouteResponse = await mapsClient.directions({
      params: {
        origin: addresses[0],
        destination: workDestination,
        waypoints: waypoints,
        optimize: true,
        avoid: ['tolls'],
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const workRoute = workRouteResponse.data.routes[0];
    if (!workRoute) { return res.status(500).json({ message: 'No se pudo encontrar una ruta de trabajo.' }); }

    const orderedWaypoints = workRoute.waypoint_order.map(index => waypoints[index]);
    const fullOptimizedAddressList = [...orderedWaypoints, workDestination];

    let workDistance = 0; let workDuration = 0;
    workRoute.legs.forEach(leg => {
        workDistance += leg.distance.value;
        workDuration += leg.duration.value;
    });

    const finalDestination = addresses[addresses.length - 1];
    const commuteWithTollsPromise = mapsClient.directions({ params: { origin: workDestination, destination: finalDestination, key: process.env.GOOGLE_MAPS_API_KEY } });
    const commuteWithoutTollsPromise = mapsClient.directions({ params: { origin: workDestination, destination: finalDestination, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } });
    
    const [withTollsResult, withoutTollsResult] = await Promise.all([commuteWithTollsPromise, commuteWithoutTollsPromise]);

    const withTollsLeg = withTollsResult.data.routes[0]?.legs[0];
    const withoutTollsLeg = withoutTollsResult.data.routes[0]?.legs[0];
    const tollCost = withTollsResult.data.routes[0]?.fare?.text || '$0.00';

    res.json({
        workDistance: (workDistance / 1609.34).toFixed(2),
        workDuration: Math.round(workDuration / 60),
        optimizedAddressList: fullOptimizedAddressList, 
        commute: {
            withTolls: { distance: (withTollsLeg.distance.value / 1609.34).toFixed(2), duration: Math.round(withTollsLeg.duration.value / 60), cost: tollCost },
            withoutTolls: { distance: (withoutTollsLeg.distance.value / 1609.34).toFixed(2), duration: Math.round(withoutTollsLeg.duration.value / 60), }
        }
    });
  } catch (error) {
    console.error("❌ Error con Google Maps:", error.response?.data || error.message);
    res.status(500).json({ message: 'Error al optimizar la ruta.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
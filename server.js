require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const PORT = 3000;

// Configuración de CORS que ya funciona perfectamente
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

// Función asistente para extraer las métricas de forma segura
function extractMetrics(response) {
    const leg = response?.data?.routes[0]?.legs[0];
    if (!leg) {
        return { distance: 0, duration: 0 }; // Devuelve 0 si no se encuentra una ruta
    }
    return {
        distance: (leg.distance.value / 1609.34).toFixed(2), // Convertido a millas
        duration: Math.round(leg.duration.value / 60)       // Convertido a minutos
    };
}

app.post('/api/optimize-route', async (req, res) => {
  let { addresses } = req.body;
  addresses = addresses.filter(addr => addr && addr.trim() !== '');

  // Ahora necesitamos al menos 3 puntos: Origen, 1 parada, Destino final.
  if (!addresses || addresses.length < 3) {
    return res.status(400).json({ message: 'Se necesitan al menos Origen, una Parada y un Destino.' });
  }

  try {
    // --- 1. DEFINIMOS LOS PUNTOS CLAVE PARA LOS CÁLCULOS ---
    const origin = addresses[0];                                  // Warehouse
    const firstStop = addresses[1];                               // Primera parada de la lista
    const lastStop = addresses[addresses.length - 2];             // Última parada de la lista
    const finalDestination = addresses[addresses.length - 1];   // Casa u otro destino

    console.log('✅ v1.0: Calculando escenarios...');

    // --- 2. PREPARAMOS LAS 5 LLAMADAS A LA API DE GOOGLE ---
    const promises = [
        // Tramo A: Warehouse -> Primera Parada
        mapsClient.directions({ params: { origin, destination: firstStop, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } }),
        // Tramo B: Última Parada -> Casa
        mapsClient.directions({ params: { origin: lastStop, destination: finalDestination, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } }),
        // Tramo C: Warehouse -> Última Parada
        mapsClient.directions({ params: { origin, destination: lastStop, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } }),
        // Tramo D: Primera Parada -> Casa
        mapsClient.directions({ params: { origin: firstStop, destination: finalDestination, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } }),
        // Tramo X (El Bloque): Primera Parada -> Última Parada (sin optimizar waypoints)
        mapsClient.directions({ params: { origin: firstStop, destination: lastStop, avoid: ['tolls'], key: process.env.GOOGLE_MAPS_API_KEY } })
    ];

    // --- 3. EJECUTAMOS TODAS LAS LLAMADAS AL MISMO TIEMPO ---
    const results = await Promise.all(promises);

    // --- 4. EXTRAEMOS LOS RESULTADOS Y LOS ENVIAMOS AL FRONTEND ---
    const [tramoA, tramoB, tramoC, tramoD, tramoX] = results.map(extractMetrics);

    console.log('🎉 v1.0: Escenarios calculados con éxito!');
    res.json({
      scenarioData: { tramoA, tramoB, tramoC, tramoD, tramoX },
      originalStops: addresses.slice(1, -1) // Enviamos las paradas originales para el cálculo de tiempo
    });

  } catch (error) {
    console.error("❌ Error en el cálculo de escenarios:", error.response?.data?.error_message || error.message);
    res.status(500).json({ message: 'Error al calcular los escenarios.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v1.0 corriendo en http://localhost:${PORT}`);
});
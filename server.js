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

// --- FUNCIÓN ASISTENTE PARA CALCULAR UN TRAMO ---
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
        
        // Si hay waypoints, sumamos todos los tramos del segmento
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

app.post('/api/optimize-route', async (req, res) => {
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

    // --- CÁLCULOS DE LOS TRAMOS PRINCIPALES ---
    const toFirstStopPromise = calculateLeg(origin, firstStop);
    const toFinalDestinationPromise = calculateLeg(lastStop, finalDestination);
    const toLastStopForInversePromise = calculateLeg(origin, lastStop);
    const fromFirstStopToHomePromise = calculateLeg(firstStop, finalDestination);

    // --- CÁLCULO DEL BLOQUE POR SEGMENTOS DE 9 ---
    const STOPS_PER_SEGMENT = 9;
    const workStopChunks = [];
    for (let i = 0; i < workStops.length; i += STOPS_PER_SEGMENT) {
        workStopChunks.push(workStops.slice(i, i + STOPS_PER_SEGMENT));
    }

    const segmentPromises = workStopChunks.map(chunk => 
        calculateLeg(chunk[0], chunk[chunk.length - 1], chunk.slice(1, -1))
    );
    
    // Ejecutamos todo en paralelo
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
        // Datos para el cálculo de la ruta inversa
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend v1.2 corriendo en http://localhost:${PORT}`);
});
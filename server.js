// server.js (v3.1 - ETA en Caliente + Segmentos Inversos v1.8)

import { DateTime } from 'luxon';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { Client } from '@googlemaps/google-maps-services-js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
// 🤖 GEMINI OCR SETUP
// ═══════════════════════════════════════════════════════════════
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import fs from 'fs/promises';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configurar multer para recibir imágenes en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB por archivo
    files: 7 // Máximo 7 archivos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes PNG o JPEG'));
    }
  }
});

console.log('🤖 Gemini OCR System activado');


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
  'https://flex-optimizer-git-feature-sl-7cb1e8-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-git-feature-ai-ad3680-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-git-feature-oc-8d3859-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-3hdfbclh5-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-git-feat-route-fc6403-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-git-feat-ux-oc-54c0e5-ernestos-projects-d9e7c95d.vercel.app',
  'https://flex-optimizer-git-ui-audible-theme-ernestos-projects-d9e7c95d.vercel.app',
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
// Middleware para interceptar TODAS las requests OPTIONS (preflight)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log(`✅ [PREFLIGHT] ${req.path}`);
    
    // Responder manualmente a preflight con headers CORS
    const origin = req.headers.origin;
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400'); // 24 horas de cache
      
      return res.status(200).end();
    } else {
      console.error(`❌ [PREFLIGHT BLOCKED] Origin: ${origin}`);
      return res.status(403).json({ error: 'CORS not allowed' });
    }
  }
  
  next();
});

console.log("✅ CORS configurado con handler OPTIONS manual");
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

// ═══════════════════════════════════════════════════════════════
// 🔍 PRE-VALIDATION: Geocode individual addresses
// ═══════════════════════════════════════════════════════════════

/**
 * Valida una dirección individual usando Geocoding API
 * Retorna: { isValid, address, reason, geocoded }
 */


// ═══════════════════════════════════════════════════════════════
// 🎯 SMART GEOCODING: Use warehouse location as geographic bias
// ═══════════════════════════════════════════════════════════════

/**
 * Cache de warehouses geocodificados para no repetir llamadas
 */
const warehouseCache = new Map();

/**
 * Geocodifica el warehouse y extrae su ubicación + componentes
 */
async function getWarehouseReference(warehouseAddress) {
  // Verificar cache
  if (warehouseCache.has(warehouseAddress)) {
    return warehouseCache.get(warehouseAddress);
  }
  
  try {
    const params = {
      address: warehouseAddress,
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    const response = await mapsClient.geocode({ params });
    
    if (response.data.status !== 'OK' || !response.data.results[0]) {
      console.error(`⚠️ No se pudo geocodificar warehouse: ${warehouseAddress}`);
      return null;
    }
    
    const result = response.data.results[0];
    const location = result.geometry.location;
    
    // Extraer componentes de dirección
    const components = result.address_components;
    const city = components.find(c => c.types.includes('locality'))?.long_name;
    const state = components.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
    const zip = components.find(c => c.types.includes('postal_code'))?.long_name;
    
    const warehouseRef = {
      location,
      city,
      state,
      zip,
      formatted_address: result.formatted_address,
      // Crear bounds de ~30 millas alrededor del warehouse
      bounds: {
        northeast: {
          lat: location.lat + 0.507, // ~35 millas
          lng: location.lng + 0.507
        },
        southwest: {
          lat: location.lat - 0.507,
          lng: location.lng - 0.507
        }
      }
    };
    
    warehouseCache.set(warehouseAddress, warehouseRef);
    console.log(`✅ Warehouse geocodificado: ${city}, ${state} ${zip}`);
    
    return warehouseRef;
    
  } catch (error) {
    console.error(`❌ Error geocodificando warehouse:`, error.message);
    return null;
  }
}

console.log('🎯 Smart Geocoding System activado');

// ═══════════════════════════════════════════════════════════════
// FIN SMART GEOCODING
// ═══════════════════════════════════════════════════════════════

/**
 * Valida una dirección individual usando Geocoding API
 * @param {string} address - Dirección a validar
 * @param {Object} warehouseRef - Referencia del warehouse (opcional)
 */
async function validateAddress(address, warehouseRef = null) {
  try {
    const params = {
      address,
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // 🆕 Si tenemos warehouse reference, aplicar bounds y components
    if (warehouseRef) {
      params.bounds = warehouseRef.bounds;
      
      // También podemos forzar componentes de dirección
      if (warehouseRef.state) {
        params.components = `administrative_area:${warehouseRef.state}`;
      }
    }
    
    const response = await mapsClient.geocode({ params });
    
    if (response.data.status !== 'OK') {
      return {
        isValid: false,
        address,
        reason: `GEOCODE_${response.data.status}`,
        geocoded: null
      };
    }
    
    const result = response.data.results[0];
    
    // Verificar partial match
    // Verificar partial match
    if (result.partial_match === true) {
      const geocodedState = result.address_components.find(
        c => c.types.includes('administrative_area_level_1')
      )?.short_name;
      
      // Verificar si tiene street_number
      const hasStreetNumber = result.address_components.some(
        c => c.types.includes('street_number')
      );
      
      // Si tenemos warehouseRef, verificar que el estado coincida
      if (warehouseRef && warehouseRef.state) {
        if (geocodedState !== warehouseRef.state) {
          console.log(`❌ Partial match en estado incorrecto: ${address}`);
          console.log(`   Esperado: ${warehouseRef.state}, Obtenido: ${geocodedState}`);
          
          return {
            isValid: false,
            address,
            reason: `PARTIAL_MATCH_WRONG_STATE_${geocodedState}`,
            geocoded: result.formatted_address
          };
        }
      }
      
      // 🆕 Rechazar si no tiene número de calle (demasiado impreciso)
      if (!hasStreetNumber) {
        console.log(`❌ Partial match sin número de calle: ${address} → ${result.formatted_address}`);
        
        return {
          isValid: false,
          address,
          reason: 'PARTIAL_MATCH_NO_STREET_NUMBER',
          geocoded: result.formatted_address
        };
      }
      
      // Partial match válido (tiene número de calle y estado correcto)
      console.log(`⚠️ Partial match aceptado: ${address} → ${result.formatted_address}`);
      registerProblematicAddress(address, ['PARTIAL_GEOCODE_MATCH']);
      
      return {
        isValid: true,
        address,
        geocoded: result.formatted_address,
        location: result.geometry.location,
        isPartialMatch: true
      };
    }

    
    return {
      isValid: true,
      address,
      geocoded: result.formatted_address,
      location: result.geometry.location,
      isPartialMatch: false
    };
    
  } catch (error) {
    return {
      isValid: false,
      address,
      reason: 'GEOCODE_NETWORK_ERROR',
      error: error.message
    };
  }
}


/**
 * Valida todas las direcciones de un segmento
 * Si encuentra inválidas, las reemplaza con promedio
 */
async function validateAndFixSegment(origin, destination, waypoints, warehouseRef = null) {
  console.log(`🔍 Pre-validando segmento: ${waypoints.length + 2} direcciones...`);
  
  const allAddresses = [origin, ...waypoints, destination];
  const validationPromises = allAddresses.map(addr => validateAddress(addr, warehouseRef));
  const validations = await Promise.all(validationPromises);
  
  // Identificar direcciones inválidas
  const invalidAddresses = validations.filter(v => !v.isValid);
  
  if (invalidAddresses.length > 0) {
    console.log(`⚠️ ${invalidAddresses.length} direcciones inválidas detectadas:`);
    invalidAddresses.forEach(inv => {
      console.log(`   ❌ ${inv.address} → ${inv.reason}`);
      registerProblematicAddress(inv.address, [inv.reason]);
    });
  }
  
  // 🆕 Reemplazar direcciones con versiones geocodificadas
  const geocodedOrigin = validations[0].isValid ? validations[0].geocoded : origin;
  const geocodedDestination = validations[validations.length - 1].isValid 
    ? validations[validations.length - 1].geocoded 
    : destination;
  
  const geocodedWaypoints = validations
    .slice(1, -1)  // Excluir origin y destination
    .filter(v => v.isValid)  // Solo válidas
    .map(v => v.geocoded);
  
  return {
    hasInvalidAddresses: invalidAddresses.length > 0,
    invalidAddresses,
    validAddresses: validations.filter(v => v.isValid),
    // 🆕 Devolver versiones geocodificadas
    geocodedOrigin,
    geocodedDestination,
    geocodedWaypoints
  };
}


console.log('🔍 Address Pre-Validation System activado');

// ═══════════════════════════════════════════════════════════════
// FIN PRE-VALIDATION
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// 🔧 CALCULATE LEG - With Pre-Validation
// ═══════════════════════════════════════════════════════════════
async function calculateLeg(origin, destination, waypoints = [], departureTime = null, skipValidation = false, warehouseRef = null) {
  try {
    // PASO 0: Pre-validar direcciones (SIEMPRE)
    if (!skipValidation) {
      // Validar origin y destination siempre
      const originValidation = await validateAddress(origin, warehouseRef);
      const destValidation = await validateAddress(destination, warehouseRef);
      
      if (!originValidation.isValid) {
        console.log(`❌ Origin inválido: ${origin} (${originValidation.reason})`);
        registerProblematicAddress(origin, [originValidation.reason]);
        
        return {
          distance: 0,
          duration: 0,
          durationValue: 0,
          error: true,
          errorType: 'INVALID_ORIGIN',
          invalidAddresses: [originValidation],
          legsDetailed: [],
          maxLegMiles: 0,
          geocodedWaypoints: []
        };
      }
      
      if (!destValidation.isValid) {
        console.log(`❌ Destination inválido: ${destination} (${destValidation.reason})`);
        registerProblematicAddress(destination, [destValidation.reason]);
        
        return {
          distance: 0,
          duration: 0,
          durationValue: 0,
          error: true,
          errorType: 'INVALID_DESTINATION',
          invalidAddresses: [destValidation],
          legsDetailed: [],
          maxLegMiles: 0,
          geocodedWaypoints: []
        };
      }
      
      // 🆕 Usar versiones geocodificadas
      origin = originValidation.geocoded;
      destination = destValidation.geocoded;
      
      // Validar waypoints si existen
      if (waypoints.length > 0) {
        const validation = await validateAndFixSegment(origin, destination, waypoints, warehouseRef);
        
        if (validation.hasInvalidAddresses) {
          console.log(`🔧 Waypoints limpiados: ${waypoints.length} → ${validation.geocodedWaypoints.length}`);
        }
        
        // 🆕 Usar versiones geocodificadas
        origin = validation.geocodedOrigin;
        destination = validation.geocodedDestination;
        waypoints = validation.geocodedWaypoints;
      }
    }
    
    // 1. Construir parámetros base (ahora con direcciones geocodificadas)
    const params = {
      origin,  // 👈 Ya geocodificada: "246 Vervain Ave, Davenport, FL 33837, USA"
      destination,  // 👈 Ya geocodificada
      waypoints,  // 👈 Ya geocodificadas
      avoid: ['tolls'],
      key: process.env.GOOGLE_MAPS_API_KEY,
    };
    // 2. Agregar departure time si existe (para tráfico futuro)
    if (departureTime) {
      params.departure_time = departureTime;
    }

    const response = await mapsClient.directions({ params });

    if (response.data.status !== 'OK') {
      console.error(`❌ Google Maps API Error: ${response.data.status}`);
      console.error(`   Origin: ${origin}`);
      console.error(`   Destination: ${destination}`);
      console.error(`   Waypoints: ${waypoints.length}`);
      
      return {
        distance: 0,
        duration: 0,
        durationValue: 0,
        error: true,
        errorType: response.data.status,
        origin,
        destination,
        waypoints,
        legsDetailed: [],
        maxLegMiles: 0,
        geocodedWaypoints: []
      };
    }

    const route = response.data.routes[0];
    if (!route || !route.legs || route.legs.length === 0) {
      console.error(`❌ No route found between ${origin} and ${destination}`);
      return {
        distance: 0,
        duration: 0,
        durationValue: 0,
        error: true,
        errorType: 'NO_ROUTE',
        origin,
        destination,
        waypoints,
        legsDetailed: [],
        maxLegMiles: 0,
        geocodedWaypoints: []
      };
    }

    // 3. Procesar legs con detalles extendidos
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    const legsDetailed = [];
    let maxLegMiles = 0;

    route.legs.forEach((leg, index) => {
      const distanceMeters = leg.distance.value;
      const distanceMiles = Number((distanceMeters / 1609.34).toFixed(2));
      
      const legDurationSeconds = leg.duration_in_traffic 
        ? leg.duration_in_traffic.value 
        : leg.duration.value;
      
      const durationMinutes = Math.round(legDurationSeconds / 60);

      totalDistanceMeters += distanceMeters;
      totalDurationSeconds += legDurationSeconds;

      if (distanceMiles > maxLegMiles) {
        maxLegMiles = distanceMiles;
      }

      legsDetailed.push({
        legIndex: index,
        distanceMeters,
        distanceMiles,
        durationSeconds: legDurationSeconds,
        durationMinutes,
        startAddress: leg.start_address,
        endAddress: leg.end_address
      });
    });

    // 4. Extraer geocoded_waypoints
    const geocodedWaypoints = response.data.geocoded_waypoints || [];

    // 5. Devolver datos extendidos
    return {
      distance: Number((totalDistanceMeters / 1609.34).toFixed(2)),
      duration: Math.round(totalDurationSeconds / 60),
      durationValue: totalDurationSeconds,
      error: false,
      legsDetailed,
      maxLegMiles: Number(maxLegMiles.toFixed(2)),
      geocodedWaypoints
    };

  } catch (error) {
    console.error(`❌ Error calculando tramo de ${origin} a ${destination}:`,
      error.response?.data?.error_message || error.message);
    return {
      distance: 0,
      duration: 0,
      durationValue: 0,
      error: true,
      errorType: 'NETWORK_ERROR',
      errorMessage: error.response?.data?.error_message || error.message,
      origin,
      destination,
      waypoints,
      legsDetailed: [],
      maxLegMiles: 0,
      geocodedWaypoints: []
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 🕵️ OUTLIER DETECTION & IMPUTATION SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta legs sospechosas (outliers) basado en:
 * - distanceMiles === 0 o durationMinutes === 0
 * - distanceMiles > 7.5 (rutas locales no deberían tener legs tan largas)
 * - partial_match en geocodedWaypoints
 */
function detectOutlierLegs(legsDetailed, geocodedWaypoints = []) {
  const outliers = [];
  
  legsDetailed.forEach((leg, index) => {
    const reasons = [];
    
    // Regla 1: Distancia o duración en cero
    if (leg.distanceMiles === 0 || leg.durationMinutes === 0) {
      reasons.push('ZERO_VALUE');
    }
    
    // Regla 2: Leg anormalmente larga (>7.5 millas)
    if (leg.distanceMiles > 7.5) {
      reasons.push('EXCESSIVE_DISTANCE');
    }
    
    // Regla 3: Partial match en geocoding
    // geocodedWaypoints[0] = origin, [1] = first waypoint, etc.
    // Para leg N: checkear waypoint N y N+1
    const waypointIndex = index + 1; // +1 porque [0] es origin
    if (geocodedWaypoints[waypointIndex]) {
      if (geocodedWaypoints[waypointIndex].partial_match === true) {
        reasons.push('PARTIAL_GEOCODE_MATCH');
      }

      // 🆕 REGLA 4: Geocoder status con error
      const geocoderStatus = geocodedWaypoints[waypointIndex].geocoder_status;
      if (geocoderStatus && geocoderStatus !== 'OK') {
        reasons.push(`GEOCODE_ERROR_${geocoderStatus}`);
      }
    }
    
    // Si hay razones, marcar como outlier
    if (reasons.length > 0) {
        outliers.push({
        legIndex: index,
        distanceMiles: leg.distanceMiles,
        durationMinutes: leg.durationMinutes,
        startAddress: leg.startAddress,
        endAddress: leg.endAddress,
        reasons,
        isOutlier: true
      });
    }
  });
  
  return outliers;
}

/**
 * Calcula promedio de legs "sanas" (no outliers)
 * Retorna: { avgDistanceMiles, avgDurationMinutes, healthyCount }
 */
function calculateHealthyAverage(legsDetailed) {
  const healthyLegs = legsDetailed.filter(leg =>
    leg.distanceMiles > 0 &&
    leg.distanceMiles <= 7.5 &&
    leg.durationMinutes > 0
  );
  
  if (healthyLegs.length === 0) {
    return {
      avgDistanceMiles: 0,
      avgDurationMinutes: 0,
      healthyCount: 0
    };
  }
  
  const totalDistance = healthyLegs.reduce((sum, leg) => sum + leg.distanceMiles, 0);
  const totalDuration = healthyLegs.reduce((sum, leg) => sum + leg.durationMinutes, 0);
  
  return {
    avgDistanceMiles: Number((totalDistance / healthyLegs.length).toFixed(2)),
    avgDurationMinutes: Math.round(totalDuration / healthyLegs.length),
    healthyCount: healthyLegs.length
  };
}

/**
 * Imputa valores razonables a legs outliers usando promedio de legs sanas
 * Retorna: { legsImputed (array corregido), imputedCount, qualityFlag }
 */
function imputeOutlierLegs(legsDetailed, outliers, geocodedWaypoints = []) {
  // Calcular promedio de legs sanas
  const { avgDistanceMiles, avgDurationMinutes, healthyCount } = calculateHealthyAverage(legsDetailed);
  
  // Si no hay legs sanas suficientes, marcar como LOW_QUALITY
  const outlierPercentage = (outliers.length / legsDetailed.length) * 100;
  
  if (healthyCount < 3 || outlierPercentage > 15) {
    return {
      legsImputed: legsDetailed,
      imputedCount: 0,
      qualityFlag: 'LOW_QUALITY',
      message: `Too many outliers (${outliers.length}/${legsDetailed.length}). Cannot reliably impute.`
    };
  }
  
  // Crear copia de legs para imputation
  const legsImputed = legsDetailed.map(leg => ({ ...leg }));
  let imputedCount = 0;
  
  // Imputar cada outlier
  outliers.forEach(outlier => {
    const legIndex = outlier.legIndex;
    legsImputed[legIndex].distanceMiles = avgDistanceMiles;
    legsImputed[legIndex].durationMinutes = avgDurationMinutes;
    legsImputed[legIndex].isImputed = true;
    legsImputed[legIndex].originalDistance = outlier.distanceMiles;
    legsImputed[legIndex].originalDuration = outlier.durationMinutes;
    legsImputed[legIndex].imputationReasons = outlier.reasons;
    imputedCount++;
  });
  
  return {
    legsImputed,
    imputedCount,
    qualityFlag: imputedCount > 0 ? 'IMPUTED' : null,
    avgUsed: { avgDistanceMiles, avgDurationMinutes }
  };
}

/**
 * Recalcula totales de distancia/duración usando legs imputadas
 */
function recalculateTotalsFromLegs(legsArray) {
  const totalDistance = legsArray.reduce((sum, leg) => sum + leg.distanceMiles, 0);
  const totalDuration = legsArray.reduce((sum, leg) => sum + leg.durationMinutes, 0);
  
  return {
    distance: Number(totalDistance.toFixed(2)),
    duration: Math.round(totalDuration),
    durationValue: totalDuration * 60 // convertir a segundos
  };
}

/**
 * Registra dirección problemática en Supabase
 */
async function registerProblematicAddress(address, reasons) {
  try {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('problematic_addresses')
      .select('id, times_flagged')
      .eq('raw_address', address)
      .single();
    
    if (existing) {
      // Incrementar contador
      await supabase
        .from('problematic_addresses')
        .update({
          times_flagged: existing.times_flagged + 1,
          last_flagged_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      console.log(`🔄 Dirección problemática actualizada: ${address} (${existing.times_flagged + 1} veces)`);
    } else {
      // Crear nueva entrada
      await supabase
        .from('problematic_addresses')
        .insert([{
          raw_address: address,
          notes: `Detected reasons: ${reasons.join(', ')}`,
          source: 'SYSTEM_DETECTED'
        }]);
      
      console.log(`🆕 Nueva dirección problemática registrada: ${address}`);
    }
  } catch (error) {
    console.error('⚠️ Error registrando dirección problemática:', error.message);
    // No throw - esto no debe romper la ruta
  }
}

console.log('🕵️ Outlier Detection System activado');

// ═══════════════════════════════════════════════════════════════
// FIN OUTLIER DETECTION SYSTEM
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// 🛣️ ENDPOINT: OPTIMIZE ROUTE - With Smart Geocoding
// ═══════════════════════════════════════════════════════════════
app.post('/api/optimize-route', authenticateUser, async (req, res) => {
  let {
    addresses,
    aiOptimizedAddresses,
    finalDestination: customFinalDestination,
    startTime,
    warehouseDelay,
    currentDate,
    warehouse,           // 👈 Dirección completa (para geocoding)
    warehouseCode        // 👈 Código (para BD)
  } = req.body;

  // 🧪 TEMPORAL: Si no viene warehouse, usar uno de prueba
//if (!warehouse || warehouse.trim() === '') {
//  warehouse = "9775 Air Commerce Pkwy, Orlando, FL 32827"; // 👈 DOR5
//  console.log('🧪 USANDO WAREHOUSE DE PRUEBA:', warehouse);
// }

  console.log("------------------------------------------------");
  console.log("📨 RECEPCIÓN DE DATOS EN BACKEND:");
  console.log(`📦 Direcciones Normales: ${addresses ? addresses.length : 0}`);
  console.log(`🤖 Direcciones IA: ${aiOptimizedAddresses ? aiOptimizedAddresses.length : 'NULL/UNDEFINED'}`);
  console.log(`🏭 Warehouse: ${warehouse || 'NO PROPORCIONADO'}`);
  console.log(`🔑 Warehouse Code: ${warehouseCode || 'NO PROPORCIONADO'}`);
  console.log("------------------------------------------------");

  // Validación básica
  addresses = addresses.filter(addr => addr && addr.trim() !== '');
  if (!addresses || addresses.length < 3) {
    return res.status(400).json({ message: 'Datos insuficientes (faltan paradas).', hasErrors: true });
  }

  try {
    const ariaResult = await calcularMultiplierARIA(req.userId);

      // 🆕 Geocodificar warehouse para biasing
      let warehouseRef = null;
      if (warehouse && warehouse.trim() !== '') {
        warehouseRef = await getWarehouseReference(warehouse);
        if (warehouseRef) {
          console.log(`🎯 Bias geográfico activado: ${warehouseRef.city}, ${warehouseRef.state} ${warehouseRef.zip}`);
        }
      } else {
        console.log('⚠️ No se proporcionó warehouse, geocoding sin bias geográfico');
      }

    // ==========================================
    // 1. PREPARACIÓN COMÚN
    // ==========================================
    const origin = addresses[0];
    const finalDestination = customFinalDestination || addresses[addresses.length - 1];

    // Helper para segmentos
    const generateSegments = (stops) => {
      const segs = [];
      for (let i = 0; i < stops.length; i += 9) {
        const chunk = stops.slice(i, i + 10);
        if (chunk.length > 0) {
          segs.push({
            origin: chunk[0],
            destination: chunk[chunk.length - 1],
            waypoints: chunk.slice(1, -1)
          });
        }
      }
      return segs;
    };

    // ==========================================
    // 2. CÁLCULO RUTA NORMAL (CON DETECCIÓN)
    // ==========================================
    const workStops = addresses.slice(1, -1);
    const normalSegments = generateSegments(workStops);
    const firstStop = workStops[0];
    const lastStop = workStops[workStops.length - 1];

    console.log(`🛣️ Calculando Ruta Normal (${workStops.length} paradas)...`);

    // Ejecutar cálculos CON warehouseRef
    const normalPromises = [
      calculateLeg(origin, firstStop, [], null, false, warehouseRef),
      calculateLeg(lastStop, finalDestination, [], null, false, warehouseRef),
      ...normalSegments.map(seg => calculateLeg(seg.origin, seg.destination, seg.waypoints, null, false, warehouseRef))
    ];

    const normalResults = await Promise.all(normalPromises);

    // Procesar resultados
    const toFirstStop = normalResults[0];
    const toFinalDestination = normalResults[1];
    const normalSegmentResults = normalResults.slice(2);

    // 🕵️ Procesar cada segmento con detección de outliers
    const segmentsWithStops = normalSegmentResults.map((result, index) => {
      const seg = normalSegments[index];
      const stops = [seg.origin, ...seg.waypoints, seg.destination];

      // CASO 1: Si el segmento tiene error
      if (result.error) {
        console.log(`❌ Segmento ${index} con error: ${result.errorType}`);
        
        stops.forEach(address => {
          registerProblematicAddress(address, [`SEGMENT_ERROR_${result.errorType}`]);
        });
        
        return {
          ...result,
          stops,
          hasOutliers: true,
          outlierCount: stops.length,
          qualityFlag: 'ERROR',
          errorDetails: {
            errorType: result.errorType,
            errorMessage: result.errorMessage || 'Google Maps API error',
            affectedAddresses: stops
          }
        };
      }

      // CASO 2: Segmento OK, detectar outliers
      const outliers = detectOutlierLegs(result.legsDetailed, result.geocodedWaypoints);
      
      let processedResult = { ...result };
      let qualityFlag = null;
      let imputedCount = 0;

      if (outliers.length > 0) {
        console.log(`🕵️ Segmento ${index}: ${outliers.length} outliers detectados`);
        
        const imputation = imputeOutlierLegs(
          result.legsDetailed, 
          outliers, 
          result.geocodedWaypoints
        );

        if (imputation.qualityFlag !== 'LOW_QUALITY') {
          const recalculated = recalculateTotalsFromLegs(imputation.legsImputed);
          processedResult.distance = recalculated.distance;
          processedResult.duration = recalculated.duration;
          processedResult.durationValue = recalculated.durationValue;
          processedResult.legsDetailed = imputation.legsImputed;
          imputedCount = imputation.imputedCount;
          qualityFlag = imputation.qualityFlag;

          console.log(`✅ Segmento ${index}: ${imputedCount} legs imputadas (avg: ${imputation.avgUsed.avgDistanceMiles} mi)`);
        } else {
          qualityFlag = 'LOW_QUALITY';
          console.log(`⚠️ Segmento ${index}: Demasiados outliers, marcado como LOW_QUALITY`);
        }

        outliers.forEach(outlier => {
          registerProblematicAddress(outlier.endAddress, outlier.reasons);
        });
      }

      return {
        ...processedResult,
        stops,
        hasOutliers: outliers.length > 0,
        outlierCount: outliers.length,
        imputedCount,
        qualityFlag,
        outlierLegs: outliers.length > 0 ? outliers : undefined
      };
    });

    // ==========================================
    // 3. CÁLCULO RUTA IA (OPCIONAL)
    // ==========================================
    let aiRouteData = null;
    let isAiOptimized = false;

    if (aiOptimizedAddresses && Array.isArray(aiOptimizedAddresses) && aiOptimizedAddresses.length > 0) {
      console.log(`🤖 Intentando calcular Ruta IA (${aiOptimizedAddresses.length} paradas)...`);
      
      try {
        const altWorkStops = aiOptimizedAddresses;
        const altFirstStop = altWorkStops[0];
        const altLastStop = altWorkStops[altWorkStops.length - 1];
        const altSegments = generateSegments(altWorkStops);

        const aiPromises = [
          calculateLeg(origin, altFirstStop, [], null, false, warehouseRef),
          calculateLeg(altLastStop, finalDestination, [], null, false, warehouseRef),
          ...altSegments.map(seg => calculateLeg(seg.origin, seg.destination, seg.waypoints, null, false, warehouseRef))
        ];

        const aiResults = await Promise.all(aiPromises);

        const toAltFirstStop = aiResults[0];
        const fromAltLastStop = aiResults[1];
        const altSegmentResults = aiResults.slice(2);

        const altSegmentsWithStops = altSegmentResults.map((result, idx) => {
          const seg = altSegments[idx];
          const segStops = seg.waypoints.length > 0
            ? [seg.origin, ...seg.waypoints, seg.destination]
            : [seg.origin, seg.destination];

          if (result.error) {
            segStops.forEach(address => {
              registerProblematicAddress(address, [`AI_SEGMENT_ERROR_${result.errorType}`]);
            });
            
            return {
              ...result,
              stops: segStops,
              hasOutliers: true,
              qualityFlag: 'ERROR'
            };
          }

          const outliers = detectOutlierLegs(result.legsDetailed, result.geocodedWaypoints);
          
          if (outliers.length > 0) {
            const imputation = imputeOutlierLegs(result.legsDetailed, outliers, result.geocodedWaypoints);
            
            if (imputation.qualityFlag !== 'LOW_QUALITY') {
              const recalculated = recalculateTotalsFromLegs(imputation.legsImputed);
              return {
                ...result,
                ...recalculated,
                stops: segStops,
                legsDetailed: imputation.legsImputed,
                hasOutliers: true,
                outlierCount: outliers.length,
                imputedCount: imputation.imputedCount,
                qualityFlag: imputation.qualityFlag
              };
            }
          }

          return { ...result, stops: segStops, hasOutliers: false };
        });

        aiRouteData = {
          toStart: toAltFirstStop,
          toEnd: fromAltLastStop,
          segments: altSegmentsWithStops
        };

        isAiOptimized = true;
        console.log("✅ Ruta IA calculada exitosamente.");
      } catch (aiError) {
        console.error("⚠️ Error calculando Ruta IA (Se omite):", aiError.message);
      }
    } else {
      console.log("ℹ️ Sin sugerencia válida de IA.");
    }

    // ==========================================
    // 4. CALCULAR CALIDAD GLOBAL DE RUTA
    // ==========================================
    const totalOutliers = segmentsWithStops.reduce((sum, seg) => sum + (seg.outlierCount || 0), 0);
    const totalImputed = segmentsWithStops.reduce((sum, seg) => sum + (seg.imputedCount || 0), 0);
    const totalLegs = segmentsWithStops.reduce((sum, seg) => sum + (seg.legsDetailed?.length || 0), 0);
    const hasErrors = segmentsWithStops.some(seg => seg.qualityFlag === 'ERROR');
    const hasLowQuality = segmentsWithStops.some(seg => seg.qualityFlag === 'LOW_QUALITY');

    let globalQualityFlag = null;
    if (hasErrors) {
      globalQualityFlag = 'HAS_ERRORS';
    } else if (hasLowQuality) {
      globalQualityFlag = 'LOW_QUALITY';
    } else if (totalImputed > 0) {
      globalQualityFlag = 'IMPUTED';
    }

    // ==========================================
    // 5. RESPUESTA FINAL
    // ==========================================
    res.json({
      hasErrors: false,
      isAiOptimized,
      
      toFirstStop,
      segments: segmentsWithStops,
      toFinalDestination,
      
      aiRoute: aiRouteData,
      
      aria: {
        multiplier: ariaResult.multiplier,
        rutasAnalizadas: ariaResult.rutasAnalizadas
      },

      routeQuality: {
        totalSegments: segmentsWithStops.length,
        totalLegs,
        totalOutliers,
        totalImputed,
        segmentsWithErrors: segmentsWithStops.filter(s => s.qualityFlag === 'ERROR').length,
        globalQualityFlag,
        hasSeriousIssues: hasErrors || hasLowQuality
      },
      warehouseCode // 👈 Devolver el código para que el frontend lo use en calculateLogData
    });

  } catch (error) {
    console.error("❌ Error CRÍTICO en endpoint:", error);
    res.status(500).json({
      hasErrors: true,
      message: 'Error interno del servidor al procesar la ruta.',
      error: error.message
    });
  }
});

// =========================================================
// 🛠️ HELPER: PARSEAR DURACIÓN (Si google devuelve texto)
// =========================================================
function parseDurationToSeconds(durationStr) {
    // Si ya es número, devolver
    if (typeof durationStr === 'number') return durationStr;
    if (!durationStr) return 0;

    // Si viene como "1 hour 5 mins"
    let totalSeconds = 0;
    
    const hoursMatch = durationStr.match(/(\d+)\s*hour/);
    const minsMatch = durationStr.match(/(\d+)\s*min/);

    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
    if (minsMatch) totalSeconds += parseInt(minsMatch[1]) * 60;

    return totalSeconds;
}

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
    
// 🚗 Actualizar millaje del vehículo automáticamente
if (logData.vehicle_id && logData.millas_de_trabajo) {
    const millasNuevas = parseFloat(logData.millas_de_trabajo);
    
    console.log('🔍 Intentando actualizar millaje:', {
        vehicle_id: logData.vehicle_id,
        millas_nuevas: millasNuevas,
        user_id: logData.user_id
    });
    
    // Obtener millaje actual del vehículo
    const { data: vehicleData, error: fetchError } = await supabase
        .from('user_vehicles')
        .select('id, total_mileage, user_id, nickname')
        .eq('id', logData.vehicle_id)
        .eq('user_id', logData.user_id);
    
    console.log('🔍 Resultado de búsqueda:', {
        encontrados: vehicleData?.length || 0,
        vehiculo: vehicleData?.[0],
        error: fetchError?.message
    });
    
    if (!fetchError && vehicleData && vehicleData.length > 0) {
        const vehicle = vehicleData[0];
        
        // Calcular nuevo total
        const millasActuales = vehicle.total_mileage || 0;
        const nuevoTotal = millasActuales + millasNuevas;
        
        console.log(`📊 Cálculo: ${millasActuales} + ${millasNuevas} = ${nuevoTotal}`);
        
        // Actualizar millaje
        const { error: updateError } = await supabase
            .from('user_vehicles')
            .update({ total_mileage: nuevoTotal })
            .eq('id', logData.vehicle_id)
            .eq('user_id', logData.user_id);
        
        if (!updateError) {
            console.log(`✅ Millaje actualizado para ${vehicle.nickname}: ${millasActuales.toFixed(2)} + ${millasNuevas.toFixed(2)} = ${nuevoTotal.toFixed(2)} millas`);
        } else {
            console.error('⚠️ Error actualizando millaje:', updateError.message);
        }
    } else if (fetchError) {
        console.error('⚠️ Error obteniendo millaje actual:', fetchError.message);
    } else {
        console.error('⚠️ Vehículo no encontrado:', {
            vehicle_id: logData.vehicle_id,
            user_id: logData.user_id
        });
    }
}
        // 🗑️ Eliminar el bloque agendado (ya completado)
    if (logData.block_id) {
        const { error: deleteError } = await supabase
            .from('scheduled_blocks')
            .delete()
            .eq('id', logData.block_id)
            .eq('user_id', logData.user_id);
        
        if (!deleteError) {
            console.log(`🗑️ Bloque agendado ${logData.block_id} eliminado (ruta completada)`);
        } else {
            console.error('⚠️ Error eliminando bloque:', deleteError.message);
        }
    }

    res.status(200).json({ success: true, message: 'Ruta guardada en bitácora.', data: data });

} catch (error) {
    console.error('❌ Error general en /api/log-route:', error.message);
    res.status(500).json({ success: false, message: 'Error al guardar en Supabase.', error: error.message });
}
});
// --- Fin FASE 3 ---

// ============================================
// 🌤️ ENDPOINT DE CLIMA (OpenWeatherMap)
// ============================================
app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: 'City name required' });
    }

    // ✅ FORMA CORRECTA: Leer directo del entorno
    const API_KEY = process.env.OPENWEATHER_API_KEY; 

    // Validación de seguridad extra (opcional pero recomendada)
    if (!API_KEY) {
      throw new Error('Server configuration error: Missing Weather API Key');
    }
    
    // Usamos unidades imperiales (Fahrenheit, mph)
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.cod !== 200) {
      throw new Error(data.message);
    }

    // Formateamos la respuesta para que el Frontend la consuma fácil
    const formattedWeather = {
      temp: `${Math.round(data.main.temp)}°`,
      condition: data.weather[0].main, // ej: "Clouds", "Rain"
      description: data.weather[0].description, // ej: "scattered clouds"
      icon: getWeatherIcon(data.weather[0].icon), // Convertir código a emoji
      humidity: `${data.main.humidity}%`,
      wind: `${Math.round(data.wind.speed)} mph`,
      // OpenWeather Free no da probabilidad de lluvia exacta directa en el endpoint 'weather',
      // pero podemos inferir si está lloviendo por el 'condition'.
      rainChance: data.weather[0].main === 'Rain' ? 'High' : 'Low' 
    };

    res.json(formattedWeather);

  } catch (error) {
    console.error('Error fetching weather:', error);
    // En caso de error, devolvemos un clima genérico para no romper la UI
    res.json({
      temp: '--°',
      condition: 'Unavailable',
      icon: '🤷‍♂️',
      humidity: '--%',
      wind: '-- mph',
      rainChance: '--'
    });
  }
});

// Helper para convertir códigos de iconos de OpenWeather a Emojis
function getWeatherIcon(code) {
  const map = {
    '01d': '☀️', '01n': '🌙', // Clear
    '02d': '⛅', '02n': '☁️', // Few clouds
    '03d': '☁️', '03n': '☁️', // Scattered clouds
    '04d': '☁️', '04n': '☁️', // Broken clouds
    '09d': '🌧️', '09n': '🌧️', // Shower rain
    '10d': '🌦️', '10n': '🌧️', // Rain
    '11d': '⛈️', '11n': '⛈️', // Thunderstorm
    '13d': '❄️', '13n': '❄️', // Snow
    '50d': '🌫️', '50n': '🌫️'  // Mist
  };
  return map[code] || '🌤️';
}

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
// LIVE ETA CALCULATION - CON ARIA - Con DEPARTURE TIME
// ========================================
app.post('/api/calculate-live-eta', authenticateUser, async (req, res) => {
  const { routeId, currentStopNumber, customDestination } = req.body;
  
  if (!routeId || !currentStopNumber) {
    return res.status(400).json({ success: false, error: 'Falta routeId o currentStopNumber' });
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

    if (error || !route) throw new Error('Ruta no encontrada o ya finalizada');

    // 2. Determinar destino final
    let finalDestinationAddress = customDestination || 
                                  route.destination_address || 
                                  '513 Alafaya Woods Blvd Oviedo, FL'; 
    
    const destinationChanged = customDestination && customDestination.trim() !== '' && 
                               route.destination_address && 
                               customDestination.trim().toLowerCase() !== route.destination_address.toLowerCase();
    
    // 3. Desencriptar paradas
    const allStops = decryptStops(route.stops_json);
    if (!allStops) throw new Error('Error desencriptando paradas');
    
    // 4. Filtrar paradas restantes (TRABAJO)
    const remainingStops = allStops.filter(
      stop => stop.number >= currentStopNumber && stop.address
    );
    
    if (remainingStops.length === 0) {
      // Caso especial: Ya terminaste las paradas, solo queda ir a casa.
      // Podríamos manejarlo, pero por ahora devolvemos error o manejamos como viaje directo.
      return res.status(400).json({ success: false, error: 'No hay paradas restantes.' });
    }

    console.log(`   📍 Paradas de trabajo restantes: ${remainingStops.length}`);
    
    // 5. 🤖 ARIA Multiplier
    const ariaResult = await calcularMultiplierARIA(req.userId);
    console.log(`   🤖 ARIA multiplier: ${ariaResult.multiplier.toFixed(2)}`);
    
    // =================================================================================
    // 🚜 FASE 1: CÁLCULO DEL TRABAJO (Desde Parada Actual -> Última Parada)
    // =================================================================================
    
    // Extraemos solo direcciones de trabajo (SIN el destino final)
    const workPoints = remainingStops.map(s => s.address);
    let lastWorkStopAddress = workPoints.length > 0 ? workPoints[workPoints.length - 1] : null;

    if (!lastWorkStopAddress) {
       // Fallback de emergencia: Si no hay paradas de trabajo, la "última parada" es donde estás ahora.
       // (Aunque el filtro anterior ya validó que remainingStops > 0, mejor prevenir).
       lastWorkStopAddress = remainingStops[0]?.address; 
    }

    // Segmentamos si son muchas paradas (Google admite max 25 waypoints)
    const STOPS_PER_SEGMENT = 26;
    const workSegments = [];

    // Si solo queda 1 parada, no hay "ruta" de trabajo intermedia, la distancia es 0 
    // (o asumimos que estás EN esa parada y vas a entregar).
    // Para simplificar: Si hay > 1 punto, calculamos ruta.
    
    let workDriveMinutes = 0;
    let workDriveMiles = 0;

    if (workPoints.length > 1) {
        for (let i = 0; i < workPoints.length; i += (STOPS_PER_SEGMENT - 1)) {
            const segmentPoints = workPoints.slice(i, i + STOPS_PER_SEGMENT);
            if (segmentPoints.length > 1) {
                workSegments.push({
                    origin: segmentPoints[0],
                    destination: segmentPoints[segmentPoints.length - 1],
                    waypoints: segmentPoints.slice(1, -1)
                });
            }
        }

        const workPromises = workSegments.map(seg => 
            calculateLeg(seg.origin, seg.destination, seg.waypoints)
        );
        
        const workResults = await Promise.all(workPromises);

        workResults.forEach(res => {
            workDriveMiles += parseFloat(res.distance || 0);
            workDriveMinutes += parseFloat(res.duration || 0);
        });
    }

    // =================================================================================
    // ⏱️ CÁLCULO DE TIEMPOS DE SERVICIO (ARIA)
    // =================================================================================
    let aptCount = 0;
    let downtownCount = 0;
    
    remainingStops.forEach(stop => {
      if (stop.isApartment === undefined) {
        stop.isApartment = stop.address && stop.address.toUpperCase().match(/APT|UNIT|#/);
      }
      if (stop.isDowntown) downtownCount++;
      else if (stop.isApartment) aptCount++;
    });
    
    const stopCount = remainingStops.length;
    const baseStopTime = stopCount * ariaResult.multiplier;
    const extraAptTime = aptCount * 0.75;
    const extraDowntownTime = downtownCount * 3;
    const totalStopTime = baseStopTime + extraAptTime + extraDowntownTime;

    // =================================================================================
    // 🔮 FASE 2: PREDICCIÓN DE RETORNO (Última Parada -> Casa)
    // =================================================================================
    
    // 1. Calculamos cuándo vas a terminar (AHORA + Manejo Trabajo + Servicio)
    const now = new Date();
    // workDriveMinutes viene en minutos, totalStopTime en minutos
    const minutesUntilFinish = workDriveMinutes + totalStopTime;
    
    // Timestamp en segundos para Google
    const departureTimestamp = Math.floor(now.getTime() / 1000) + Math.round(minutesUntilFinish * 60);
    
    const predictedExitTime = new Date(departureTimestamp * 1000);
    console.log(`🔮 Predicción: Terminarás en la última parada a las ${predictedExitTime.toLocaleTimeString()}`);

// 2. Calculamos el retorno con tráfico futuro
    let returnLeg = { duration: 0, distance: 0 }; // Valor por defecto

    if (lastWorkStopAddress) {
        // Solo llamamos si tenemos una dirección de salida válida
        returnLeg = await calculateLeg(lastWorkStopAddress, finalDestinationAddress, [], departureTimestamp);
    } else {
        console.error("⚠️ No se pudo determinar lastWorkStopAddress para el retorno.");
    }
    
    const returnMinutes = parseFloat(returnLeg.duration || 0);
    const returnMiles = parseFloat(returnLeg.distance || 0);

    console.log(`✅ Tráfico de retorno calculado: ${returnMinutes} min (${returnMiles} mi)`);

    // =================================================================================
    // 📊 TOTALES Y RESPUESTA
    // =================================================================================
    
    const totalGoogleDuration = workDriveMinutes + returnMinutes; // Solo manejo
    const totalDistance = workDriveMiles + returnMiles;
    const totalNormalMinutes = totalGoogleDuration + totalStopTime; // Manejo + Servicio

    // Cálculos Luxon para ETAs
    const nowEST = DateTime.now().setZone('America/New_York');
    
    const optimisticMultiplier = ariaResult.multiplier * 0.44;
    const pessimisticMultiplier = ariaResult.multiplier * 1.39;
    
    const optimisticStopTime = stopCount * optimisticMultiplier + extraAptTime + extraDowntownTime;
    const pessimisticStopTime = stopCount * pessimisticMultiplier + extraAptTime + extraDowntownTime;

    const etaOptimistic = nowEST.plus({ minutes: totalGoogleDuration + optimisticStopTime });
    const etaNormal = nowEST.plus({ minutes: totalNormalMinutes });
    const etaPessimistic = nowEST.plus({ minutes: totalGoogleDuration + pessimisticStopTime });

    res.json({
      success: true,
      remainingStops: stopCount,
      remainingMiles: totalDistance.toFixed(2),
      remainingMinutes: Math.round(totalNormalMinutes),
      destinationChanged: destinationChanged,
      destinationUsed: finalDestinationAddress,
      aria: {
        multiplier: ariaResult.multiplier,
        rutasAnalizadas: ariaResult.rutasAnalizadas,
        ajuste: ariaResult.ajuste
      },
      breakdown: {
        googleTime: Math.round(totalGoogleDuration),
        baseStopTime: Math.round(baseStopTime),
        apartmentCount: aptCount,
        apartmentTime: Math.round(extraAptTime),
        downtownCount: downtownCount,
        downtownTime: Math.round(extraDowntownTime),
        totalStopTime: Math.round(totalStopTime),
        // Datos extra tácticos por si los quieres mostrar
        workDriveTime: Math.round(workDriveMinutes),
        returnDriveTime: Math.round(returnMinutes)
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📊 ENDPOINT: NERD STATS
app.get('/api/driver-stats/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const dateStr = sixWeeksAgo.toISOString().split('T')[0];

    const { data: routes, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 0)
      .order('fecha', { ascending: false }); // Ordenar por fecha descendente

    if (error) throw error;

    if (!routes || routes.length === 0) {
      return res.json({ empty: true });
    }

    // --- 1. CITY FIX (Ignorar N/A) ---
    const cityCounts = {};
    routes.forEach(r => {
      // Solo contamos si tiene valor y no es N/A
      if (r.primary_city && r.primary_city !== 'N/A') {
        const city = r.primary_city;
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });
    
    // Ordenar
    const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
    const favCity = sortedCities.length > 0 ? sortedCities[0][0] : 'Pending...';

    // --- 2. WAREHOUSE (Igual) ---
    const whCounts = {};
    routes.forEach(r => {
      const wh = r.warehouse || 'Unknown';
      whCounts[wh] = (whCounts[wh] || 0) + 1;
    });
    const favWh = Object.entries(whCounts).sort((a, b) => b[1] - a[1])[0];

    // --- 3. PROMEDIOS LIFETIME ---
    const totalMilesLifetime = routes.reduce((sum, r) => sum + (parseFloat(r.millas_totales) || 0), 0);
    const avgMilesBlock = (totalMilesLifetime / routes.length).toFixed(1);

    // --- 4. DATA RECIENTE (6 SEMANAS) ---
    const recentRoutes = routes.filter(r => r.fecha >= dateStr);

    const stats6Weeks = {
      totalMoney: 0,
      totalMiles: 0,
      workMiles: 0,
      totalHours: 0,
      routeCount: recentRoutes.length
    };

    // --- 5. AGRUPAR POR SEMANA (NUEVO) ---
    const weeklyMap = {};

    recentRoutes.forEach(r => {
      const pay = parseFloat(r.pago) || 0;
      const miles = parseFloat(r.millas_totales) || 0;
      const wMiles = parseFloat(r.millas_de_trabajo) || 0;
      const hours = parseFloat(r.duracion_horas) || 0; // Horas pagadas
      
      // Acumuladores Globales
      stats6Weeks.totalMoney += pay;
      stats6Weeks.totalMiles += miles;
      stats6Weeks.workMiles += wMiles;
      stats6Weeks.totalHours += hours;

      // Lógica de Semana (Lunes de esa semana)
      const d = new Date(r.fecha);
      const day = d.getDay();
      const diff = d.getDate() - day + (day == 0 ? -6 : 1); // Ajustar al Lunes
      const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];

      if (!weeklyMap[monday]) {
        weeklyMap[monday] = { 
          weekStart: monday, 
          money: 0, 
          miles: 0, 
          hours: 0, 
          count: 0 
        };
      }
      
      weeklyMap[monday].money += pay;
      weeklyMap[monday].miles += miles;
      weeklyMap[monday].hours += hours;
      weeklyMap[monday].count += 1;
    });

    // Convertir mapa a array ordenado
    const weeklyHistory = Object.values(weeklyMap)
      .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart))
      .map(w => ({
        ...w,
        money: w.money.toFixed(0),
        miles: w.miles.toFixed(0),
        hours: w.hours.toFixed(1),
        hourly: w.hours > 0 ? (w.money / w.hours).toFixed(2) : '0.00'
      }));

    // Cálculos finales globales
    const dollarsPerMile = stats6Weeks.totalMiles > 0 
      ? (stats6Weeks.totalMoney / stats6Weeks.totalMiles).toFixed(2) 
      : 0;
    
    const realHourly = stats6Weeks.totalHours > 0
      ? (stats6Weeks.totalMoney / stats6Weeks.totalHours).toFixed(2)
      : 0;

    res.json({
      empty: false,
      lifetime: {
        favCity, // Ya corregido
        favWh: favWh ? favWh[0] : 'N/A',
        avgMilesBlock,
        totalRoutes: routes.length
      },
      recent: {
        money: stats6Weeks.totalMoney.toFixed(2),
        miles: stats6Weeks.totalMiles.toFixed(1),
        workMiles: stats6Weeks.workMiles.toFixed(1),
        hours: stats6Weeks.totalHours.toFixed(1),
        dollarsPerMile,
        realHourly,
        count: stats6Weeks.routeCount
      },
      history: weeklyHistory // 👈 Enviamos la lista semanal
    });

  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({ error: error.message });
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


// ═══════════════════════════════════════════════════════════════
// 🔍 ENDPOINT 1: OCR INICIAL (Imágenes → JSON + Dudas)
// ═══════════════════════════════════════════════════════════════
app.post('/api/v1/ocr/amazon-stops', 
  authenticateUser, 
  upload.array('images', 7), 
  async (req, res) => {
    try {
      console.log('📸 Recibiendo imágenes para OCR...');
      
      // 1. Validar que hay imágenes
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se recibieron imágenes. Debes subir entre 1 y 7 archivos.'
        });
      }

      // Calcular tamaño total recibido
      const totalReceivedSize = req.files.reduce((sum, file) => sum + file.size, 0);
      const receivedMB = (totalReceivedSize / (1024 * 1024)).toFixed(2);

      console.log(`📦 ${req.files.length} imagen(es) recibida(s) • ${receivedMB} MB total`);

      // Log individual de cada imagen
      req.files.forEach((file, index) => {
        const sizeKB = (file.size / 1024).toFixed(1);
        console.log(`   ${index + 1}. ${file.originalname} - ${sizeKB} KB`);
      });


      // 2. Preparar imágenes para Gemini
      const imageParts = req.files.map(file => ({
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: file.mimetype
        }
      }));

      // 3. Preparar el modelo con JSON Schema
      const model = genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stop_number: { type: 'integer' },
                street_address: { type: 'string' },
                apartment: { type: 'string' },
                city: { type: 'string' },
                ia_suggestion: { type: 'integer' },
                confidence: { type: 'number' }
              },
              required: ['stop_number', 'street_address', 'apartment', 'city', 'ia_suggestion', 'confidence']
            }
          }
        }
      });

      // 4. Prompt v3 (Primera Pasada)
      const promptV3 = `Eres FlexPilot Core, una IA experta en logística de última milla y OCR de alta precisión.

      CONTEXTO:
      - Recibirás capturas de pantalla de la app Amazon Flex que muestran una lista de paradas numeradas.
      - La parada 1 siempre es el warehouse y debe ignorarse.
      - El objetivo es extraer una lista estructurada de paradas a partir de esas imágenes.

      OBJETIVO:
      - Extraer TODAS las paradas a partir de la parada 2, con la máxima precisión posible.
      - No interactúas directamente con el usuario. Solo devuelves datos estructurados.
      - Las dudas o posibles problemas se indicarán a través de un campo de "confidence" bajo, nunca con preguntas de texto.

      REGLAS DE COMPORTAMIENTO (CRÍTICAS):
      1. IGNORA SIEMPRE LA PARADA 1 (WAREHOUSE). El primer elemento de la salida debe ser la parada 2.

      2. TODO el texto de salida debe ir en MAYÚSCULAS (direcciones, ciudad, apartamento).

      3. SEPARACIÓN CORRECTA DE CAMPOS (MUY IMPORTANTE):
        - "street_address": SOLO el número y nombre de la calle (ej: "1652 CELEBRATION BLVD")
        - "apartment": CUALQUIER indicador de apartamento/unidad que veas, INCLUSO SI ESTÁ TRUNCADO O VIENE SIN DESIGNADOR.

        3.1 REGLA DE CORTE POR DESIGNADOR (OBLIGATORIA):
        - Si en el texto visible aparece cualquier token de unidad/apartamento (APT, UNIT, STE, SUITE, #, BLDG, BUILDING, APARTMENT),
          entonces:
          - TODO lo que siga a ese token pertenece a "apartment" (aunque venga en la misma línea).
          - "street_address" debe quedarse únicamente con número + calle.
        - NUNCA pongas apartamentos/unidades en el campo "street_address", aunque estén truncados o pegados en la misma línea.

        Ejemplos:
        - Texto: "1652 CELEBRATION BLVD UNIT 4-416"
          street_address: "1652 CELEBRATION BLVD"
          apartment: "UNIT 4-416"
        - Texto: "1652 CELEBRATION BLVD UNIT ..."
          street_address: "1652 CELEBRATION BLVD"
          apartment: "UNIT ..."
        - Texto: "3005 PRADO TER #305"
          street_address: "3005 PRADO TER"
          apartment: "#305"
        - Nada visible
          apartment: ""

        3.2 REGLA DE APARTAMENTO SIN DESIGNADOR (CASO REAL):
        - A veces la dirección aparece como:
          "1652 CELEBRATION BLVD B CELEBRATION"
          o
          "1652 CELEBRATION BLVD 1013 CELEBRATION"
        - En estos casos, si hay un token adicional ENTRE la calle y la ciudad:
          - Si ese token es un número (ej: "1013", "1310"), colócalo en "apartment".
          - Si ese token es una sola letra (ej: "B"), colócalo en "apartment".
        - No inventes designadores: devuelve "B" como "B" (NO "UNIT B", NO "APT B").

        EXCEPCIÓN DE SEGURIDAD (NO ADIVINAR):
        - Si el token suelto parece un direccional de calle: N, S, E, W, NE, NW, SE, SW
          entonces NO lo trates como apartment; mantenlo como parte de "street_address".
          Si no estás seguro, baja el "confidence".

      4. TOLERANCIA CERO A ADIVINAR DIRECCIONES:
        - Si una dirección tiene "..." o se ve cortada en la captura, NO completes lo que no se ve.
        - Incluye solo el texto visible y baja el "confidence" para esa parada.

      5. DEDUCCIÓN INTELIGENTE DE "stop_number" CUANDO EL OCR FALLA:
        - El número de la parada aparece dentro de un círculo oscuro y a veces el OCR lo convierte en un "garabato" ilegible.
        - En esos casos, DEBES usar el contexto y la secuencia para inferir el número de parada:
          - Si acabas de procesar la parada 4 y luego hay un nuevo bloque de dirección/apartamento/ciudad para la siguiente parada,
            pero el número aparece ilegible, esa nueva parada es la número 5.
          - Asume que las paradas aumentan 1 en 1 (2,3,4,5,...) si los bloques son claros.
        - Esta inferencia SOLO aplica al "stop_number". No la uses para inventar texto de direcciones.

      6. NO HAGAS PREGUNTAS ni asumas conversación. Esta llamada es de una sola pasada.

      7. El campo "ia_suggestion" SIEMPRE debe ser igual a "stop_number" en esta fase (MODO PASIVO).

      8. Si no puedes ver claramente un campo:
        - "street_address": incluye solo número + calle visible.
        - "apartment": incluye lo que veas (aunque sea truncado "APT ...", "UNIT ...") o "" si no hay nada.
        - "city": si no es visible, usar cadena vacía "" y baja "confidence".

      MODO DE OPERACIÓN:
      - MODO PASIVO: Asume SIEMPRE modo pasivo en esta fase. No optimices ni reordenes la ruta.
      - La lista de salida debe respetar el orden original de Amazon Flex (2, 3, 4, ...).

      SALIDA OBLIGATORIA:
      - Devuelve ÚNICAMENTE un JSON válido (sin texto extra) con objetos de esta forma:
      [
        {
          "stop_number": 2,
          "street_address": "1652 CELEBRATION BLVD",
          "apartment": "UNIT ...",
          "city": "CELEBRATION",
          "ia_suggestion": 2,
          "confidence": 0.8
        }
      ]

      FORMATO:
      - No incluyas comentarios, textos adicionales ni explicación fuera del JSON.
      - No incluyas la parada 1 (warehouse) en el JSON.
      - El JSON debe ser un array de objetos sin texto antes ni después.`;


      // 5. Llamar a Gemini con retry logic
      console.log('🤖 Enviando a Gemini...');
      let result;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Intento ${attempts}/${maxAttempts}...`);
          result = await model.generateContent([promptV3, ...imageParts]);
          break; // Éxito, salir del loop
        } catch (error) {
          console.error(`❌ Intento ${attempts} falló:`, error.message);
          
          if (attempts >= maxAttempts) {
            throw new Error(`Gemini falló después de ${maxAttempts} intentos: ${error.message}`);
          }
          
          const waitTime = attempts * 2000;
          console.log(`⏳ Esperando ${waitTime/1000}s antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      const response = await result.response;
      const text = response.text();

      console.log('✅ Respuesta de Gemini recibida');

      // 🔍 DEBUG: Ver JSON crudo de Gemini
      console.log('\n🔍 ===== JSON CRUDO DE GEMINI (primeros 1000 chars) =====');
      console.log(text.substring(0, 1000));
      console.log('...\n');

      // 6. Parsear JSON
      let stops;
      try {
        stops = JSON.parse(text);
        
        // 🔍 DEBUG: Mostrar paradas 10-13 tal como las devolvió Gemini
        console.log('🔍 ===== PARADAS 10-13 (GEMINI ORIGINAL) =====');
        if (stops.length >= 13) {
          stops.slice(9, 13).forEach(stop => {
            console.log(`Parada ${stop.stop_number}:`);
            console.log(`  street_address: "${stop.street_address}"`);
            console.log(`  apartment: "${stop.apartment || ''}"`);
            console.log(`  city: "${stop.city}"`);
            console.log(`  confidence: ${stop.confidence}`);
          });
        }
        console.log('');
        
      } catch (parseError) {
        console.error('❌ Error parseando respuesta de Gemini:', text);
        return res.status(500).json({
          success: false,
          error: 'Gemini devolvió una respuesta inválida',
          raw: text
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // 7. AUTO-COMPLETADO INTELIGENTE
      // ═══════════════════════════════════════════════════════════════

      // Auto-completar apartamentos truncados (ya vienen en el campo correcto gracias al prompt)
      stops.forEach(stop => {
        if (stop.apartment && stop.apartment.includes('...')) {
          let autoCompleted = '';
          
          // Detectar el tipo y auto-completar
          if (stop.apartment.toUpperCase().includes('APT')) {
            autoCompleted = 'APT 101';
          } else if (stop.apartment.toUpperCase().includes('UNIT')) {
            autoCompleted = 'UNIT 101';
          } else if (stop.apartment.toUpperCase().includes('BLDG') || stop.apartment.toUpperCase().includes('BUILDING')) {
            autoCompleted = 'BLDG 1';
          } else if (stop.apartment.includes('#')) {
            autoCompleted = '#101';
          } else if (stop.apartment.toUpperCase().includes('STE') || stop.apartment.toUpperCase().includes('SUITE')) {
            autoCompleted = 'STE 101';
          } else {
            // Fallback genérico
            autoCompleted = 'APT 101';
          }
          
          console.log(`🏢 Auto-completando apartamento en parada ${stop.stop_number}: "${stop.apartment}" → "${autoCompleted}"`);
          stop.apartment = autoCompleted;
          stop.confidence = 0.95;
        }
      });

      // Subir confidence si ya no hay truncados
      stops.forEach(stop => {
        const hasEllipsis = 
          stop.street_address.includes('...') || 
          (stop.apartment && stop.apartment.includes('...'));
        
        if (!hasEllipsis && stop.confidence < 0.90) {
          console.log(`✨ Subiendo confidence de parada ${stop.stop_number}: ${stop.confidence} → 0.95`);
          stop.confidence = 0.95;
        }
      });


      // 🔍 DEBUG: Mostrar paradas 10-13 DESPUÉS del auto-completado
      console.log('🔍 ===== PARADAS 10-13 (POST AUTO-COMPLETADO) =====');
      if (stops.length >= 13) {
        stops.slice(9, 13).forEach(stop => {
          console.log(`Parada ${stop.stop_number}:`);
          console.log(`  street_address: "${stop.street_address}"`);
          console.log(`  apartment: "${stop.apartment || ''}"`);
          console.log(`  city: "${stop.city}"`);
          console.log(`  confidence: ${stop.confidence}`);
        });
      }
      console.log('');

      // ═══════════════════════════════════════════════════════════════
      // 8. CALCULAR NEEDS_CONFIRMATION (DESPUÉS) 
      // ═══════════════════════════════════════════════════════════════
      const needs_confirmation = [];

      stops.forEach(stop => {
        // Dirección truncada o muy corta o confidence bajo
        if (stop.street_address.length < 10 || 
            stop.street_address.includes('...') || 
            stop.confidence < 0.85) {
          needs_confirmation.push({
            stop_number: stop.stop_number,
            field: 'street_address',
            reason: stop.street_address.includes('...') ? 'TRUNCATED_TEXT' : 'LOW_CONFIDENCE',
            current_value: stop.street_address,
            confidence: stop.confidence
          });
        }
        
        // Apartamento truncado
        if (stop.apartment && stop.apartment.includes('...')) {
          needs_confirmation.push({
            stop_number: stop.stop_number,
            field: 'apartment',
            reason: 'TRUNCATED_TEXT',
            current_value: stop.apartment,
            confidence: stop.confidence
          });
        }
        
        // Ciudad vacía
        if (!stop.city || stop.city.trim() === '') {
          needs_confirmation.push({
            stop_number: stop.stop_number,
            field: 'city',
            reason: 'MISSING_CITY',
            current_value: '',
            confidence: stop.confidence
          });
        }
      });

      console.log(`📊 ${stops.length} paradas extraídas, ${needs_confirmation.length} con dudas reales\n`);

      // 9. Responder
      res.json({
        success: true,
        stops,
        needs_confirmation
      });

    } catch (error) {
      console.error('❌ Error en OCR:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

console.log('🔍 Endpoint OCR (Primera Pasada) configurado');


// ═══════════════════════════════════════════════════════════════
// ✏️ ENDPOINT 2: RESOLVER DUDAS (Correcciones → JSON Final)
// ═══════════════════════════════════════════════════════════════
app.post('/api/v1/ocr/amazon-stops/resolve-missing', 
  authenticateUser, 
  async (req, res) => {
    try {
      console.log('✏️ Recibiendo correcciones del usuario...');
      
      const { stops, corrections } = req.body;

      // 1. Validaciones
      if (!stops || !Array.isArray(stops)) {
        return res.status(400).json({
          success: false,
          error: 'Falta el array de "stops"'
        });
      }

      if (!corrections || !Array.isArray(corrections)) {
        return res.status(400).json({
          success: false,
          error: 'Falta el array de "corrections"'
        });
      }

      console.log(`📝 ${corrections.length} corrección(es) recibida(s)`);

      // 2. Preparar contexto para Gemini
      const contextData = {
        stops: stops,
        corrections: corrections
      };

      // 3. Preparar modelo con JSON Schema
      const model = genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stop_number: { type: 'integer' },
                street_address: { type: 'string' },
                apartment: { type: 'string' },
                city: { type: 'string' },
                ia_suggestion: { type: 'integer' },
                confidence: { type: 'number' }
              },
              required: ['stop_number', 'street_address', 'apartment', 'city', 'ia_suggestion', 'confidence']
            }
          }
        }
      });

      // 4. Prompt v3 (Segunda Pasada)
      const promptV3Corrections = `Eres FlexPilot Core, una IA experta en logística de última milla y normalización de direcciones.

CONTEXTO:
- Ya se ejecutó una primera extracción OCR sobre capturas de Amazon Flex.
- Ahora recibes:
  - una lista de paradas parcialmente procesadas (con posibles campos incompletos),
  - y una lista de correcciones textuales proporcionadas por el usuario.
- Tu tarea es aplicar esas correcciones para generar una versión FINAL y CONSISTENTE de todas las paradas.

OBJETIVO:
- Corregir y completar las paradas usando SOLO la información que realmente tengas:
  - El JSON parcial de paradas.
  - Las correcciones textuales del usuario (por ejemplo, direcciones completas copiadas desde la app de Flex).
- Producir un JSON final listo para uso en producción, manteniendo el mismo contrato de salida.
- No hacer preguntas ni abrir interacción.

REGLAS DE COMPORTAMIENTO:
1. NO INVENTES DATOS:
   - Si a pesar de las correcciones algún campo sigue siendo ambiguo, deja lo que tenías y ajusta "confidence" acorde.
2. MAYÚSCULAS:
   - Convierte todos los textos de salida ("street_address", "apartment", "city") a MAYÚSCULAS.
3. LÓGICA DE CAMPO "ia_suggestion":
   - En esta fase TODO sigue en MODO PASIVO.
   - "ia_suggestion" debe ser SIEMPRE igual a "stop_number".
4. PRESERVA LA ESTRUCTURA Y EL ORDEN:
   - Debes mantener la misma cantidad de paradas.
   - Los "stop_number" deben seguir siendo los mismos (2, 3, 4, ...) que venían en la entrada.
5. USO DE CORRECCIONES:
   - Las correcciones del usuario suelen ser direcciones completas, por ejemplo:
     "1234 FULL ADDRESS AVE APT 202, KISSIMMEE".
   - Debes:
     - actualizar "street_address" usando la parte de calle y número,
     - extraer "apartment" si ves unidad (APT, UNIT, #, etc.),
     - actualizar "city" si es visible,
     - ajustar "confidence" hacia arriba si la información se vuelve clara.

ENTRADA:
${JSON.stringify(contextData, null, 2)}

SALIDA OBLIGATORIA:
- Devuelve ÚNICAMENTE un JSON válido con el siguiente contrato (array de objetos).

DEFINICIÓN DE CAMPOS:
- "stop_number": entero, igual al original.
- "street_address": texto de calle + número ya corregido.
- "apartment": unidad de apartamento si aplica, o "".
- "city": ciudad inferida a partir de los datos visibles y las correcciones.
- "ia_suggestion": SIEMPRE igual a "stop_number".
- "confidence": 0.0 a 1.0 según tu seguridad tras aplicar las correcciones.

FORMATO:
- No incluyas texto, explicación ni comentarios antes o después del JSON.
- Devuelve solo el array JSON.`;

      // 5. Llamar a Gemini
      console.log('🤖 Enviando correcciones a Gemini...');
      const result = await model.generateContent(promptV3Corrections);
      const response = await result.response;
      const text = response.text();

      console.log('✅ Respuesta de correcciones recibida');

      // 6. Parsear JSON
      let finalStops;
      try {
        finalStops = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ Error parseando respuesta de correcciones:', text);
        return res.status(500).json({
          success: false,
          error: 'Gemini devolvió una respuesta inválida',
          raw: text
        });
      }

      // 7. Validar que mantiene la misma cantidad de paradas
      if (finalStops.length !== stops.length) {
        console.warn(`⚠️ Advertencia: Cantidad de paradas cambió (${stops.length} → ${finalStops.length})`);
      }

      console.log(`✅ ${finalStops.length} paradas finalizadas con correcciones aplicadas`);

      // 8. Responder
      res.json({
        success: true,
        stops: finalStops
      });

    } catch (error) {
      console.error('❌ Error en correcciones:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
});

console.log('✏️ Endpoint OCR (Correcciones) configurado');


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

// Tax Report PDF (con desglose por vehículo)
app.get('/api/tax-report/:userId', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  const { year } = req.query;
  
  if (userId !== req.userId) {
    return res.status(403).json({ success: false, error: 'No tienes permiso' });
  }

  try {
    const taxYear = year || '2025';
    const IRS_MILEAGE_RATE = 0.70; // IRS 2025 rate
    
    // 1. Query para total income
    const { data: routesData, error: routesError } = await supabase
      .from('routes')
      .select('pago')
      .eq('user_id', userId)
      .gte('fecha', `${taxYear}-01-01`)
      .lte('fecha', `${taxYear}-12-31`);
    
    if (routesError) throw routesError;
    
    const totalIncome = routesData.reduce((sum, r) => sum + (r.pago || 0), 0);
    
    // 2. Query para millas por vehículo (con JOIN)
    const { data: vehicleData, error: vehicleError } = await supabase
      .from('routes')
      .select(`
        vehicle_id,
        millas_de_trabajo,
        user_vehicles (
          marca,
          modelo,
          year
        )
      `)
      .eq('user_id', userId)
      .gte('fecha', `${taxYear}-01-01`)
      .lte('fecha', `${taxYear}-12-31`)
      .not('vehicle_id', 'is', null);
    
    if (vehicleError) throw vehicleError;
    
    // 3. Agrupar millas por vehículo
    const vehicleMap = {};
    vehicleData.forEach(route => {
      const vId = route.vehicle_id;
      if (!vehicleMap[vId]) {
        const vInfo = route.user_vehicles || {};
        vehicleMap[vId] = {
          name: `${vInfo.year || ''} ${vInfo.marca || ''} ${vInfo.modelo || ''}`.trim() || 'Unknown Vehicle',
          miles: 0
        };
      }
      vehicleMap[vId].miles += (route.millas_de_trabajo || 0);
    });
    
    const vehicles = Object.values(vehicleMap);
    const totalMiles = vehicles.reduce((sum, v) => sum + v.miles, 0);
    const mileageDeduction = totalMiles * IRS_MILEAGE_RATE;
    const otherExpenses = 0.00;
    const totalDeductions = mileageDeduction + otherExpenses;
    
    // 4. Generar PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=FlexPilot_Tax_Report_${taxYear}.pdf`);
    
    doc.pipe(res);
    
    // --- HEADER ---
    doc.fontSize(24).font('Helvetica-Bold').text('Tax Summary', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text(
      `Jan 01 ${taxYear} - Dec 31 ${taxYear}`,
      { align: 'center' }
    );
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666').text(
      'Give this form to your tax preparer or use it while filing your taxes.',
      { align: 'center' }
    );
    doc.moveDown(2);
    
    // --- INCOME SECTION ---
    doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('Income');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Income`, 50, doc.y, { continued: true });
    doc.text(`$${totalIncome.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);
    
    // --- DEDUCTIONS SECTION ---
    doc.fontSize(16).font('Helvetica-Bold').text('Deductions');
    doc.moveDown(0.5);
    
    // Table header
    doc.fontSize(11).font('Helvetica-Bold');
    const tableTop = doc.y;
    doc.text('Expense Category', 50, tableTop);
    doc.text('Miles', 300, tableTop);
    doc.text('Deductible', 450, tableTop);
    doc.moveDown(0.3);
    
    // Separator line
    doc.strokeColor('#ddd').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    
    // Deductible Mileage - BY VEHICLE
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Deductible Mileage', 50, doc.y);
    doc.moveDown(0.3);
    
    doc.font('Helvetica').fontSize(10);
    vehicles.forEach(vehicle => {
      const vY = doc.y;
      const vehicleDeduction = vehicle.miles * IRS_MILEAGE_RATE;
      doc.fillColor('#333').text(`  • ${vehicle.name}`, 50, vY);
      doc.fillColor('#000').text(`${vehicle.miles.toFixed(2)} mi`, 300, vY);
      doc.text(`$${vehicleDeduction.toFixed(2)}`, 450, vY);
      doc.moveDown(0.5);
    });
    
    // Subtotal mileage
    doc.strokeColor('#ddd').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    const subtotalY = doc.y;
    doc.text('Total Mileage', 50, subtotalY);
    doc.text(`${totalMiles.toFixed(2)} mi`, 300, subtotalY);
    doc.text(`$${mileageDeduction.toFixed(2)}`, 450, subtotalY);
    doc.moveDown(1.5);
    
    // Other Expenses
    doc.font('Helvetica-Bold');
    doc.text('Other Expenses', 50, doc.y);
    doc.moveDown(0.5);
    
    doc.font('Helvetica');
    const otherY = doc.y;
    doc.text('Tolls', 50, otherY);
    doc.text(`$${otherExpenses.toFixed(2)}`, 300, otherY);
    doc.text(`$${otherExpenses.toFixed(2)}`, 450, otherY);
    doc.moveDown(2);
    
    // TOTAL DEDUCTIONS
    doc.strokeColor('#000').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.8);
    
    doc.fontSize(14).font('Helvetica-Bold');
    const totalY = doc.y;
    doc.text('Total Tax Deductions', 50, totalY);
    doc.text(`$${totalDeductions.toFixed(2)}`, 450, totalY);
    doc.moveDown(3);
    
    // --- FOOTER ---
    doc.fontSize(9).font('Helvetica').fillColor('#666');
    doc.text('Generated by FlexPilot', { align: 'center' });
    doc.text(new Date().toLocaleDateString('en-US'), { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(8).text(
      'FlexPilot is not responsible for the accuracy of deductions. We recommend consulting with a tax professional.',
      { align: 'center', width: 500 }
    );
    
    doc.end();
    
    console.log(`✅ Tax report generado para user ${userId}, año ${taxYear}, ${vehicles.length} vehículos`);
    
  } catch (error) {
    console.error('❌ Error generando tax report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

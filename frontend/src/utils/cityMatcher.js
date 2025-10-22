// frontend/src/utils/cityMatcher.js

import stringSimilarity from 'string-similarity';
import { KNOWN_CITIES } from '../constants/cities.js';

/**
 * Normaliza texto corrigiendo abreviaturas y caracteres comunes del OCR.
 */
function normalizeText(text) {
  if (!text) return '';

  let t = text.toUpperCase().trim();

  // Correcciones comunes del OCR
  t = t.replaceAll('0', 'O');
  t = t.replaceAll('1', 'I');
  t = t.replaceAll('5', 'S');
  t = t.replaceAll('8', 'B');
  t = t.replace(/\s+/g, ' '); // elimina espacios extra

  // Abreviaturas comunes de direcciones
  const replacements = {
    'ST. ': 'SAINT ',
    'ST ': 'SAINT ',
    'MT. ': 'MOUNT ',
    'MT ': 'MOUNT ',
    'FT. ': 'FORT ',
    'FT ': 'FORT ',
    'W. ': 'WEST ',
    'E. ': 'EAST ',
    'N. ': 'NORTH ',
    'S. ': 'SOUTH ',
  };

  for (const [abbr, full] of Object.entries(replacements)) {
    t = t.replaceAll(abbr, full);
  }

  return t.trim();
}

/**
 * Devuelve la ciudad más probable según una cadena OCR,
 * corrigiendo abreviaturas y errores comunes.
 *
 * @param {string} text - Texto detectado por OCR (ej: "Mt Dora")
 * @param {number} [threshold=0.6] - Nivel mínimo de coincidencia (0–1)
 * @returns {string|null} Ciudad corregida o null si no hay match fuerte
 */
export function matchCity(text, threshold = 0.6) { // Ajustado a 0.6 para ser más flexible
  if (!text) return null;

  const normalized = normalizeText(text);
  if (!normalized) return null;

  const { bestMatch } = stringSimilarity.findBestMatch(normalized, KNOWN_CITIES);

  if (bestMatch.rating >= threshold) {
    return bestMatch.target; // Ej: "MOUNT DORA"
  }

  return null;
}
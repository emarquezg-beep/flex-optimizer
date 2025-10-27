// ============================================
// SCORING SYSTEM V5 - AMAZON FLEX ROUTES
// ============================================

const WEIGHTS_V5 = {
  pago_real_hora: 0.22,
  pago_x_milla: 0.18,
  eficiencia_tiempo: 0.10,
  commute_2: 0.12,
  first_stop: 0.08,
  millas_hora: 0.08,
  esfuerzo_fisico: 0.08,
  horario: 0.06,
  ciudad: 0.06,
  commute_1: 0.02
};

const CITY_SCORES = {
  'ORLANDO DOWNTOWN': 20,
  'DOWNTOWN ORLANDO': 20,
  'ORLANDO': 70,
  'MAITLAND': 40,
  'DELTONA': 50,
  'KISSIMMEE': 45,
  'POINCIANA': 35,
  'DAVENPORT': 40,
  'OVIEDO': 100,
  'WINTER PARK': 85,
  'LAKE MARY': 90,
  'SANFORD': 75,
  'APOPKA': 80
};

// Helper: Linear Interpolation
function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// Scoring Functions
function scorePagoRealHora(pagoRealHora) {
  if (pagoRealHora >= 30) return 100;
  if (pagoRealHora >= 25) return lerp(90, 100, (pagoRealHora - 25) / 5);
  if (pagoRealHora >= 20) return lerp(75, 90, (pagoRealHora - 20) / 5);
  if (pagoRealHora >= 18) return lerp(60, 75, (pagoRealHora - 18) / 2);
  if (pagoRealHora >= 15) return lerp(40, 60, (pagoRealHora - 15) / 3);
  return 30;
}

function scorePagoPorMilla(pagoPorMilla) {
  if (pagoPorMilla >= 1.30) return 100;
  if (pagoPorMilla >= 1.00) return lerp(90, 100, (pagoPorMilla - 1.00) / 0.30);
  if (pagoPorMilla >= 0.80) return lerp(75, 90, (pagoPorMilla - 0.80) / 0.20);
  if (pagoPorMilla >= 0.60) return lerp(50, 75, (pagoPorMilla - 0.60) / 0.20);
  if (pagoPorMilla >= 0.50) return lerp(35, 50, (pagoPorMilla - 0.50) / 0.10);
  return 30;
}

function scoreEficienciaTiempo(tiempoReal, duracionBloque) {
  const ratio = tiempoReal / duracionBloque;
  
  if (ratio <= 0.85) return 100;
  if (ratio <= 0.90) return lerp(95, 100, (0.90 - ratio) / 0.05);
  if (ratio <= 0.95) return lerp(90, 95, (0.95 - ratio) / 0.05);
  if (ratio <= 1.00) return lerp(85, 90, (1.00 - ratio) / 0.05);
  if (ratio <= 1.10) return lerp(75, 85, (1.10 - ratio) / 0.10);
  if (ratio <= 1.20) return lerp(60, 75, (1.20 - ratio) / 0.10);
  if (ratio <= 1.30) return lerp(45, 60, (1.30 - ratio) / 0.10);
  if (ratio <= 1.40) return lerp(35, 45, (1.40 - ratio) / 0.10);
  
  return 30;
}

function scoreCommute2(millas) {
  if (millas <= 5) return 100;
  if (millas <= 10) return lerp(95, 100, (10 - millas) / 5);
  if (millas <= 20) return lerp(85, 95, (20 - millas) / 10);
  if (millas <= 30) return lerp(70, 85, (30 - millas) / 10);
  if (millas <= 40) return lerp(55, 70, (40 - millas) / 10);
  if (millas <= 50) return lerp(45, 55, (50 - millas) / 10);
  return 40;
}

function scoreFirstStop(firstStop, duracionHoras) {
  const esperado = duracionHoras * 11;
  const ratio = firstStop / esperado;
  
  if (ratio <= 0.50) return 100;
  if (ratio <= 0.75) return lerp(90, 100, (0.75 - ratio) / 0.25);
  if (ratio <= 0.90) return lerp(80, 90, (0.90 - ratio) / 0.15);
  if (ratio <= 1.00) return lerp(70, 80, (1.00 - ratio) / 0.10);
  if (ratio <= 1.10) return lerp(50, 70, (1.10 - ratio) / 0.10);
  if (ratio <= 1.25) return lerp(30, 50, (1.25 - ratio) / 0.15);
  return 20;
}

function scoreMillasHora(millasHora) {
  if (millasHora < 9) return 100;
  if (millasHora <= 10.5) return lerp(90, 100, (10.5 - millasHora) / 1.5);
  if (millasHora <= 12) return lerp(80, 90, (12 - millasHora) / 1.5);
  if (millasHora <= 14) return lerp(65, 80, (14 - millasHora) / 2);
  if (millasHora <= 16) return lerp(50, 65, (16 - millasHora) / 2);
  return 45;
}

function scoreEsfuerzoFisico(stops, tipoMayoritario = 'casa') {
  let score = 100;
  
  if (stops >= 50) score -= 25;
  else if (stops >= 45) score -= 20;
  else if (stops >= 35) score -= 10;
  else if (stops >= 25) score -= 0;
  else if (stops < 15) score += 5;
  
  if (tipoMayoritario === 'apartment') score -= 20;
  else if (tipoMayoritario === 'business') score -= 10;
  else if (tipoMayoritario === 'locker') score -= 5;
  
  return Math.max(30, Math.min(100, score));
}

function scoreHorario(hora) {
  const [hours] = hora.split(':').map(Number);
  
  if (hours >= 0 && hours < 6) return 100;
  if (hours >= 6 && hours < 8) return lerp(85, 100, (8 - hours) / 2);
  if (hours >= 8 && hours < 17) return 60;
  if (hours >= 17 && hours < 21) return 50;
  if (hours >= 21) return 75;
  
  return 70;
}

function scoreCiudad(city) {
  if (!city) return 100;
  const up = city.toUpperCase().trim();
  return CITY
_SCORES[up] !== undefined ? CITY_SCORES[up] : 100;
}

function scoreCommute1(millas) {
  if (millas <= 15) return 100;
  if (millas <= 20) return lerp(90, 100, (20 - millas) / 5);
  if (millas <= 25) return lerp(80, 90, (25 - millas) / 5);
  if (millas <= 30) return lerp(70, 80, (30 - millas) / 5);
  if (millas <= 40) return lerp(60, 70, (40 - millas) / 10);
  return 50;
}

// Red Flags Detection
function detectRedFlags(route) {
  const flags = [];
  const pagoRealHora = route.pago / route.tiempo_total;
  const pagoPorMilla = route.pago / route.millas_totales;
  const ratioTiempo = route.tiempo_total / route.duracion_horas;
  const ratioProductivo = route.millas_de_trabajo / route.millas_totales;
  const firstStopRatio = route.first_stop / (route.duracion_horas * 11);
  
  // 🔴 CRÍTICAS (-15 pts)
  if (pagoRealHora < 18) {
    flags.push({
      nivel: 'CRITICO',
      mensaje: `Pago real $${pagoRealHora.toFixed(2)}/h está por debajo del mínimo razonable`,
      penalizacion: -15
    });
  }
  
  if (pagoPorMilla < 0.60) {
    flags.push({
      nivel: 'CRITICO',
      mensaje: `Pago de $${pagoPorMilla.toFixed(2)}/milla apenas cubre gasolina`,
      penalizacion: -15
    });
  }
  
  if (ratioTiempo > 1.40) {
    flags.push({
      nivel: 'CRITICO',
      mensaje: `Excediste el bloque en ${((ratioTiempo - 1) * 100).toFixed(0)}%`,
      penalizacion: -15
    });
  }
  
  // 🔴 SEVERAS (-10 pts)
  if (route.commute_2 > 50) {
    flags.push({
      nivel: 'SEVERO',
      mensaje: `Terminaste a ${route.commute_2.toFixed(1)} millas de casa`,
      penalizacion: -10
    });
  }
  
  if (ratioProductivo < 0.40) {
    flags.push({
      nivel: 'SEVERO',
      mensaje: `Solo ${(ratioProductivo * 100).toFixed(0)}% de millas fueron productivas`,
      penalizacion: -10
    });
  }
  
  if (firstStopRatio > 1.05) {
    flags.push({
      nivel: 'SEVERO',
      mensaje: `Primera parada a ${route.first_stop.toFixed(1)} mi (${((firstStopRatio - 1) * 100).toFixed(0)}% sobre promedio)`,
      penalizacion: -10
    });
  }
  
  // ⚠️ ADVERTENCIAS (-5 pts)
  if (pagoRealHora >= 18 && pagoRealHora < 20) {
    flags.push({
      nivel: 'ADVERTENCIA',
      mensaje: `Pago real $${pagoRealHora.toFixed(2)}/h está en el límite bajo`,
      penalizacion: -5
    });
  }
  
  const [hours] = route.hora.split(':').map(Number);
  if (hours >= 8 && hours < 17) {
    flags.push({
      nivel: 'ADVERTENCIA',
      mensaje: `Horario diurno (tráfico + calor)`,
      penalizacion: -5
    });
  }
  
  return flags;
}

// Main Scoring Function
export function computeScoreV5(route) {
  // Parse numeric values
  const pagoRealHora = parseFloat(route.pago_real_por_hora) || 0;
  const pago = parseFloat(route.pago) || 0;
  const millasTotales = parseFloat(route.millas_totales) || 1; // Avoid division by zero
  const pagoPorMilla = pago / millasTotales;
  const tiempoTotal = parseFloat(route.tiempo_total);
  const duracionHoras = parseFloat(route.duracion_horas);
  const commute2 = parseFloat(route.commute_2);
  const firstStop = parseFloat(route.first_stop);
  const millasHora = parseFloat(route.millas_por_hora);
  const commute1 = parseFloat(route.commute_1);
  const numeroParadas = parseInt(route.numero_paradas) || 0;
  
  // Calculate individual scores
  const scores = {
    pagoRealHora: scorePagoRealHora(pagoRealHora),
    pagoPorMilla: scorePagoPorMilla(pagoPorMilla),
    eficienciaTiempo: scoreEficienciaTiempo(tiempoTotal, duracionHoras),
    commute2: scoreCommute2(commute2),
    firstStop: scoreFirstStop(firstStop, duracionHoras),
    millasHora: scoreMillasHora(millasHora),
    esfuerzoFisico: scoreEsfuerzoFisico(numeroParadas, 'casa'), // Default to 'casa'
    horario: scoreHorario(route.hora),
    ciudad: scoreCiudad(route.primary_city),
    commute1: scoreCommute1(commute1)
  };
  
  // Calculate weighted total
  const scoreBase = (
    scores.pagoRealHora * WEIGHTS_V5.pago_real_hora +
    scores.pagoPorMilla * WEIGHTS_V5.pago_x_milla +
    scores.eficienciaTiempo * WEIGHTS_V5.eficiencia_tiempo +
    scores.commute2 * WEIGHTS_V5.commute_2 +
    scores.firstStop * WEIGHTS_V5.first_stop +
    scores.millasHora * WEIGHTS_V5.millas_hora +
    scores.esfuerzoFisico * WEIGHTS_V5.esfuerzo_fisico +
    scores.horario * WEIGHTS_V5.horario +
    scores.ciudad * WEIGHTS_V5.ciudad +
    scores.commute1 * WEIGHTS_V5.commute_1
  );
  
  // Detect red flags
  const redFlags = detectRedFlags({
    ...route,
    pago: pago,
    tiempo_total: tiempoTotal,
    duracion_horas: duracionHoras,
    millas_totales: millasTotales,
    millas_de_trabajo: parseFloat(route.millas_de_trabajo),
    commute_2: commute2,
    first_stop: firstStop
  });
  
  // Apply red flag penalties
  let penalizacionTotal = 0;
  redFlags.forEach(flag => {
    penalizacionTotal += flag.penalizacion;
  });
  
  // Final score (minimum 5)
  const scoreFinal = Math.max(5, Math.round(scoreBase + penalizacionTotal));
  
  return {
    total: scoreFinal,
    scoreBase: Math.round(scoreBase),
    breakdown: scores,
    redFlags: redFlags,
    penalizacionTotal: penalizacionTotal
  };
}
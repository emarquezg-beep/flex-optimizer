<script setup>
import { defineProps, computed } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({})
  }
});

// 🌆 Simulamos la imagen (luego vendrá de API)
// Usamos un servicio de placeholder de calidad basado en texto
const cityImage = computed(() => {
  const city = props.data.primary_city || 'City';
  // Truco: Usamos unsplash source con keywords (nota: puede ser lento a veces, es demo)
  return `https://images.unsplash.com/photo-1449824913929-2b47761ce7a1?q=80&w=800&auto=format&fit=crop`; 
  // Cuando conectemos la API, esto será dinámico real.
});

// 🌤️ Simulamos el clima (luego vendrá de API)
const weather = {
  temp: '82°',
  condition: 'Partly Cloudy',
  icon: '⛅',
  rainChance: '10%'
};
</script>

<template>
  <div class="slide-content" :style="{ backgroundImage: `url(${cityImage})` }">
    <div class="overlay"></div>

    <div class="content-wrapper">
      
      <div class="city-header">
        <span class="label">DESTINATION</span>
        <h2 class="city-name">{{ data.primary_city || 'Unknown City' }}</h2>
        <div class="arrival-pill">
          🏁 Arrival: {{ data.eta_normal }}
        </div>
      </div>

      <div class="weather-card">
        <div class="weather-main">
          <span class="weather-icon">{{ weather.icon }}</span>
          <span class="weather-temp">{{ weather.temp }}</span>
        </div>
        <div class="weather-details">
          <span class="condition">{{ weather.condition }}</span>
          <span class="rain">💧 {{ weather.rainChance }} rain</span>
        </div>
      </div>

      <div class="dest-footer">
        <div class="stat">
          <span class="icon">📍</span>
          <span>{{ data.numero_paradas }} Stops in area</span>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.slide-content {
  height: 100%;
  width: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
  border-radius: 12px; /* Heredado del container */
  overflow: hidden;
}

.overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8));
  z-index: 1;
}

.content-wrapper {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 25px;
  color: white;
}

/* --- HEADER --- */
.city-header {
  text-align: center;
  margin-top: 10px;
}

.label {
  font-size: 0.7rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.8;
  font-weight: 700;
}

.city-name {
  font-size: 2.5rem;
  font-weight: 900;
  margin: 5px 0 10px 0;
  text-shadow: 0 4px 10px rgba(0,0,0,0.5);
  line-height: 1.1;
}

.arrival-pill {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.3);
}

/* --- WEATHER WIDGET --- */
.weather-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  margin-bottom: auto; /* Lo empuja hacia arriba un poco */
  margin-top: 40px;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.weather-icon { font-size: 2.5rem; }
.weather-temp { font-size: 2.5rem; font-weight: 800; }

.weather-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.condition { font-size: 1rem; font-weight: 600; }
.rain { font-size: 0.85rem; opacity: 0.9; margin-top: 4px; color: #93c5fd; }

/* --- FOOTER --- */
.dest-footer {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.stat {
  font-size: 0.9rem;
  background: rgba(0,0,0,0.5);
  padding: 8px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
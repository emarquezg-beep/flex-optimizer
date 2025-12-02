<script setup>
import { defineProps, onMounted, watch } from 'vue';
import { useAtmosphere } from '@/composables/useAtmosphere';

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({})
  }
});

// Usamos el nuevo Composable
const { weather, cityImage, fetchCityImage, fetchWeather } = useAtmosphere();

// Cuando el componente se monta o cambia la ciudad, buscamos la info
onMounted(() => {
  if (props.data.primary_city) {
    fetchCityImage(props.data.primary_city);
    // Aquí pasaríamos lat/lon reales si los tuviéramos en el payload
    fetchWeather(0, 0); 
  }
});

// Vigilamos cambios por si acaso
watch(() => props.data.primary_city, (newCity) => {
  if (newCity) fetchCityImage(newCity);
});
</script>

<template>
  <div class="slide-content" :style="{ backgroundImage: `url(${cityImage})` }">
    
    <div class="overlay"></div>

    <div class="content-wrapper">
      
      <div class="city-header">
        <span class="label">DESTINATION</span>
        <h2 class="city-name">{{ data.primary_city || 'Florida Area' }}</h2>
        <div class="arrival-pill">
          🏁 Arrival: {{ data.eta_normal }}
        </div>
      </div>

      <div class="weather-card" v-if="weather">
        <div class="weather-main">
          <span class="weather-icon">{{ weather.icon }}</span>
          <div class="temp-col">
            <span class="weather-temp">{{ weather.temp }}</span>
            <span class="weather-desc">{{ weather.condition }}</span>
          </div>
        </div>
        
        <div class="weather-grid">
          <div class="w-item">
            <span class="w-lbl">Rain</span>
            <span class="w-val">💧 {{ weather.rainChance }}</span>
          </div>
          <div class="w-item">
            <span class="w-lbl">Humid</span>
            <span class="w-val">🌫️ {{ weather.humidity }}</span>
          </div>
          <div class="w-item">
            <span class="w-lbl">Wind</span>
            <span class="w-val">💨 {{ weather.wind }}</span>
          </div>
        </div>
      </div>

      <div v-else class="weather-card loading-card">
        <span class="loading-text">Loading forecast...</span>
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
  /* El borde se maneja en el padre, pero por si acaso */
  border-radius: 0 0 12px 12px; 
  overflow: hidden;
}

/* EL GRIS MÁGICO (Gradiente elegante) */
.overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  /* Gris oscuro arriba (30%) -> Gris casi negro abajo (90%) */
  background: linear-gradient(to bottom, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.9));
  z-index: 1;
  backdrop-filter: blur(2px); /* Un toque de blur para que la foto no distraiga */
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

/* HEADER */
.city-header { text-align: center; margin-top: 15px; }
.label { font-size: 0.75rem; letter-spacing: 3px; color: #94a3b8; font-weight: 800; }
.city-name { 
  font-size: 2.8rem; font-weight: 900; margin: 5px 0 15px 0; 
  text-shadow: 0 4px 20px rgba(0,0,0,0.5); 
  background: -webkit-linear-gradient(#fff, #cbd5e1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.1;
}

.arrival-pill {
  display: inline-block;
  background: rgba(255, 255, 255, 0.15);
  padding: 8px 16px;
  border-radius: 30px;
  font-size: 0.95rem;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

/* WEATHER CARD (Glassmorphism) */
.weather-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  margin-top: auto; 
  margin-bottom: 30px;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.weather-icon { font-size: 3rem; }
.temp-col { display: flex; flex-direction: column; }
.weather-temp { font-size: 2.5rem; font-weight: 800; line-height: 1; }
.weather-desc { font-size: 0.9rem; opacity: 0.8; font-weight: 500; }

.weather-grid { display: flex; justify-content: space-between; }
.w-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.w-lbl { font-size: 0.7rem; text-transform: uppercase; opacity: 0.6; }
.w-val { font-size: 0.9rem; font-weight: 600; }

/* LOADING */
.loading-card { display: flex; justify-content: center; align-items: center; height: 150px; }
.loading-text { opacity: 0.7; font-style: italic; }

/* FOOTER */
.dest-footer { display: flex; justify-content: center; margin-bottom: 10px; }
.stat {
  font-size: 0.9rem;
  background: rgba(0,0,0,0.6);
  padding: 8px 20px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255,255,255,0.1);
}
</style>
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
    // 👇 CAMBIO: Pasamos el nombre de la ciudad
    fetchWeather(props.data.primary_city); 
  }
});

// Y en el watcher también:
watch(() => props.data.primary_city, (newCity) => {
  if (newCity) {
    fetchCityImage(newCity);
    fetchWeather(newCity); // 👈 Agregar esto para que reaccione si cambia
  }
});
</script>

<template>
  <div class="slide-content" :style="cityImage? { '--city-bg': `url(${cityImage})` } : { '--city-bg': 'none' }"
>
    
    <div class="overlay"></div>

    <div class="content-wrapper">
      
    <div class="city-header">
      <span class="label">DESTINATION</span>
      <h2 class="city-name">{{ data.primary_city || 'Florida Area' }}</h2>
      <div class="time-window">
        <div class="time-window-label">You'll be in the area</div>
        <div class="time-range">
          <span class="time-start">{{ data.eta_city_arrival }}</span>
          <span class="time-separator">—</span>
          <span class="time-end">{{ data.eta_city_departure }}</span>
        </div>
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
  position: relative;
  overflow: hidden;
  border-radius: 0 0 12px 12px;

  /* ✅ background controlado */
  background: var(--bg-primary);
}

.slide-content::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--city-bg);
  background-size: cover;
  background-position: center;
  filter: saturate(1.05) contrast(1.05);
  transform: scale(1.02);
  z-index: 0;
}

/* Overlay más “Audible” (profundo + viñeta) */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 1;

  background:
    radial-gradient(900px 500px at 20% 10%, rgba(255,165,0,0.16), transparent 55%),
    linear-gradient(to bottom, rgba(0,0,0,0.20), rgba(0,0,0,0.86));
    z-index: 1;
  backdrop-filter: blur(1px);
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
.label { font-size: 0.75rem; letter-spacing: 3px; color: var(--text-secondary); font-weight: 800; }
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
  background: rgba(255, 255, 255, 0.08);
  padding: 8px 16px;
  border-radius: 30px;
  font-size: 0.95rem;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

/* WEATHER CARD (Glassmorphism) */
.weather-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.10);
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

.weather-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.w-item {
  background: rgba(0,0,0,0.28);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 14px;
  padding: 10px 8px;
}
.w-lbl {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.75;
}
.w-val {
  margin-top: 4px;
  font-size: 0.9rem;
  font-weight: 800;
}

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

.time-window {
  margin-top: 16px;
  padding: 12px 20px;
  background: linear-gradient(135deg, rgba(255, 165, 0, 0.1) 0%, rgba(255, 165, 0, 0.05) 100%);
  border-radius: 12px;
  border: 1.5px solid rgba(255, 165, 0, 0.3);
}

.time-window-label {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.time-range {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 1.3em;
  font-weight: 700;
  color: var(--brand-primary);
}

.time-separator {
  color: var(--text-secondary);
  font-weight: 400;
}

.time-start,
.time-end {
  white-space: nowrap;
}

</style>
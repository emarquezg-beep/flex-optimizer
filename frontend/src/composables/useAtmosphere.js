import { ref } from 'vue';

// 📸 DICCIONARIO DE CIUDADES (Calidad Garantizada)
// Mapeamos ciudades comunes a fotos espectaculares de Unsplash
const CITY_IMAGES = {
  'Orlando': 'https://images.unsplash.com/photo-1597040663442-93e83b4b6ba3?q=80&w=800&auto=format&fit=crop', // Lake Eola
  'Kissimmee': 'https://images.unsplash.com/photo-1598563608771-49a3cc2001ba?q=80&w=800&auto=format&fit=crop', // Disney/Area vibes
  'Oviedo': 'https://images.unsplash.com/photo-1596204523926-243ce4493397?q=80&w=800&auto=format&fit=crop', // Suburban green
  'Winter Park': 'https://images.unsplash.com/photo-1623698064627-2e463a033502?q=80&w=800&auto=format&fit=crop', // Charming street
  'Tampa': 'https://images.unsplash.com/photo-1543489822-c495eb992524?q=80&w=800&auto=format&fit=crop',
  'Miami': 'https://images.unsplash.com/photo-1514214246283-ef1e12db00e6?q=80&w=800&auto=format&fit=crop',
  'Sanford': 'https://images.unsplash.com/photo-1629230678854-3c6628c6e28f?q=80&w=800&auto=format&fit=crop', // Lake Monroe vibe
  'Clermont': 'https://images.unsplash.com/photo-1633633630769-6d64903333e6?q=80&w=800&auto=format&fit=crop', // Hills
  // Fallback genérico (Carretera de Florida bonita)
  'default': 'https://images.unsplash.com/photo-1465447142348-e9952c393450?q=80&w=800&auto=format&fit=crop'
};

export function useAtmosphere() {
  const weather = ref(null);
  const cityImage = ref(CITY_IMAGES['default']);
  const loading = ref(false);

  // 1. Obtener Foto de la Ciudad
  const fetchCityImage = (cityName) => {
      if (!cityName) {
        cityImage.value = CITY_IMAGES['default']
      return
      }
    
    // Normalizamos el nombre (ej: "Orlando, FL" -> "Orlando")
    const cleanName = cityName.split(',')[0].trim();
    
    // 1) Primero intentamos curated dictionary (calidad garantizada)
    const keyMatch = Object.keys(CITY_IMAGES).find((key) =>
      key !== 'default' && cleanName.toLowerCase().includes(key.toLowerCase())
    )

    if (keyMatch) {
      cityImage.value = CITY_IMAGES[keyMatch]
      return
    }

    // 2) Fallback dinámico sin API key (imagen grande para que no se pixelee)
    const q = encodeURIComponent(`${cleanName},city,skyline`)
    cityImage.value = `https://source.unsplash.com/1600x900/?${q}`
  };

  // 2. Fetch Clima (AHORA REAL) 📡
  const fetchWeather = async (cityName) => {
    if (!cityName) return;
    loading.value = true;
    
    try {
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      // Limpiamos el nombre de la ciudad (ej: "Orlando, FL" -> "Orlando")
      const cleanCity = cityName.split(',')[0].trim();
      
      const response = await fetch(`${backendUrl}/api/weather?city=${cleanCity}`);
      const data = await response.json();
      
      weather.value = data;
      
    } catch (e) {
      console.error("Weather error:", e);
      weather.value = null; // La UI mostrará el estado de carga o error
    } finally {
      loading.value = false;
    }
  };

  return {
    weather,
    cityImage,
    loading,
    fetchCityImage,
    fetchWeather
  };
}
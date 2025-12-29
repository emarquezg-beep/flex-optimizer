import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuth } from './composables/useAuth'

import './assets/styles/design-tokens.css'
import './assets/styles/audible-theme.css'
import './style.css'

async function initApp() {
  const app = createApp(App)
  app.use(router)
  
  // Inicializar autenticación antes de montar la app
  const { initialize } = useAuth()
  await initialize()
  
  app.mount('#app')
}

initApp()
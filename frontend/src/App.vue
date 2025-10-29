<template>
  <div id="app-shell">
    
    <header class="app-header">
      <img :src="logo" alt="Flex Pilot Logo" class="app-logo" />
    </header>

    <div id="app">
    <PendingETABanner />  <router-view /> </div>

    <main>
      <router-view />
    </main>

    <BottomNavBar />
  </div>
</template>

<script setup>
import BottomNavBar from './components/BottomNavBar.vue';
// (2) Importa tu logo desde la carpeta assets
import logo from './assets/logo_FlexPilot.png'; 
import PendingETABanner from '@/components/PendingETABanner.vue'
</script>

<style scoped>
/* (3) Estilos para el header y el logo */
.app-header {
  padding: 10px 20px;
  background-color: var(--color-bg-light); /* Fondo blanco */
  text-align: center;
  border-bottom: 1px solid var(--color-border); /* Línea divisoria sutil */
}

.app-logo {
  height: 40px; /* Ajusta esta altura como prefieras */
  width: auto;
  vertical-align: middle;
}
</style>
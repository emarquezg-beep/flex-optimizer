<template>
  <div id="app-shell">
    
    <main>
      <router-view />
    </main>

    <BottomNavBar />
  </div>
</template>

<script setup>
import BottomNavBar from './components/BottomNavBar.vue';
</script>

<style scoped>
/* (Estilos opcionales para el header) */
/* .app-header {
  padding: 15px 20px;
  background-color: var(--color-primary);
  color: white;
  text-align: center;
} */
</style>

<script setup>
// 1. Importamos el componente que acabamos de crear
import FileUploader from './components/FileUploader.vue';
</script>

<template>
  <main>
    <h1>Optimizador de Rutas Flex</h1>
    <p>Sube las capturas de pantalla de tu ruta para comenzar.</p>
    
    <FileUploader />
  </main>
</template>

<style scoped>
  main {
    font-family: sans-serif;
    max-width: 800px;
    margin: 50px auto;
    padding: 20px;
    text-align: center;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1); /* Sombra suave para que resalte */
  }
</style>

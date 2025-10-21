<template>
  <div class="view-container">
    <h1>🏠 Home</h1>
    <p>Aquí verás un resumen de tu actividad (próximamente).</p>
    
    <router-link to="/upload" class="button-primary-link">
      📤 Nuevo Bloque
    </router-link>
  </div>
</template>

<style scoped>
.view-container { text-align: center; }
.button-primary-link {
  display: inline-block;
  padding: 15px 30px;
  font-size: 1.2em;
  font-weight: bold;
  color: white;
  background-color: var(--color-primary);
  border: none;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
  margin-top: 30px;
}
</style>
<template>
  <nav class="bottom-nav">
    <router-link to="/" class="nav-item">
      <span class="icon">🏠</span>
      <span class="label">Home</span>
    </router-link>
    <router-link to="/upload" class="nav-item">
      <span class="icon">📤</span>
      <span class="label">Nuevo</span>
    </router-link>
    <router-link to="/logbook" class="nav-item">
      <span class="icon">📓</span>
      <span class="label">Bitácora</span>
    </router-link>
    <router-link to="/settings" class="nav-item">
      <span class="icon">⚙️</span>
      <span class="label">Ajustes</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 600px; /* Coincide con el #app */
  margin: 0 auto;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 65px;
  background-color: var(--color-bg-light);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -2px 5px rgba(0,0,0,0.03);
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #888;
  padding: 5px 0;
  flex-grow: 1;
}
.nav-item .icon { font-size: 1.5em; }
.nav-item .label { font-size: 0.75em; margin-top: 2px; }

/* Estilo para el enlace activo (la página actual) */
.nav-item.router-link-exact-active {
  color: var(--color-primary); /* Tu color #bc6c25 */
  font-weight: bold;
}
</style>
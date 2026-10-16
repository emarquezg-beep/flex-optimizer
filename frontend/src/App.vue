<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import BottomNavBar from '@/components/BottomNavBar.vue'
import PendingETABanner from '@/components/PendingETABanner.vue'

// Si tienes logo
import logo from '@/assets/logo.png' // Ajusta la ruta según tu proyecto

const route = useRoute()
const { isAuthenticated } = useAuth()

// Mostrar layout solo si está autenticado Y no está en login
const showLayout = computed(() => {
  return isAuthenticated.value && route.name !== 'Login'
})
</script>

<template>
  <div id="app-shell">
    <header v-if="showLayout" class="app-header">
      <img :src="logo" alt="Flex Pilot Logo" class="app-logo" />
    </header>
    
    <main class="app-main">
      <PendingETABanner v-if="showLayout" />
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    
    <BottomNavBar v-if="showLayout" />
  </div>
</template>

<style scoped>

#app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

/* ==================== HEADER ==================== */
.app-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 var(--space-4);
  margin-left: 2px;

  /* ✅ Usa nav tokens */
  background: var(--nav-bg);
  border-bottom: 1px solid var(--nav-border);

  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.app-logo {
  height: 32px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
}

/* Responsive mobile */
@media (max-width: 768px) {
  .app-logo {
    height: 28px;
  }
}

.app-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ==================== MAIN CONTENT ==================== */
.app-main {
  flex: 1;
  position: relative;
  overflow-x: hidden;
  padding-bottom: env(safe-area-inset-bottom);
}

/* ==================== PAGE TRANSITIONS ==================== */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s var(--ease-out);
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .app-header {
    height: 48px;
  }

  .app-logo {
    height: 28px;
  }

  .app-title {
    font-size: var(--text-lg);
  }
}
</style>
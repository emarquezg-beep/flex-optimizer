<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Home, BarChart3, Flame, BookOpen, Settings } from 'lucide-vue-next'

const route = useRoute()

const navItems = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Reportes', path: '/reportes', icon: BarChart3 },
  { name: 'En Vivo', path: '/live-eta', icon: Flame },
  { name: 'Bitácora', path: '/bitacora', icon: BookOpen },
  { name: 'Ajustes', path: '/ajustes', icon: Settings }
]

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<template>
  <nav class="bottom-nav">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      :class="['nav-item', { 'nav-item--active': isActive(item.path) }]"
    >
      <component :is="item.icon" :size="24" class="nav-icon" />
      <span class="nav-label">{{ item.name }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--bottom-nav-height);
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-secondary);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 var(--space-2);
  z-index: var(--z-fixed);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  flex: 1;
  height: 100%;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: all var(--transition-base);
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:active {
  transform: scale(0.95);
}

.nav-icon {
  transition: all var(--transition-base);
}

.nav-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  transition: all var(--transition-base);
}

/* Active state */
.nav-item--active {
  color: var(--brand-accent);
}

.nav-item--active .nav-icon {
  transform: translateY(-2px);
}

.nav-item--active .nav-label {
  font-weight: var(--font-bold);
}

/* Hover state (desktop) */
@media (hover: hover) {
  .nav-item:hover:not(.nav-item--active) {
    color: var(--text-secondary);
  }
}

/* Active indicator (opcional - línea superior) */
.nav-item--active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background-color: var(--brand-accent);
  border-radius: 0 0 var(--radius-full) var(--radius-full);
}

/* Safe area para notch de iPhone */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-nav {
    padding-bottom: env(safe-area-inset-bottom);
    height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
  }
}
</style>
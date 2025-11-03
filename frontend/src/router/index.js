import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Dashboard' }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { title: 'Evaluar Ruta' }
  },
  {
    path: '/schedule', // 🆕 Nueva ruta
    name: 'Schedule',
    component: () => import('@/views/ScheduleView.vue'),
    meta: { title: 'Agendar Bloque' }
  },
  {
    path: '/live-eta',
    name: 'LiveETA',
    component: () => import('@/views/LiveETAView.vue'),
    meta: { title: 'En Vivo' }
  },
  {
    path: '/logbook',
    name: 'Logbook',
    component: () => import('@/views/LogbookView.vue'),
    meta: { title: 'Bitácora' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Ajustes' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0, behavior: 'smooth' }
    }
  }
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || 'Flex Pilot'} | Flex Optimizer`
  next()
})

export default router
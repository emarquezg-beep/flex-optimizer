import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'), // Lazy load
    meta: { title: 'Inicio' }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { title: 'Evaluar Ruta' }
  },
  {
    path: '/live-eta',
    name: 'LiveETA',
    component: () => import('@/views/LiveETAView.vue'),
    meta: { title: 'En Vivo' }
  },
  {
    path: '/reportes',
    name: 'Reportes',
    component: () => import('@/views/ReportesView.vue'),
    meta: { title: 'Reportes' }
  },
  {
    path: '/bitacora',
    name: 'Bitacora',
    component: () => import('@/views/BitacoraView.vue'),
    meta: { title: 'Bitácora' }
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

// Update document title
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || 'Flex Pilot'} | Flex Optimizer`
  next()
})

export default router
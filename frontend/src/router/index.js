import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  
  // ⬇️ AGREGAR ESTAS 3 RUTAS AQUÍ ⬇️
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  // ⬆️ HASTA AQUÍ ⬆️
  
  {
    path: '/update-password',
    name: 'UpdatePassword',
    component: () => import('../views/UpdatePassword.vue'),
    meta: { requiresAuth: false, allowAuthenticated: true } // 🔥 Nueva meta
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true, title: 'Dashboard' }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { requiresAuth: true, title: 'Evaluar Ruta' }
  },
  {
    path: '/schedule',
    name: 'Schedule',
    component: () => import('@/views/ScheduleView.vue'),
    meta: { requiresAuth: true, title: 'Agendar Bloque' }
  },
  {
    path: '/live-eta',
    name: 'LiveETA',
    component: () => import('@/views/LiveETAView.vue'),
    meta: { requiresAuth: true, title: 'En Vivo' }
  },
  {
    path: '/logbook',
    name: 'Logbook',
    component: () => import('@/views/LogbookView.vue'),
    meta: { requiresAuth: true, title: 'Bitácora' }
  },
{
    path: '/nerd-stats',
    name: 'nerd-stats',
    component: () => import('@/views/NerdStatsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, title: 'Ajustes' }
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

router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, checkAuth } = useAuth()
  
  // Actualizar título de la página
  document.title = `${to.meta.title || to.name} | Flex Optimizer`
  
  // 🔥 EXCEPCIÓN: Siempre permitir /update-password
// 🔥 EXCEPCIÓN: Siempre permitir estas rutas de recuperación
  if (['UpdatePassword', 'ResetPassword'].includes(to.name)) {
    next()
    return
  }
  
  // Si la ruta requiere autenticación
  if (to.meta.requiresAuth) {
    if (!isAuthenticated.value) {
      // Verificar si hay sesión guardada
      const hasSession = await checkAuth()
      if (!hasSession) {
        // Redirigir a login guardando la ruta deseada
        next({ name: 'Login', query: { redirect: to.fullPath } })
        return
      }
    }
    next()
  } 
// Si ya está autenticado y va a rutas de auth (excepto reset), redirigir a home
  else if (['Login', 'Register', 'ForgotPassword'].includes(to.name) && isAuthenticated.value) {
    next({ name: 'Home' })
  }
  // Ruta pública, dejar pasar
  else {
    next()
  }
})

export default router
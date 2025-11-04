import { ref, computed, readonly } from 'vue'
import { supabase } from '@/lib/supabase'

const user = ref(null)
const session = ref(null)
const isLoading = ref(true)

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value && !!session.value)
  const userId = computed(() => user.value?.id || null)
  const userName = computed(() => {
    return user.value?.user_metadata?.name || 
           user.value?.email?.split('@')[0] || 
           'Usuario'
  })

  async function initialize() {
    isLoading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      if (currentSession) {
        session.value = currentSession
        user.value = currentSession.user
      }
      
      supabase.auth.onAuthStateChange((_event, currentSession) => {
        session.value = currentSession
        user.value = currentSession?.user || null
      })
    } catch (error) {
      console.error('Error inicializando auth:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })
      
      if (error) {
        let errorMessage = 'Error al iniciar sesión'
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email o contraseña incorrectos'
        }
        return { success: false, error: errorMessage }
      }
      
      session.value = data.session
      user.value = data.user
      return { success: true, user: data.user }
    } catch (error) {
      return { success: false, error: 'Error inesperado' }
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
      user.value = null
      session.value = null
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async function checkAuth() {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        session.value = currentSession
        user.value = currentSession.user
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  return {
    user: readonly(user),
    session: readonly(session),
    isLoading: readonly(isLoading),
    isAuthenticated,
    userId,
    userName,
    initialize,
    login,
    logout,
    checkAuth
  }
}

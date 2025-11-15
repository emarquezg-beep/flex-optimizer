import { ref, computed, readonly } from 'vue'
import { supabase } from '@/lib/supabase'

const user = ref(null)
const session = ref(null)
const isLoading = ref(true)
const userProfile = ref(null)

// Variable para almacenar la función de cleanup del listener
let authStateChangeUnsubscribe = null

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value && !!session.value)
  const userId = computed(() => user.value?.id || null)
  
  const userName = computed(() => {
    // Prioridad: 1. Perfil, 2. Metadata, 3. Email
    if (userProfile.value?.full_name) {
      return userProfile.value.full_name
    }
    return user.value?.user_metadata?.name || 
           user.value?.email?.split('@')[0] || 
           'Usuario'
  })

  const needsProfileCompletion = computed(() => {
    return isAuthenticated.value && 
           (!userProfile.value?.full_name || userProfile.value.full_name.trim() === '')
  })

  async function loadUserProfile(userId) {
    if (!userId) return
    
    console.log('🔵 Cargando perfil para:', userId)
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (!error && data) {
        userProfile.value = data
        console.log('✅ Perfil cargado:', data)
      } else if (error) {
        console.error('❌ Error cargando perfil:', error)
      }
    } catch (error) {
      console.error('❌ Error inesperado cargando perfil:', error)
    }
  }

  async function initialize() {
    console.log('🔵 INICIO: initialize()')
    
    // Si ya hay un listener activo, no crear otro
    if (authStateChangeUnsubscribe) {
      console.log('⚠️ Auth ya está inicializado, saltando...')
      return
    }

    isLoading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      if (currentSession) {
        session.value = currentSession
        user.value = currentSession.user
        console.log('✅ Sesión encontrada:', currentSession.user.id)
        
        // ✅ CARGAR PERFIL SOLO UNA VEZ AL INICIALIZAR
        await loadUserProfile(currentSession.user.id)
      }
      
      // ❌ DESACTIVAR TEMPORALMENTE EL LISTENER
      console.log('⚠️ Listener de onAuthStateChange DESACTIVADO para diagnóstico')
      
      /* 
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
        console.log('🔔 onAuthStateChange disparado:', _event)
        session.value = currentSession
        user.value = currentSession?.user || null
        
        if (currentSession?.user) {
          await loadUserProfile(currentSession.user.id)
        } else {
          userProfile.value = null
        }
      })
      
      authStateChangeUnsubscribe = () => {
        subscription.unsubscribe()
      }
      */
      
    } catch (error) {
      console.error('❌ Error inicializando auth:', error)
    } finally {
      isLoading.value = false
      console.log('🟢 FIN: initialize()')
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
      
      // Cargar perfil después del login
      await loadUserProfile(data.user.id)
      
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
      userProfile.value = null
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async function register(email, password, fullName = null) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName
          }
        }
      })
      
      if (error) {
        let errorMessage = 'Error al registrar usuario'
        if (error.message.includes('already registered')) {
          errorMessage = 'Este email ya está registrado'
        }
        return { success: false, error: errorMessage }
      }
      
      // Si se proporcionó un nombre, actualizarlo en user_profiles
      if (fullName && data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ full_name: fullName })
          .eq('user_id', data.user.id)
        
        if (profileError) {
          console.error('Error actualizando perfil:', profileError)
        }
      }
      
      return { 
        success: true, 
        user: data.user,
        needsEmailConfirmation: data.user?.identities?.length === 0
      }
    } catch (error) {
      return { success: false, error: 'Error inesperado al registrar' }
    }
  }

  async function requestPasswordReset(email) {
    try {
      const baseUrl = window.location.origin
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${baseUrl}/reset-password`
      })
      
      if (error) {
        return { success: false, error: 'Error al enviar email de recuperación' }
      }
      
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Error inesperado' }
    }
  }

  async function updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        return { success: false, error: 'Error al actualizar contraseña' }
      }
      
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Error inesperado' }
    }
  }

  async function checkAuth() {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        session.value = currentSession
        user.value = currentSession.user
        await loadUserProfile(currentSession.user.id)
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  async function refreshProfile() {
    console.log('🔄 Refrescando perfil...')
    if (user.value?.id) {
      await loadUserProfile(user.value.id)
    }
  }

  function cleanup() {
    if (authStateChangeUnsubscribe) {
      authStateChangeUnsubscribe()
      authStateChangeUnsubscribe = null
    }
  }

  return {
    user: readonly(user),
    session: readonly(session),
    isLoading: readonly(isLoading),
    userProfile: readonly(userProfile),
    isAuthenticated,
    userId,
    userName,
    needsProfileCompletion,
    initialize,
    login,
    logout,
    checkAuth,
    register,
    requestPasswordReset,
    updatePassword,
    refreshProfile,
    cleanup
  }
}
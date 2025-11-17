import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const userProfile = ref(null)
const isLoadingProfile = ref(false)

export function useUserProfile() {
  
  async function fetchUserProfile(userId) {
    if (!userId) return { success: false, error: 'No user ID provided' }
    
    isLoadingProfile.value = true
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle() // ✅ Usar maybeSingle() en lugar de single()
      
      if (error) {
        console.error('Error fetching profile:', error)
        return { success: false, error: error.message }
      }
      
      // Si no existe el perfil, crear uno vacío
      if (!data) {
        console.log('📝 Perfil no encontrado, creando uno nuevo...')
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({ user_id: userId })
          .select()
          .single()
        
        if (createError) {
          console.error('Error creando perfil:', createError)
          return { success: false, error: createError.message }
        }
        
        userProfile.value = newProfile
        return { success: true, profile: newProfile }
      }
      
      userProfile.value = data
      return { success: true, profile: data }
    } catch (error) {
      console.error('Error fetching profile:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingProfile.value = false
    }
  }

  async function updateUserProfile(userId, updates) {
    if (!userId) return { success: false, error: 'No user ID provided' }
    
    isLoadingProfile.value = true
    try {
      // Primero verificar si existe el perfil
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      
      let result
      
      if (!existingProfile) {
        // Si no existe, crear uno nuevo con los datos
        result = await supabase
          .from('user_profiles')
          .insert({ user_id: userId, ...updates })
          .select()
          .single()
      } else {
        // Si existe, actualizarlo
        result = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('user_id', userId)
          .select()
          .single()
      }
      
      const { data, error } = result
      
      if (error) {
        console.error('Error updating profile:', error)
        return { success: false, error: error.message }
      }
      
      userProfile.value = data
      return { success: true, profile: data }
    } catch (error) {
      console.error('Error updating profile:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingProfile.value = false
    }
  }

  function hasCompletedProfile(profile) {
    // Verificar si tiene al menos el nombre completo
    return profile && profile.full_name && profile.full_name.trim().length > 0
  }

  function clearProfile() {
    userProfile.value = null
  }

  return {
    userProfile,
    isLoadingProfile,
    fetchUserProfile,
    updateUserProfile,
    hasCompletedProfile,
    clearProfile
  }
}
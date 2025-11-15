import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const vehicles = ref([])
const isLoadingVehicles = ref(false)

export function useVehicles() {
  
  /**
   * Obtener todos los vehículos del usuario (activos y archivados)
   */
  async function fetchVehicles(userId) {
    if (!userId) return { success: false, error: 'No user ID provided' }
    
    isLoadingVehicles.value = true
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false }) // Vehículo principal primero
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching vehicles:', error)
        return { success: false, error: error.message }
      }
      
      vehicles.value = data || []
      return { success: true, vehicles: data }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingVehicles.value = false
    }
  }

  /**
   * Obtener solo vehículos activos (no archivados)
   */
  async function fetchActiveVehicles(userId) {
    if (!userId) return { success: false, error: 'No user ID provided' }
    
    isLoadingVehicles.value = true
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching active vehicles:', error)
        return { success: false, error: error.message }
      }
      
      vehicles.value = data || []
      return { success: true, vehicles: data }
    } catch (error) {
      console.error('Error fetching active vehicles:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingVehicles.value = false
    }
  }

  /**
   * Obtener el vehículo principal del usuario
   */
  async function getPrimaryVehicle(userId) {
    if (!userId) return { success: false, error: 'No user ID provided' }
    
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .eq('is_archived', false)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching primary vehicle:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, vehicle: data }
    } catch (error) {
      console.error('Error fetching primary vehicle:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Crear nuevo vehículo
   */
  async function createVehicle(userId, vehicleData) {
    if (!userId) return { success: false, error: 'No user ID provided' }
    
    isLoadingVehicles.value = true
    try {
      // Si este será el primer vehículo, hacerlo principal automáticamente
      const { data: existingVehicles } = await supabase
        .from('user_vehicles')
        .select('id')
        .eq('user_id', userId)
        .eq('is_archived', false)
      
      const isFirstVehicle = !existingVehicles || existingVehicles.length === 0
      
      const { data, error } = await supabase
        .from('user_vehicles')
        .insert({
          user_id: userId,
          nickname: vehicleData.nickname,
          make: vehicleData.make || null,
          model: vehicleData.model || null,
          year: vehicleData.year || null,
          is_primary: isFirstVehicle || vehicleData.is_primary || false,
          total_mileage: 0
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating vehicle:', error)
        return { success: false, error: error.message }
      }
      
      // Si se marcó como principal, desmarcar los demás
      if (data.is_primary) {
        await clearOtherPrimaryVehicles(userId, data.id)
      }
      
      // Refrescar lista
      await fetchVehicles(userId)
      
      return { success: true, vehicle: data }
    } catch (error) {
      console.error('Error creating vehicle:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingVehicles.value = false
    }
  }

  /**
   * Actualizar vehículo existente
   */
  async function updateVehicle(userId, vehicleId, updates) {
    if (!userId || !vehicleId) return { success: false, error: 'Missing required parameters' }
    
    isLoadingVehicles.value = true
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .update(updates)
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating vehicle:', error)
        return { success: false, error: error.message }
      }
      
      // Si se marcó como principal, desmarcar los demás
      if (updates.is_primary === true) {
        await clearOtherPrimaryVehicles(userId, vehicleId)
      }
      
      // Refrescar lista
      await fetchVehicles(userId)
      
      return { success: true, vehicle: data }
    } catch (error) {
      console.error('Error updating vehicle:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingVehicles.value = false
    }
  }

  /**
   * Archivar vehículo (soft delete)
   */
  async function archiveVehicle(userId, vehicleId) {
    if (!userId || !vehicleId) return { success: false, error: 'Missing required parameters' }
    
    isLoadingVehicles.value = true
    try {
      // Si el vehículo a archivar era principal, necesitamos asignar otro
      const { data: vehicleToArchive } = await supabase
        .from('user_vehicles')
        .select('is_primary')
        .eq('id', vehicleId)
        .single()
      
      const { data, error } = await supabase
        .from('user_vehicles')
        .update({ 
          is_archived: true,
          is_primary: false // Un vehículo archivado no puede ser principal
        })
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .select()
        .single()
      
      if (error) {
        console.error('Error archiving vehicle:', error)
        return { success: false, error: error.message }
      }
      
      // Si era principal, asignar otro vehículo como principal
      if (vehicleToArchive?.is_primary) {
        await assignNewPrimaryVehicle(userId)
      }
      
      // Refrescar lista
      await fetchVehicles(userId)
      
      return { success: true, vehicle: data }
    } catch (error) {
      console.error('Error archiving vehicle:', error)
      return { success: false, error: 'Error inesperado' }
    } finally {
      isLoadingVehicles.value = false
    }
  }

  /**
   * Desarchivar vehículo
   */
  async function unarchiveVehicle(userId, vehicleId) {
    if (!userId || !vehicleId) return { success: false, error: 'Missing required parameters' }
    
    return await updateVehicle(userId, vehicleId, { is_archived: false })
  }

  /**
   * Marcar un vehículo como principal
   */
  async function setPrimaryVehicle(userId, vehicleId) {
    return await updateVehicle(userId, vehicleId, { is_primary: true })
  }

  /**
   * Incrementar millaje de un vehículo
   */
  async function addMileage(userId, vehicleId, miles) {
    if (!userId || !vehicleId || !miles) return { success: false, error: 'Missing required parameters' }
    
    try {
      // Obtener millaje actual
      const { data: vehicle } = await supabase
        .from('user_vehicles')
        .select('total_mileage')
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .single()
      
      if (!vehicle) return { success: false, error: 'Vehicle not found' }
      
      const newMileage = (vehicle.total_mileage || 0) + parseFloat(miles)
      
      const { error } = await supabase
        .from('user_vehicles')
        .update({ total_mileage: newMileage })
        .eq('id', vehicleId)
        .eq('user_id', userId)
      
      if (error) {
        console.error('Error adding mileage:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, newMileage }
    } catch (error) {
      console.error('Error adding mileage:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * HELPER: Desmarcar otros vehículos como principales
   */
  async function clearOtherPrimaryVehicles(userId, exceptVehicleId) {
    await supabase
      .from('user_vehicles')
      .update({ is_primary: false })
      .eq('user_id', userId)
      .neq('id', exceptVehicleId)
  }

  /**
   * HELPER: Asignar un nuevo vehículo principal si no hay ninguno
   */
  async function assignNewPrimaryVehicle(userId) {
    const { data: activeVehicles } = await supabase
      .from('user_vehicles')
      .select('id')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .limit(1)
    
    if (activeVehicles && activeVehicles.length > 0) {
      await supabase
        .from('user_vehicles')
        .update({ is_primary: true })
        .eq('id', activeVehicles[0].id)
    }
  }

  /**
   * Limpiar estado (útil para logout)
   */
  function clearVehicles() {
    vehicles.value = []
  }

  return {
    vehicles,
    isLoadingVehicles,
    fetchVehicles,
    fetchActiveVehicles,
    getPrimaryVehicle,
    createVehicle,
    updateVehicle,
    archiveVehicle,
    unarchiveVehicle,
    setPrimaryVehicle,
    addMileage,
    clearVehicles
  }
}
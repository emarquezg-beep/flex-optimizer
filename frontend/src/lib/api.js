import { supabase } from './supabase'

/**
 * Obtiene los headers de autenticación con el token actual
 * @returns {Promise<Object>} Headers con Authorization y Content-Type
 */
export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('No hay sesión activa')
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }
}

/**
 * Fetch con autenticación automática
 * @param {string} url - URL del endpoint
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>} Response del fetch
 */
export async function fetchWithAuth(url, options = {}) {
  const headers = await getAuthHeaders()
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  })
}
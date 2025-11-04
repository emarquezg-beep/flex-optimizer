import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://msynbnvebhkbdjwitfxv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zeW5ibnZlYmhrYmRqd2l0Znh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NzI5ODQsImV4cCI6MjA3NjU0ODk4NH0.DSlcEUw2_1vyt6XGtNApH7gZzBpugehSujZwVkbiLlA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'flex-optimizer-auth'
  }
})
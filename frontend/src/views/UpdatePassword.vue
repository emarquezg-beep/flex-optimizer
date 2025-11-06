<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';

console.log('🔵 SCRIPT DE UpdatePassword.vue CARGANDO');
console.log('🔍 URL completa:', window.location.href);
console.log('🔍 Hash:', window.location.hash);

// --- Estado Reactivo ---
const router = useRouter();
const isLoading = ref(true);
const showForm = ref(false);
const isPasswordRecovery = ref(false);

// --- Formulario ---
const password = ref('');
const confirmPassword = ref('');
const message = ref('');
const error = ref('');

// VERIFICACIÓN INMEDIATA - Antes incluso de onMounted
const checkRecoveryMode = () => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const type = params.get('type');
  const accessToken = params.get('access_token');
  
  console.log('🔍 Parámetros del hash:', {
    type,
    hasAccessToken: !!accessToken,
    allParams: Array.from(params.entries())
  });
  
  // Si detectamos type=recovery, estamos en modo recuperación
  if (type === 'recovery' && accessToken) {
    console.log('✅ MODO RECUPERACIÓN DETECTADO');
    return true;
  }
  
  return false;
};

// Verificar INMEDIATAMENTE si estamos en recuperación
const IS_RECOVERY = checkRecoveryMode();
console.log('🎯 ¿Es recuperación?', IS_RECOVERY);

onMounted(async () => {
  console.log('🟢 onMounted ejecutándose');
  
  // Si es recuperación, mostrar formulario sin importar nada más
  if (IS_RECOVERY) {
    console.log('✅ Mostrando formulario de recuperación');
    isPasswordRecovery.value = true;
    showForm.value = true;
    isLoading.value = false;
    return;
  }
  
  // Si NO es recuperación, verificar sesión normal
  console.log('🔍 No es recuperación, verificando sesión...');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    console.log('👤 Usuario con sesión activa, redirigiendo a dashboard');
    isLoading.value = false;
    router.push('/dashboard');
  } else {
    console.log('❌ No hay sesión ni recuperación - Link inválido');
    isLoading.value = false;
  }
});

// Manejador del formulario
const handleSubmit = async () => {
  error.value = '';
  message.value = '';

  console.log('🔄 Validando contraseñas...');

  if (password.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.';
    return;
  }

  console.log('🔄 Actualizando contraseña en Supabase...');
  
  try {
    const { data, error: updateError } = await supabase.auth.updateUser({
      password: password.value
    });

    if (updateError) {
      console.error('❌ Error al actualizar:', updateError);
      error.value = updateError.message;
    } else {
      console.log('✅ Contraseña actualizada exitosamente');
      message.value = '¡Contraseña actualizada con éxito! Redirigiendo al login...';
      showForm.value = false;
      
      // Cerrar sesión
      console.log('🔄 Cerrando sesión...');
      await supabase.auth.signOut();
      
      setTimeout(() => {
        console.log('➡️ Redirigiendo a /login');
        router.push('/login');
      }, 2500);
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err);
    error.value = 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
  }
};
</script>

<template>
  <div class="update-password-container">
    
    <!-- Debug info (eliminar en producción) -->
    <div style="background: #f0f0f0; padding: 10px; margin-bottom: 20px; font-size: 12px; text-align: left;">
      <strong>🔍 DEBUG:</strong><br>
      isLoading: {{ isLoading }}<br>
      showForm: {{ showForm }}<br>
      isPasswordRecovery: {{ isPasswordRecovery }}<br>
      URL: {{ $route.fullPath }}
    </div>

    <div v-if="isLoading" class="loading-spinner">
      <p>Verificando link...</p>
    </div>

    <div v-if="!isLoading && showForm">
      <h2>Restablecer Contraseña</h2>
      <p>Has verificado tu correo. Por favor, introduce tu nueva contraseña.</p>
      
      <form class="update-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="password">Nueva Contraseña</label>
          <input 
            id="password"
            class="input-field" 
            type="password" 
            v-model="password"
            required
            autocomplete="new-password"
          />
        </div>
        <div class="form-group">
          <label for="confirm-password">Confirmar Contraseña</label>
          <input 
            id="confirm-password"
            class="input-field" 
            type="password"
            v-model="confirmPassword"
            required
            autocomplete="new-password"
          />
        </div>
        <button type="submit" class="submit-button">Actualizar Contraseña</button>
      </form>
    </div>

    <div v-if="!isLoading && !showForm && !isPasswordRecovery">
      <p class="error-message">
        El link de recuperación es inválido o ha expirado. 
        Por favor, solicita uno nuevo.
      </p>
      <button @click="router.push('/login')" class="submit-button" style="background-color: #555;">
        Ir a Login
      </button>
    </div>

    <p v-if="message && !isLoading" class="success-message">{{ message }}</p>
    <p v-if="error && !isLoading" class="error-message">{{ error }}</p>

  </div>
</template>

<style scoped>
.update-password-container {
  max-width: 450px;
  margin: 3rem auto;
  padding: 2rem;
  border: 1px solid #eee;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  font-family: Arial, sans-serif;
  text-align: center;
}

.loading-spinner {
  text-align: center;
  font-style: italic;
  color: #555;
  padding: 2rem;
}

.update-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.input-field {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.submit-button {
  padding: 0.85rem;
  background-color: #007bff;
  color: white;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 1rem;
}

.submit-button:hover {
  background-color: #0056b3;
}

.success-message {
  color: #155724;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.error-message {
  color: #721c24;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}
</style>
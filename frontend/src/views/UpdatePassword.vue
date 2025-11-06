<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';

console.log('SCRIPT DE UpdatePassword.vue SE ESTÁ CARGANDO');

// --- Estado Reactivo ---
const router = useRouter();
const isLoading = ref(true);
const showForm = ref(false);
const hasCheckedAuth = ref(false);
const isPasswordRecovery = ref(false); // 🔥 NUEVA FLAG CRÍTICA

// --- Formulario ---
const password = ref('');
const confirmPassword = ref('');
const message = ref('');
const error = ref('');

// 1. EL LISTENER (CORREGIDO DE VERDAD)
onMounted(() => {
  console.log('UpdatePassword.vue onMounted() SE ESTÁ EJECUTANDO');
  
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('EVENTO:', event, '| SESIÓN:', session ? 'Sí, existe' : 'No');
    
    // PRIORIDAD #1: Detectar PASSWORD_RECOVERY
    if (event === 'PASSWORD_RECOVERY') {
      console.log('¡Evento de recuperación detectado!');
      isPasswordRecovery.value = true; // 🔥 Marcar que estamos en modo recuperación
      isLoading.value = false;
      showForm.value = true;
      hasCheckedAuth.value = true;
      return;
    }

    // PRIORIDAD #2: Si ya estamos en modo recuperación, IGNORAR TODO LO DEMÁS
    // Esto previene que eventos posteriores (SIGNED_IN, etc.) nos redirijan
    if (isPasswordRecovery.value) {
      console.log('Ignorando evento porque estamos en modo recuperación');
      return;
    }

    // PRIORIDAD #3: Usuario con sesión normal (no es recuperación)
    if (session && event !== 'PASSWORD_RECOVERY') {
      console.log('Usuario ya tiene sesión, redirigiendo a dashboard');
      isLoading.value = false;
      hasCheckedAuth.value = true;
      router.push('/dashboard');
      return;
    }
    
    // PRIORIDAD #4: Link inválido o expirado
    if (!session && (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT')) {
      console.log('No hay sesión válida, mostrando error');
      isLoading.value = false;
      hasCheckedAuth.value = true;
      // El template mostrará el error
    }
  });
});

// 2. EL MANEJADOR DEL FORMULARIO
const handleSubmit = async () => {
  error.value = '';
  message.value = '';

  if (password.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.';
    return;
  }

  const { data, error: updateError } = await supabase.auth.updateUser({
    password: password.value
  });

  if (updateError) {
    error.value = updateError.message;
  } else {
    message.value = '¡Contraseña actualizada con éxito! Redirigiendo al login...';
    showForm.value = false;
    
    // 🔥 IMPORTANTE: Cerrar sesión después de cambiar contraseña
    await supabase.auth.signOut();
    
    setTimeout(() => {
      router.push('/login');
    }, 2500);
  }
};
</script>

<template>
  <div class="update-password-container">
    
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
          />
        </div>
        <button type="submit" class="submit-button">Actualizar Contraseña</button>
      </form>
    </div>

    <div v-if="!isLoading && !showForm && hasCheckedAuth">
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
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';

// --- Estado Reactivo ---
const router = useRouter();
const isLoading = ref(true);
const showForm = ref(false);
const hasCheckedAuth = ref(false); // Para saber si ya terminamos de revisar

// --- Formulario ---
const password = ref('');
const confirmPassword = ref('');
const message = ref('');
const error = ref('');

// 1. EL LISTENER (CORREGIDO)
onMounted(() => {
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('EVENTO:', event, '| SESIÓN:', session ? 'Sí, existe' : 'No');
    // PRIORIDAD #1:
    // Si el evento es de recuperación, mostramos el form y PARAmos.
    // Esto evita que el siguiente evento 'session' nos redirija.
    if (event === 'PASSWORD_RECOVERY') {
      console.log('¡Evento de recuperación detectado!');
      isLoading.value = false;
      showForm.value = true;
      hasCheckedAuth.value = true;
      return; // ¡Importante! Salimos para no procesar más.
    }

    // PRIORIDAD #2:
    // Si YA estamos mostrando el form, no hagas nada más.
    // Ignora cualquier evento de 'session' que venga después.
    if (showForm.value) {
      return;
    }

    // PRIORIDAD #3:
    // Si no es un recovery Y no estamos en el form,
    // revisamos si es una sesión normal (alguien ya logueado).
    if (session) {
      isLoading.value = false;
      hasCheckedAuth.value = true;
      router.push('/dashboard'); // Redirigir a usuarios ya logueados
    } 
    // PRIORIDAD #4:
    // Si no es nada de lo anterior, es un link inválido.
    else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
      isLoading.value = false;
      hasCheckedAuth.value = true;
      // No se redirige, el template mostrará el error.
    }
  });
});

// 2. EL MANEJADOR DEL FORMULARIO (Sigue igual)
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
/* Contenedor principal de la página */
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
/* Mensaje de "Verificando..." */
.loading-spinner {
  text-align: center;
  font-style: italic;
  color: #555;
  padding: 2rem;
}
/* El formulario */
.update-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}
/* Grupo de (label + input) */
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group label {
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}
/* Campos de texto */
.input-field {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}
/* Botón de enviar */
.submit-button {
  padding: 0.85rem;
  background-color: #007bff; /* Un color azul de ejemplo */
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
/* Mensajes de éxito y error */
.success-message {
  color: #155724; /* Verde oscuro */
  background-color: #d4edda; /* Verde claro */
  border: 1px solid #c3e6cb;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}
.error-message {
  color: #721c24; /* Rojo oscuro */
  background-color: #f8d7da; /* Rojo claro */
  border: 1px solid #f5c6cb;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}
</style>
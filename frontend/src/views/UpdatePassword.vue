<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router'; // Importa el hook del router
// BIEN ✅
import { supabase } from '@/lib/supabase'; // Asegúrate que esta ruta sea correcta

// --- Estado Reactivo ---
const showForm = ref(false);
const isLoading = ref(true);
const password = ref('');
const confirmPassword = ref('');
const message = ref('');
const error = ref('');

// Hook del router para navegar
const router = useRouter();

// 1. EL LISTENER (OYENTE)
// onMounted se ejecuta solo en el navegador
onMounted(() => {
  supabase.auth.onAuthStateChange(async (event, session) => {
    
    if (event === 'PASSWORD_RECOVERY') {
      // ¡Éxito! Supabase verificó el token en la URL.
      // Ahora tenemos una sesión temporal para cambiar la contraseña.
      showForm.value = true;
    } 
    else if (session) {
      // Si el usuario ya está logueado (sesión normal),
      // no debería estar aquí. Lo mandamos al dashboard.
      router.push('/dashboard'); // <-- Cambia esto a tu página principal de logueado
    } 
    else {
      // Si no hay sesión y no es un evento de recovery,
      // no debería estar aquí. Lo mandamos al login.
      router.push('/login'); // <-- Cambia esto a tu página de login
    }

    isLoading.value = false;
  });
});

// 2. EL MANEJADOR DEL FORMULARIO
const handleSubmit = async () => {
  // Reseteamos mensajes
  error.value = '';
  message.value = '';

  // Validaciones
  if (password.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.';
    return;
  }

  // Actualizamos al usuario en Supabase
  // (Esto funciona porque ya tenemos la sesión temporal del 'onAuthStateChange')
  const { data, error: updateError } = await supabase.auth.updateUser({
    password: password.value
  });

  if (updateError) {
    error.value = updateError.message;
  } else {
    message.value = '¡Contraseña actualizada con éxito! Redirigiendo al login...';
    // Limpiamos el formulario
    password.value = '';
    confirmPassword.value = '';
    showForm.value = false;

    // Esperamos 2 segundos y lo mandamos al login
    setTimeout(() => {
      router.push('/login'); // <-- Cambia esto a tu página de login
    }, 2000);
  }
};
</script>

<template>
  <div class="update-password-container">
    
    <div v-if="isLoading" class="loading-spinner">
      <p>Verificando...</p>
    </div>

    <div v-if="showForm">
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

    <p v-if="message" class="success-message">{{ message }}</p>
    <p v-if="error" class="error-message">{{ error }}</p>

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
}

/* Mensaje de "Verificando..." */
.loading-spinner {
  text-align: center;
  font-style: italic;
  color: #555;
}

/* El formulario */
.update-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem; /* Espacio entre los elementos del formulario */
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
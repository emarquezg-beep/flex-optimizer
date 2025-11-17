<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useVehicles } from '@/composables/useVehicles'
import { fetchWithAuth } from '@/lib/api'
import { Calendar, ArrowLeft } from 'lucide-vue-next'
import { BaseButton, BaseCard, BaseInput } from '@/components/base'

const router = useRouter()
const route = useRoute()
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// ✅ Usuario autenticado
const { userId } = useAuth()

// 🚗 Vehículos dinámicos
const { vehicles, fetchActiveVehicles, getPrimaryVehicle } = useVehicles()

// Opciones
const DURACION_OPTIONS = [3, 3.5, 4, 4.5, 5]
const warehouses = [
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL' },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL' },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL' },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL' },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL' },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL' },
  { code: 'DFL5', address: '3000 Shelby Industrial Dr Apopka, FL' },
]

// Estados
const isEditMode = ref(false)
const blockId = ref(null)
const isSaving = ref(false)
const saveStatus = ref(null)

// Formulario
const formData = ref({
  fecha: '',
  hora: '',
  duracion_horas: 4,
  pago: '',
  warehouse: warehouses[0].code,
  vehiculo: '',  // ← Ahora será un UUID (se carga dinámicamente)
  notes: ''
})

onMounted(async () => {
  // 🚗 Cargar vehículos activos
  if (userId.value) {
    await fetchActiveVehicles(userId.value)
    
    // Establecer vehículo principal por defecto (solo en modo crear)
    if (!route.query.blockId) {
      const primaryResult = await getPrimaryVehicle(userId.value)
      if (primaryResult.success && primaryResult.vehicle) {
        formData.value.vehiculo = primaryResult.vehicle.id
      }
    }
  }
  
  // Verificar si es modo edición
  if (route.query.blockId) {
    isEditMode.value = true
    blockId.value = route.query.blockId
    await loadBlock()
  } else {
    // Modo crear: Establecer fecha de hoy por defecto
    formData.value.fecha = getTodayDate()
  }
})

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function loadBlock() {
  try {
    // En modo edición, cargar datos del bloque
    const response = await fetchWithAuth(`${backendUrl}/api/scheduled-blocks/${userId.value}`)
    const result = await response.json()
    
    if (result.success) {
      const block = result.blocks.find(b => b.id === parseInt(blockId.value))
      
      if (block) {
        formData.value = {
          fecha: block.fecha,
          hora: block.hora.substring(0, 5), // "14:15:00" -> "14:15"
          duracion_horas: block.duracion_horas,
          pago: block.pago,
          warehouse: block.warehouse,
          vehiculo: block.vehiculo,
          notes: block.notes || ''
        }
        
        console.log('✅ Bloque cargado para edición:', block.id)
      }
    }
  } catch (error) {
    console.error('❌ Error cargando bloque:', error)
  }
}

async function saveBlock() {
  // Validaciones
  if (!formData.value.fecha) {
    alert('Por favor, selecciona una fecha')
    return
  }
  
  if (!formData.value.hora) {
    alert('Por favor, selecciona una hora')
    return
  }
  
  if (!formData.value.pago || formData.value.pago <= 0) {
    alert('Por favor, ingresa un pago válido')
    return
  }

  isSaving.value = true
  saveStatus.value = null

  try {
    const dataToSend = {
      user_id: userId.value,
      fecha: formData.value.fecha,
      hora: formData.value.hora + ':00', // "14:15" -> "14:15:00"
      duracion_horas: parseFloat(formData.value.duracion_horas),
      pago: parseFloat(formData.value.pago),
      warehouse: formData.value.warehouse,
      vehicle_id: formData.value.vehiculo,  // ← UUID del vehículo
      notes: formData.value.notes || null
    }
    let response
    
    if (isEditMode.value) {
    // Actualizar bloque existente
    response = await fetchWithAuth(`${backendUrl}/api/scheduled-blocks/${blockId.value}`, {
        method: 'PUT',
        body: JSON.stringify(dataToSend)
    })
    } else {
    // Crear nuevo bloque
    response = await fetchWithAuth(`${backendUrl}/api/scheduled-blocks`, {
        method: 'POST',
        body: JSON.stringify(dataToSend)
    })
    }

    const result = await response.json()

    if (result.success) {
      saveStatus.value = {
        success: true,
        message: isEditMode.value ? '✅ Bloque actualizado' : '✅ Bloque agendado'
      }
      
      console.log('✅ Bloque guardado:', result.block.id)
      
      // Redirigir al home después de 1.5s
      setTimeout(() => {
        router.push('/')
      }, 1500)
      
    } else {
      throw new Error(result.error || 'Error desconocido')
    }

  } catch (error) {
    console.error('❌ Error guardando bloque:', error)
    saveStatus.value = {
      success: false,
      message: `Error: ${error.message}`
    }
  } finally {
    isSaving.value = false
  }
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="schedule-view">
    
    <!-- Header -->
    <div class="header-section">
      <button @click="goBack" class="back-button">
        <ArrowLeft :size="20" />
        Volver
      </button>
      <h1 class="page-title">
        <Calendar :size="28" />
        {{ isEditMode ? 'Editar Bloque' : 'Agendar Nuevo Bloque' }}
      </h1>
    </div>

    <!-- Formulario -->
    <div class="form-container">
      <BaseCard padding="lg" elevated>
        
        <!-- Fecha y Hora -->
        <div class="form-section">
          <h3 class="section-title">📅 Fecha y Hora</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="fecha">Fecha del bloque</label>
              <input 
                type="date" 
                id="fecha"
                v-model="formData.fecha"
                :min="getTodayDate()"
                required
              />
            </div>
            <div class="form-group">
              <label for="hora">Hora de inicio</label>
              <input 
                type="time" 
                id="hora"
                v-model="formData.hora"
                required
              />
            </div>
          </div>
        </div>

        <!-- Detalles del Bloque -->
        <div class="form-section">
          <h3 class="section-title">📦 Detalles del Bloque</h3>
          
          <div class="form-group">
            <label for="warehouse">Warehouse</label>
            <select id="warehouse" v-model="formData.warehouse">
              <option v-for="wh in warehouses" :key="wh.code" :value="wh.code">
                {{ wh.code }} - {{ wh.address }}
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="duracion">Duración (horas)</label>
              <select id="duracion" v-model.number="formData.duracion_horas">
                <option v-for="d in DURACION_OPTIONS" :key="d" :value="d">
                  {{ d }} horas
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="pago">Pago ($)</label>
              <input 
                type="number" 
                id="pago"
                v-model.number="formData.pago"
                placeholder="70.50"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="vehiculo">Vehículo</label>
            <select id="vehiculo" v-model="formData.vehiculo">
              <option value="" disabled>Selecciona un vehículo</option>
              <option 
                v-for="vehicle in vehicles" 
                :key="vehicle.id" 
                :value="vehicle.id"
              >
                {{ vehicle.nickname }}{{ vehicle.is_primary ? ' ⭐' : '' }}
              </option>
            </select>
          </div>

        <!-- Notas Opcionales -->
        <div class="form-section">
          <h3 class="section-title">📝 Notas (Opcional)</h3>
          <div class="form-group">
            <textarea 
              v-model="formData.notes"
              placeholder="Ej: Llevar agua extra, verificar gasolina..."
              rows="3"
            ></textarea>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div class="form-actions">
          <BaseButton 
            variant="secondary" 
            size="lg"
            @click="goBack"
            :disabled="isSaving"
          >
            Cancelar
          </BaseButton>
          
          <BaseButton 
            variant="primary" 
            size="lg"
            @click="saveBlock"
            :loading="isSaving"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Agendar Bloque') }}
          </BaseButton>
        </div>

        <!-- Status Message -->
        <div 
          v-if="saveStatus" 
          :class="['status-message', saveStatus.success ? 'status-success' : 'status-error']"
        >
          {{ saveStatus.message }}
        </div>

      </BaseCard>
    </div>

  </div>
</template>

<style scoped>
/* ==================== LAYOUT ==================== */
.schedule-view {
  min-height: 100vh;
  background-color: var(--bg-primary);
  padding-bottom: calc(var(--bottom-nav-height) + var(--space-4));
}

.header-section {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: var(--space-4);
}

.back-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background-color: transparent;
  border: none;
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
  margin-bottom: var(--space-3);
}

.back-button:hover {
  background-color: var(--bg-secondary);
}

.page-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.form-container {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* ==================== FORM SECTIONS ==================== */
.form-section {
  padding-bottom: var(--space-5);
  margin-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-secondary);
}

.form-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-4) 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

/* ==================== FORM INPUTS ==================== */
input[type="date"],
input[type="time"],
input[type="number"],
select,
textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  color: var(--text-primary);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-xs);
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), var(--shadow-sm);
}

input:hover:not(:disabled),
select:hover:not(:disabled),
textarea:hover:not(:disabled) {
  border-color: var(--brand-primary);
}

input:disabled,
select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--bg-tertiary);
}

textarea {
  resize: vertical;
  min-height: 80px;
  line-height: var(--leading-relaxed);
  font-family: inherit;
}

/* ==================== FORM ACTIONS ==================== */
.form-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.form-actions button {
  flex: 1;
}

/* ==================== STATUS MESSAGE ==================== */
.status-message {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  font-weight: var(--font-medium);
  text-align: center;
  animation: slideDown 0.3s var(--ease-out);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-success {
  background-color: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success);
}

.status-error {
  background-color: var(--error-bg);
  color: var(--error);
  border: 1px solid var(--error);
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .page-title {
    font-size: var(--text-xl);
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
<script setup>
import { ref, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { fetchWithAuth } from '@/lib/api';
import { 
  TrendingUp, MapPin, DollarSign, Clock, 
  Activity, Award, Truck 
} from 'lucide-vue-next';

const { userId } = useAuth();
const stats = ref(null);
const isLoading = ref(true);
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

onMounted(async () => {
  try {
    const res = await fetchWithAuth(`${backendUrl}/api/driver-stats/${userId.value}`);
    const data = await res.json();
    if (!data.empty) {
      stats.value = data;
    }
  } catch (e) {
    console.error("Error fetching nerd stats:", e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="nerd-view">
    <h1 class="page-title">🤓 Nerd Stats</h1>

    <div v-if="isLoading" class="loading">Cargando datos...</div>

    <div v-else-if="stats" class="content">
      
      <section class="profile-section">
        <h3 class="section-title">Driver Profile</h3>
        <div class="profile-grid">
          
          <div class="stat-card highlight">
            <div class="icon-box"><MapPin size="20" /></div>
            <div class="stat-info">
              <span class="label">Top City</span>
              <span class="value">{{ stats.lifetime.favCity }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="icon-box"><Truck size="20" /></div>
            <div class="stat-info">
              <span class="label">Fav Warehouse</span>
              <span class="value">{{ stats.lifetime.favWh }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="icon-box"><Activity size="20" /></div>
            <div class="stat-info">
              <span class="label">Avg Miles/Block</span>
              <span class="value">{{ stats.lifetime.avgMilesBlock }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="icon-box"><Award size="20" /></div>
            <div class="stat-info">
              <span class="label">Total Blocks</span>
              <span class="value">{{ stats.lifetime.totalRoutes }}</span>
            </div>
          </div>

        </div>
      </section>

      <section class="metrics-section">
        <h3 class="section-title">Last 6 Weeks Performance</h3>
        
        <div class="money-card">
          <span class="money-label">Total Income</span>
          <span class="money-value">${{ stats.recent.money }}</span>
          <div class="money-pills">
            <span class="pill green">💵 ${{ stats.recent.realHourly }}/hr (Real)</span>
            <span class="pill blue">⛽ ${{ stats.recent.dollarsPerMile }}/mi</span>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-box">
            <span class="m-val">{{ stats.recent.miles }}</span>
            <span class="m-lbl">Total Miles</span>
          </div>
          <div class="metric-box">
            <span class="m-val">{{ stats.recent.workMiles }}</span>
            <span class="m-lbl">Work Miles</span>
          </div>
          <div class="metric-box">
            <span class="m-val">{{ stats.recent.hours }}h</span>
            <span class="m-lbl">Real Hours</span>
          </div>
          <div class="metric-box">
            <span class="m-val">{{ stats.recent.count }}</span>
            <span class="m-lbl">Blocks Done</span>
          </div>
        </div>
      </section>

    </div>

    <div v-else class="empty-state">
      <p>No hay suficientes datos para generar estadísticas nerd 🤓</p>
      <small>Completa algunos bloques primero.</small>
    </div>
  </div>
</template>

<style scoped>
.nerd-view {
  padding: 20px;
  padding-bottom: 80px; /* Espacio para el nav */
  background-color: var(--bg-primary);
  min-height: 100vh;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 25px;
}

.section-title {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-secondary);
  margin-bottom: 15px;
  font-weight: 700;
}

/* --- PROFILE GRID --- */
.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 30px;
}

.stat-card {
  background: var(--bg-secondary);
  padding: 15px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--border-primary);
}

.stat-card.highlight {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  border-color: rgba(59, 130, 246, 0.3);
}

.icon-box {
  color: var(--brand-primary);
  opacity: 0.8;
}

.stat-info { display: flex; flex-direction: column; }
.label { font-size: 0.75rem; color: var(--text-tertiary); }
.value { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* --- MONEY CARD --- */
.money-card {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 25px;
  border-radius: 20px;
  color: white;
  text-align: center;
  margin-bottom: 20px;
  box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
}

.money-label { display: block; font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px; }
.money-value { display: block; font-size: 2.8rem; font-weight: 900; line-height: 1; margin-bottom: 15px; }

.money-pills { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.pill { 
  font-size: 0.8rem; padding: 6px 12px; border-radius: 20px; font-weight: 600; 
  background: rgba(255,255,255,0.2); backdrop-filter: blur(5px);
}

/* --- METRICS GRID --- */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.metric-box {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 12px 5px;
  text-align: center;
  border: 1px solid var(--border-primary);
}

.m-val { display: block; font-size: 1.1rem; font-weight: 800; color: var(--text-primary); }
.m-lbl { display: block; font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px; }

.loading, .empty-state { text-align: center; padding: 40px; color: var(--text-secondary); }
</style>
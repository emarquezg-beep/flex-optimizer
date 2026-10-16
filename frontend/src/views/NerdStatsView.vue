<script setup>
import { ref, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { fetchWithAuth } from '@/lib/api';
import { 
  TrendingUp, MapPin, DollarSign, Clock, 
  Activity, Award, Truck, Download
} from 'lucide-vue-next';

const { userId } = useAuth();
const stats = ref(null);
const isLoading = ref(true);
const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const isDownloading = ref(false);

const downloadTaxReport = async () => {
  isDownloading.value = true;
  try {
    const res = await fetchWithAuth(
      `${backendUrl}/api/tax-report-spouse/2025`,
      { method: 'GET' }
    );
    
    if (!res.ok) throw new Error('Error generando reporte');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlexPilot_Tax_Report_2025.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error descargando reporte:', error);
    alert('Error generando el reporte. Intenta de nuevo.');
  } finally {
    isDownloading.value = false;
  }
};

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
// Forzando nuevo commit
// Helper para fecha
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  // Ajuste de zona horaria simple para evitar que se atrase un día
  const userTimezoneOffset = d.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
  
  return adjustedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
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

        <button 
          class="tax-report-btn" 
          @click="downloadTaxReport"
          :disabled="isDownloading"
        >
          <Download :size="18" />
          <span v-if="!isDownloading">📄 Download 2025 Tax Report</span>
          <span v-else>Generating PDF...</span>
        </button>

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
      <section class="history-section">
        <h3 class="section-title">Weekly Breakdown</h3>
        
        <div class="weekly-list">
          <div class="list-header">
            <span>Week Of</span>
            <span>Blocks</span>
            <span>Hrs</span>
            <span class="text-right">Earnings</span>
          </div>

          <div v-for="(week, index) in stats.history" :key="index" class="week-row">
            <div class="col-date">
              <span class="date">{{ formatDate(week.weekStart) }}</span>
              <span class="sub-date">${{ week.hourly }}/h</span>
            </div>
            <div class="col-stat">{{ week.count }}</div>
            <div class="col-stat">{{ week.hours }}</div>
            <div class="col-money text-right">
              <span class="money">${{ week.money }}</span>
              <span class="miles">{{ week.miles }} mi</span>
            </div>
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

/* --- HISTORY SECTION --- */
.history-section {
  margin-top: 30px;
}

.weekly-list {
  background: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  overflow: hidden;
}

.list-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 2fr;
  padding: 15px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--border-primary);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.week-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 2fr;
  padding: 15px;
  border-bottom: 1px solid var(--border-secondary);
  align-items: center;
}

.week-row:last-child { border-bottom: none; }

.col-date { display: flex; flex-direction: column; }
.date { font-weight: 700; color: var(--text-primary); }
.sub-date { font-size: 0.75rem; color: var(--brand-primary); }

.col-stat { color: var(--text-secondary); font-weight: 500; }

.col-money { display: flex; flex-direction: column; }
.text-right { text-align: right; }
.money { font-weight: 800; color: #10b981; font-size: 1rem; }
.miles { font-size: 0.75rem; color: var(--text-tertiary); }

/* --- TAX REPORT BUTTON --- */
.tax-report-btn {
  width: 100%;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 16px;
  border-radius: 16px;
  font-size: 0.95rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  box-shadow: 0 8px 20px -5px rgba(99, 102, 241, 0.4);
  cursor: pointer;
  transition: all 0.2s;
}

.tax-report-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 25px -5px rgba(99, 102, 241, 0.5);
}

.tax-report-btn:active:not(:disabled) {
  transform: translateY(0);
}

.tax-report-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
<template>
  <div class="financial-slide">
    <h2 class="slide-title">💰 Breakdown Financiero</h2>

    <!-- Net Earnings Hero -->
    <div class="net-earnings-hero">
      <div class="net-label">Ganancia Neta</div>
      <div class="net-amount" :class="netEarningsClass">
        ${{ netEarnings.toFixed(2) }}
      </div>
      <div class="net-subtitle">
        Después de todos los gastos
      </div>
    </div>

    <!-- Income vs Expenses -->
    <div class="income-expenses">
      <div class="section income-section">
        <div class="section-header">
          <span class="section-icon">📈</span>
          <span class="section-title">Ingresos</span>
        </div>
        <div class="amount-row">
          <span class="label">Pago del Bloque</span>
          <span class="value positive">${{ routeData.pago?.toFixed(2) || '0.00' }}</span>
        </div>
        <div class="amount-row">
          <span class="label">Pago por Hora</span>
          <span class="value">${{ routeData.pago_por_hora?.toFixed(2) || '0.00' }}/hr</span>
        </div>
      </div>

      <div class="section expenses-section">
        <div class="section-header">
          <span class="section-icon">📉</span>
          <span class="section-title">Gastos</span>
        </div>
        <div class="amount-row">
          <span class="label">Gasolina</span>
          <span class="value negative">-${{ routeData.gasto_de_gasolina?.toFixed(2) || '0.00' }}</span>
        </div>
        <div class="amount-row">
          <span class="label">Desgaste Vehículo</span>
          <span class="value negative">-${{ routeData.desgaste_vehiculo?.toFixed(2) || '0.00' }}</span>
        </div>
        <div class="amount-row">
          <span class="label">Tax (Estimado)</span>
          <span class="value negative">-${{ routeData.tax?.toFixed(2) || '0.00' }}</span>
        </div>
        <div class="amount-row total-expenses">
          <span class="label">Total Gastos</span>
          <span class="value">-${{ totalExpenses.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Real Hourly Rate -->
    <div class="real-hourly">
      <div class="hourly-comparison">
        <div class="hourly-item">
          <div class="hourly-label">Pagado</div>
          <div class="hourly-value paid">
            ${{ routeData.pago_por_hora?.toFixed(2) || '0.00' }}
          </div>
        </div>
        <div class="hourly-arrow">→</div>
        <div class="hourly-item">
          <div class="hourly-label">Real</div>
          <div class="hourly-value real" :class="hourlyRateClass">
            ${{ routeData.pago_real_por_hora?.toFixed(2) || '0.00' }}
          </div>
        </div>
      </div>
      <div class="hourly-subtitle">
        Por cada hora invertida (incluyendo commutes)
      </div>
    </div>

    <!-- Efficiency Bar -->
    <div class="efficiency-bar">
      <div class="bar-label">Eficiencia del Bloque</div>
      <div class="bar-container">
        <div class="bar-fill" :style="{ width: efficiencyPercentage + '%' }" :class="efficiencyClass"></div>
      </div>
      <div class="bar-percentage">{{ efficiencyPercentage.toFixed(0) }}%</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  routeData: {
    type: Object,
    required: true
  }
})

// Calculations
const totalExpenses = computed(() => {
  return (props.routeData.gasto_de_gasolina || 0) +
         (props.routeData.desgaste_vehiculo || 0) +
         (props.routeData.tax || 0)
})

const netEarnings = computed(() => {
  return (props.routeData.pago || 0) - totalExpenses.value
})

const netEarningsClass = computed(() => {
  const net = netEarnings.value
  const pago = props.routeData.pago || 1
  const percentage = (net / pago) * 100
  
  if (percentage >= 70) return 'net-good'
  if (percentage >= 50) return 'net-medium'
  return 'net-bad'
})

const hourlyRateClass = computed(() => {
  const realRate = props.routeData.pago_real_por_hora || 0
  if (realRate >= 20) return 'rate-good'
  if (realRate >= 15) return 'rate-medium'
  return 'rate-bad'
})

const efficiencyPercentage = computed(() => {
  const pago = props.routeData.pago || 1
  const net = netEarnings.value
  return Math.max(0, Math.min(100, (net / pago) * 100))
})

const efficiencyClass = computed(() => {
  const eff = efficiencyPercentage.value
  if (eff >= 70) return 'efficiency-good'
  if (eff >= 50) return 'efficiency-medium'
  return 'efficiency-bad'
})
</script>

<style scoped>
.financial-slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.slide-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  text-align: center;
  margin: 0 0 8px 0;
}

/* Net Earnings Hero */
.net-earnings-hero {
  text-align: center;
  padding: 24px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16px;
  color: white;
}

.net-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.net-amount {
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  margin: 8px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.net-amount.net-bad {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.net-subtitle {
  font-size: 12px;
  opacity: 0.8;
}

/* Income & Expenses */
.income-expenses {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  border: 2px solid #e2e8f0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.section-icon {
  font-size: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.amount-row .label {
  font-size: 14px;
  color: #64748b;
}

.amount-row .value {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.amount-row .value.positive {
  color: #22c55e;
}

.amount-row .value.negative {
  color: #ef4444;
}

.amount-row.total-expenses {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 2px solid #cbd5e1;
}

.total-expenses .label {
  font-weight: 600;
  color: #1e293b;
}

/* Real Hourly Rate */
.real-hourly {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.hourly-comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 8px;
}

.hourly-item {
  text-align: center;
}

.hourly-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.hourly-value {
  font-size: 28px;
  font-weight: 700;
}

.hourly-value.paid {
  color: #94a3b8;
}

.hourly-value.real.rate-good {
  color: #22c55e;
}

.hourly-value.real.rate-medium {
  color: #f59e0b;
}

.hourly-value.real.rate-bad {
  color: #ef4444;
}

.hourly-arrow {
  font-size: 24px;
  color: #cbd5e1;
}

.hourly-subtitle {
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
}

/* Efficiency Bar */
.efficiency-bar {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.bar-label {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 12px;
  text-align: center;
}

.bar-container {
  width: 100%;
  height: 24px;
  background: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.bar-fill {
  height: 100%;
  transition: width 0.6s ease-out;
  border-radius: 12px;
}

.bar-fill.efficiency-good {
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
}

.bar-fill.efficiency-medium {
  background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
}

.bar-fill.efficiency-bad {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.bar-percentage {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

/* Mobile */
@media (max-width: 640px) {
  .net-amount {
    font-size: 36px;
  }

  .hourly-value {
    font-size: 24px;
  }
}
</style>
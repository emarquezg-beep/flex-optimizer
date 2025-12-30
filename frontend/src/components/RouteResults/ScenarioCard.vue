<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: { type: String, required: true }, // 'normal' | 'alt'
  data: { type: Object, required: true },
  isActive: { type: Boolean, default: false },
  isSolo: { type: Boolean, default: false },
  hasChoice: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const label = computed(() => (props.kind === 'alt' ? (props.data.label || 'AI ROUTE') : 'NORMAL'))

const getStopSummary = (data) => {
  if (!data) return ''
  const apts = data.apartment_count || 0
  const downtown = data.downtown_count || 0
  const totalApts = apts + downtown
  const stops = data.numero_paradas || 0

  let summary = `${stops} stops`
  if (totalApts > 0) {
    summary += ` • ${totalApts} Apts`
    if (downtown > 0) summary += ` (${downtown} DT)`
  }
  return summary
}

const getAriaFactor = (data) => {
  if (!data) return ''
  const mult = data.aria_multiplier || 0.9
  return `x${Number(mult).toFixed(2)}`
}

const onClick = () => {
  if (props.hasChoice) emit('select')
}
</script>

<template>
  <div
    class="scenario"
    :class="{
      'scenario--active': isActive,
      'scenario--solo': isSolo
    }"
    @click="onClick"
    role="button"
    tabindex="0"
  >
    <div class="scenario__badge" :class="{ 'scenario__badge--active': isActive }">
      <span class="scenario__badgeIcon">🤖</span>
      <span class="scenario__badgeVal">{{ getAriaFactor(data) }}</span>
    </div>

    <div class="scenario__top">
      <span v-if="hasChoice" class="scenario__radio" :class="{ 'scenario__radio--on': isActive }"></span>
      <div class="scenario__label">{{ label }}</div>
    </div>

    <div class="scenario__hero">
      <div class="scenario__score">
        <span class="scenario__scoreVal">{{ data.route_score }}</span>
        <span class="scenario__scoreMax">/100</span>
      </div>

      <div
        class="scenario__pill"
        :class="{ 'scenario__pill--accent': ((data.apartment_count||0)+(data.downtown_count||0))>0 }"
      >
        {{ getStopSummary(data) }}
      </div>

      <div class="scenario__calc" v-if="data.calculation_text">{{ data.calculation_text }}</div>
      <div class="scenario__seq" v-if="data.sequence">{{ data.sequence }}</div>
    </div>

    <div class="scenario__stats">
      <div class="scenario__etas">
        <div class="scenario__eta"><span class="k k--opt">Opt</span><strong>{{ data.eta_optimista }}</strong></div>
        <div class="scenario__eta"><span class="k k--nor">Nor</span><strong>{{ data.eta_normal }}</strong></div>
        <div class="scenario__eta"><span class="k k--pes">Pes</span><strong>{{ data.eta_pesimista }}</strong></div>
      </div>

      <div class="scenario__mini">
        <div class="mini">
          <div class="mini__icon">📏</div>
          <div class="mini__val">{{ data.millas_totales }} mi</div>
        </div>
        <div class="mini">
          <div class="mini__icon">💰</div>
          <div class="mini__val">${{ data.pago_real_por_hora }}/h</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card base */
.scenario {
  position: relative;
  height: 100%;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--card-bg, var(--bg-secondary));
  padding: 14px 12px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  color: var(--text-primary);
  opacity: 0.72;
  transition: transform 160ms ease, opacity 160ms ease, border-color 160ms ease;
}

.scenario--active {
  opacity: 1;
  border-color: rgba(255,165,0,0.55);
  transform: translateY(-1px);
}

.scenario--solo {
  opacity: 1;
}

/* Badge */
.scenario__badge {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.08);
}

.scenario__badge--active {
  background: rgba(255,165,0,0.18);
  border-color: rgba(255,165,0,0.28);
}

.scenario__badgeVal {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.2px;
}

/* Top label + radio */
.scenario__top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 6px;
}

.scenario__label {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1.2px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.scenario__radio {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.30);
  display: inline-block;
}

.scenario__radio--on {
  border-color: var(--brand-primary);
  box-shadow: inset 0 0 0 4px var(--brand-primary);
}

/* Hero */
.scenario__hero {
  display: grid;
  place-items: center;
  gap: 10px;
  text-align: center;
}

.scenario__scoreVal {
  font-size: 44px;
  font-weight: 950;
  line-height: 1;
}

.scenario__scoreMax {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.scenario__pill {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  color: var(--text-secondary);
  font-weight: 700;
}

.scenario__pill--accent {
  border-color: rgba(255,165,0,0.22);
  background: rgba(255,165,0,0.12);
  color: rgba(255, 210, 140, 0.95);
}

.scenario__calc {
  width: 92%;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px dashed rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.03);
}

.scenario__seq {
  width: 92%;
  font-size: 10px;
  color: rgba(255,255,255,0.55);
  overflow-wrap: anywhere;
}

/* Stats */
.scenario__stats {
  display: grid;
  gap: 10px;
}

.scenario__etas {
  display: grid;
  gap: 6px;
}

.scenario__eta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px dashed rgba(255,255,255,0.10);
  font-size: 12px;
}

.scenario__eta:last-child {
  border-bottom: none;
}

.scenario__eta strong {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
}

.k { font-weight: 800; }
.k--opt { color: #22c55e; }
.k--nor { color: #f59e0b; }
.k--pes { color: #ef4444; }

/* Mini cards */
.scenario__mini {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mini {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  padding: 10px;
  display: grid;
  gap: 4px;
  place-items: center;
}

.mini__icon { font-size: 16px; }
.mini__val { font-size: 13px; font-weight: 900; }
</style>

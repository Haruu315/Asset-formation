import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const formatYen = (value) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value)

const formatYenShort = (value) => {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億円`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}万円`
  return `${value.toLocaleString('ja-JP')}円`
}

function InputField({ label, value, onChange, min, max, step, unit, description }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-right text-gray-800 text-lg font-semibold focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
        />
        <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100 px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}年目</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatYen(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function App() {
  const [principal, setPrincipal] = useState(1000000)
  const [rate, setRate] = useState(5)
  const [years, setYears] = useState(20)

  const data = useMemo(() => {
    const rows = []
    for (let y = 0; y <= years; y++) {
      const total = Math.round(principal * Math.pow(1 + rate / 100, y))
      const interest = total - principal
      rows.push({ year: y, 元本: principal, 利息: interest, 合計: total })
    }
    return rows
  }, [principal, rate, years])

  const finalAmount = data[data.length - 1]?.合計 ?? 0
  const totalInterest = finalAmount - principal
  const interestRatio = principal > 0 ? ((totalInterest / principal) * 100).toFixed(1) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">複利計算シミュレーター</h1>
          <p className="text-gray-500 mt-2 text-sm">元本・年利・運用年数を入力して資産推移を確認</p>
        </div>

        {/* 入力カード */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">条件を入力</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <InputField
              label="元本"
              value={principal}
              onChange={setPrincipal}
              min={0}
              step={10000}
              unit="円"
              description="最初に投資する金額"
            />
            <InputField
              label="年利"
              value={rate}
              onChange={setRate}
              min={0}
              max={100}
              step={0.1}
              unit="%"
              description="1年あたりの利回り"
            />
            <InputField
              label="運用年数"
              value={years}
              onChange={setYears}
              min={1}
              max={100}
              step={1}
              unit="年"
              description="運用を続ける期間"
            />
          </div>
        </div>

        {/* 結果サマリー */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">元本</p>
            <p className="text-xl font-bold text-gray-700">{formatYenShort(principal)}</p>
          </div>
          <div className="bg-blue-500 rounded-2xl shadow-sm p-5 text-center">
            <p className="text-xs text-blue-100 mb-1">最終金額</p>
            <p className="text-xl font-bold text-white">{formatYenShort(finalAmount)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">利息合計</p>
            <p className="text-xl font-bold text-emerald-600">+{formatYenShort(totalInterest)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{interestRatio}% 増</p>
          </div>
        </div>

        {/* グラフ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-5">年ごとの資産推移</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="year"
                tickFormatter={(v) => `${v}年`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYenShort}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="元本"
                stackId="1"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradPrincipal)"
              />
              <Area
                type="monotone"
                dataKey="利息"
                stackId="1"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradInterest)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* フッター */}
        <p className="text-center text-xs text-gray-400 mt-6">
          ※ このシミュレーターは概算です。実際の運用成果を保証するものではありません。
        </p>
      </div>
    </div>
  )
}

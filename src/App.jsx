import { useState, useMemo, useRef } from 'react'
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

function SmallInput({ value, onChange, min, max, step, unit, align = 'right', className = '' }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-gray-800 font-semibold focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
        style={{ textAlign: align }}
      />
      {unit && <span className="text-sm text-gray-400 whitespace-nowrap">{unit}</span>}
    </div>
  )
}

function BasicInput({ label, value, onChange, min, max, step, unit }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-right text-gray-800 text-base font-semibold focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
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
      <p className="font-semibold text-gray-700 mb-1">{label}歳</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatYen(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function App() {
  const [currentAge, setCurrentAge] = useState(25)
  const [currentAssets, setCurrentAssets] = useState(500_000)
  const [rate, setRate] = useState(5)
  const [targetAge, setTargetAge] = useState(65)
  const nextId = useRef(4)
  const [brackets, setBrackets] = useState([
    { id: 1, fromAge: 25, toAge: 29, monthlyAmount: 30_000 },
    { id: 2, fromAge: 30, toAge: 39, monthlyAmount: 50_000 },
    { id: 3, fromAge: 40, toAge: 65, monthlyAmount: 80_000 },
  ])

  const addBracket = () => {
    setBrackets((prev) => [
      ...prev,
      { id: nextId.current++, fromAge: currentAge, toAge: targetAge, monthlyAmount: 30_000 },
    ])
  }

  const removeBracket = (id) => setBrackets((prev) => prev.filter((b) => b.id !== id))

  const updateBracket = (id, field, value) =>
    setBrackets((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)))

  const data = useMemo(() => {
    if (targetAge <= currentAge) return []
    const monthlyRate = rate / 100 / 12
    let assets = currentAssets
    let totalInvested = currentAssets
    const rows = [
      { age: currentAge, 累計投資額: Math.round(totalInvested), 運用益: 0, 合計: Math.round(assets) },
    ]

    for (let age = currentAge; age < targetAge; age++) {
      const bracket = brackets.find((b) => age >= b.fromAge && age <= b.toAge)
      const monthly = bracket ? bracket.monthlyAmount : 0
      for (let m = 0; m < 12; m++) {
        assets = assets * (1 + monthlyRate) + monthly
        totalInvested += monthly
      }
      const gains = assets - totalInvested
      rows.push({
        age: age + 1,
        累計投資額: Math.round(totalInvested),
        運用益: Math.round(Math.max(0, gains)),
        合計: Math.round(assets),
      })
    }
    return rows
  }, [currentAge, currentAssets, rate, targetAge, brackets])

  const last = data[data.length - 1]
  const finalAmount = last?.合計 ?? 0
  const totalInvested = last?.累計投資額 ?? 0
  const totalGains = Math.max(0, finalAmount - totalInvested)
  const gainsRatio = totalInvested > 0 ? ((totalGains / totalInvested) * 100).toFixed(1) : '0.0'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">積立投資シミュレーター</h1>
          <p className="text-gray-500 mt-2 text-sm">年齢ごとの積立額を設定して将来の資産推移を確認</p>
        </div>

        {/* 基本設定 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">基本設定</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <BasicInput label="現在の年齢" value={currentAge} onChange={setCurrentAge} min={10} max={80} step={1} unit="歳" />
            <BasicInput label="現在の資産" value={currentAssets} onChange={setCurrentAssets} min={0} step={10000} unit="円" />
            <BasicInput label="想定年利" value={rate} onChange={setRate} min={0} max={30} step={0.1} unit="%" />
            <BasicInput label="目標年齢" value={targetAge} onChange={(v) => setTargetAge(Math.max(currentAge + 1, v))} min={currentAge + 1} max={100} step={1} unit="歳" />
          </div>
        </div>

        {/* 年齢別積立額 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700">年齢別 毎月の積立額</h2>
              <p className="text-xs text-gray-400 mt-0.5">年齢が重複する場合は上のルールが優先されます</p>
            </div>
            <button
              onClick={addBracket}
              className="text-sm font-medium text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
            >
              + 追加
            </button>
          </div>

          {brackets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">「+ 追加」で積立期間を設定してください</p>
          ) : (
            <div className="space-y-2">
              {/* ヘッダー */}
              <div className="grid grid-cols-[1fr_auto_1fr_auto_2fr_auto_auto] items-center gap-2 px-1">
                <span className="text-xs text-gray-400 text-center">開始年齢</span>
                <span />
                <span className="text-xs text-gray-400 text-center">終了年齢</span>
                <span />
                <span className="text-xs text-gray-400 text-right pr-1">月額積立</span>
                <span />
                <span />
              </div>

              {brackets.map((b) => (
                <div
                  key={b.id}
                  className="grid grid-cols-[1fr_auto_1fr_auto_2fr_auto_auto] items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
                >
                  <SmallInput
                    value={b.fromAge}
                    onChange={(v) => updateBracket(b.id, 'fromAge', v)}
                    min={10}
                    max={100}
                    step={1}
                    align="center"
                  />
                  <span className="text-gray-400 text-sm">〜</span>
                  <SmallInput
                    value={b.toAge}
                    onChange={(v) => updateBracket(b.id, 'toAge', v)}
                    min={10}
                    max={100}
                    step={1}
                    align="center"
                    unit="歳"
                  />
                  <span className="text-gray-300 text-sm">|</span>
                  <SmallInput
                    value={b.monthlyAmount}
                    onChange={(v) => updateBracket(b.id, 'monthlyAmount', v)}
                    min={0}
                    step={1000}
                    unit="円/月"
                  />
                  <span />
                  <button
                    onClick={() => removeBracket(b.id)}
                    className="text-gray-300 hover:text-red-400 transition text-xl leading-none w-6 h-6 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">累計投資額</p>
            <p className="text-xl font-bold text-gray-700">{formatYenShort(totalInvested)}</p>
          </div>
          <div className="bg-blue-500 rounded-2xl shadow-sm p-5 text-center">
            <p className="text-xs text-blue-100 mb-1">最終資産（{targetAge}歳）</p>
            <p className="text-xl font-bold text-white">{formatYenShort(finalAmount)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">運用益</p>
            <p className="text-xl font-bold text-emerald-600">+{formatYenShort(totalGains)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{gainsRatio}% 増</p>
          </div>
        </div>

        {/* グラフ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-5">年齢別 資産推移</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradGains" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="age"
                tickFormatter={(v) => `${v}歳`}
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
                dataKey="累計投資額"
                stackId="1"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradInvested)"
              />
              <Area
                type="monotone"
                dataKey="運用益"
                stackId="1"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradGains)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ※ このシミュレーターは概算です。実際の運用成果を保証するものではありません。
        </p>
      </div>
    </div>
  )
}

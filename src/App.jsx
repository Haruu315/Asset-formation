import { useState, useMemo, useRef } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const NISA_LIMIT = 18_000_000

const formatYen = (value) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value)

const formatYenShort = (value) => {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億円`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}万円`
  return `${value.toLocaleString('ja-JP')}円`
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

function SmallInput({ value, onChange, min, max, step, unit, align = 'right' }) {
  return (
    <div className="flex items-center gap-1">
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100 px-4 py-3 text-sm min-w-52">
      <p className="font-semibold text-gray-700 mb-2">{label}歳</p>
      {payload.map((p) =>
        p.value > 0 ? (
          <p key={p.dataKey} style={{ color: p.fill }} className="font-medium">
            {p.name}: {formatYen(p.value)}
          </p>
        ) : null
      )}
      <p className="font-semibold text-gray-700 mt-1.5 pt-1.5 border-t border-gray-100">
        合計: {formatYen(total)}
      </p>
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

  const addBracket = () =>
    setBrackets((prev) => [
      ...prev,
      { id: nextId.current++, fromAge: currentAge, toAge: targetAge, monthlyAmount: 30_000 },
    ])
  const removeBracket = (id) => setBrackets((prev) => prev.filter((b) => b.id !== id))
  const updateBracket = (id, field, value) =>
    setBrackets((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)))

  const data = useMemo(() => {
    if (targetAge <= currentAge) return []
    const monthlyRate = rate / 100 / 12

    let nisaInvested = Math.min(currentAssets, NISA_LIMIT)
    let taxableInvested = Math.max(0, currentAssets - NISA_LIMIT)
    let nisaAssets = nisaInvested
    let taxableAssets = taxableInvested

    const makeRow = (age) => ({
      age,
      NISA投資額: Math.round(nisaInvested),
      NISA運用益: Math.round(Math.max(0, nisaAssets - nisaInvested)),
      特定口座投資額: Math.round(taxableInvested),
      特定口座運用益: Math.round(Math.max(0, taxableAssets - taxableInvested)),
    })

    const rows = [makeRow(currentAge)]

    for (let age = currentAge; age < targetAge; age++) {
      const bracket = brackets.find((b) => age >= b.fromAge && age <= b.toAge)
      const monthly = bracket ? bracket.monthlyAmount : 0

      for (let m = 0; m < 12; m++) {
        nisaAssets *= 1 + monthlyRate
        taxableAssets *= 1 + monthlyRate

        const nisaRoom = Math.max(0, NISA_LIMIT - nisaInvested)
        const nisaContrib = Math.min(monthly, nisaRoom)
        const taxableContrib = monthly - nisaContrib

        nisaAssets += nisaContrib
        nisaInvested += nisaContrib
        taxableAssets += taxableContrib
        taxableInvested += taxableContrib
      }

      rows.push(makeRow(age + 1))
    }

    return rows
  }, [currentAge, currentAssets, rate, targetAge, brackets])

  const last = data[data.length - 1]
  const nisaFinal = (last?.NISA投資額 ?? 0) + (last?.NISA運用益 ?? 0)
  const taxableFinal = (last?.特定口座投資額 ?? 0) + (last?.特定口座運用益 ?? 0)
  const totalFinal = nisaFinal + taxableFinal
  const totalInvested = (last?.NISA投資額 ?? 0) + (last?.特定口座投資額 ?? 0)
  const nisaUsed = last?.NISA投資額 ?? 0
  const nisaFillPct = Math.min(100, (nisaUsed / NISA_LIMIT) * 100).toFixed(0)
  const [filter, setFilter] = useState('both') // 'both' | 'nisa' | 'taxable'
  const showNisa = filter !== 'taxable'
  const showTaxable = filter !== 'nisa'

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
              <p className="text-xs text-gray-400 mt-0.5">NISAを優先して埋め、1800万円超過分は特定口座へ</p>
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
                  <SmallInput value={b.fromAge} onChange={(v) => updateBracket(b.id, 'fromAge', v)} min={10} max={100} step={1} align="center" />
                  <span className="text-gray-400 text-sm">〜</span>
                  <SmallInput value={b.toAge} onChange={(v) => updateBracket(b.id, 'toAge', v)} min={10} max={100} step={1} align="center" unit="歳" />
                  <span className="text-gray-300 text-sm">|</span>
                  <SmallInput value={b.monthlyAmount} onChange={(v) => updateBracket(b.id, 'monthlyAmount', v)} min={0} step={1000} unit="円/月" />
                  <span />
                  <button onClick={() => removeBracket(b.id)} className="text-gray-300 hover:text-red-400 transition text-xl leading-none w-6 h-6 flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}

          {/* NISA枠ステータス */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-blue-600">新NISA枠 使用状況（{targetAge}歳時点）</span>
              <span className="text-xs font-semibold text-blue-700">{formatYenShort(nisaUsed)} / 1800万円</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${nisaFillPct}%` }}
              />
            </div>
            <p className="text-right text-xs text-blue-400 mt-1">{nisaFillPct}% 使用</p>
          </div>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <p className="text-xs text-gray-400">NISA最終資産</p>
            </div>
            <p className="text-xl font-bold text-blue-600">{formatYenShort(nisaFinal)}</p>
          </div>
          <div className="bg-indigo-500 rounded-2xl shadow-sm p-5 text-center">
            <p className="text-xs text-indigo-100 mb-1">合計最終資産（{targetAge}歳）</p>
            <p className="text-xl font-bold text-white">{formatYenShort(totalFinal)}</p>
            <p className="text-xs text-indigo-200 mt-0.5">投資元本 {formatYenShort(totalInvested)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <p className="text-xs text-gray-400">特定口座最終資産</p>
            </div>
            <p className="text-xl font-bold text-amber-500">{formatYenShort(taxableFinal)}</p>
          </div>
        </div>

        {/* グラフ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-700">年齢別 資産推移</h2>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { key: 'both', label: '両方' },
                { key: 'nisa', label: 'NISA', color: 'blue' },
                { key: 'taxable', label: '特定口座', color: 'amber' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    filter === key
                      ? key === 'nisa'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : key === 'taxable'
                        ? 'bg-amber-400 text-white shadow-sm'
                        : 'bg-white text-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="age"
                tickFormatter={(v) => `${v}歳`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatYenShort}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              {showNisa && <Bar dataKey="NISA投資額" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />}
              {showNisa && <Bar dataKey="NISA運用益" stackId="a" fill="#93c5fd" radius={showTaxable ? [0, 0, 0, 0] : [4, 4, 0, 0]} />}
              {showTaxable && <Bar dataKey="特定口座投資額" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />}
              {showTaxable && <Bar dataKey="特定口座運用益" stackId="a" fill="#fcd34d" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ※ このシミュレーターは概算です。実際の運用成果を保証するものではありません。
        </p>
      </div>
    </div>
  )
}

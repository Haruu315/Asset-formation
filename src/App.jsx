import { useState, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const NISA_LIMIT = 18_000_000
const TAX_RATE = 0.20315
const STORAGE_KEY = 'invest-sim-v1'

const formatYen = (v) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v)

const formatYenShort = (v) => {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億円`
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}万円`
  return `${v.toLocaleString('ja-JP')}円`
}

const xInterval = (range) => (range <= 15 ? 1 : range <= 30 ? 4 : 9)

function BasicInput({ label, value, onChange, min, max, step, unit, note }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
          min={min} max={max} step={step}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-right text-gray-800 text-base font-semibold focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
        />
        <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>
      </div>
      {note && <p className="text-xs text-blue-500">{note}</p>}
    </div>
  )
}

function SmallInput({ value, onChange, min, max, step, unit, align = 'right' }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        min={min} max={max} step={step}
        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-gray-800 font-semibold focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
        style={{ textAlign: align }}
      />
      {unit && <span className="text-sm text-gray-400 whitespace-nowrap">{unit}</span>}
    </div>
  )
}

function ChartTooltip({ active, payload, label, totalLabel = '合計' }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100 px-4 py-3 text-sm min-w-52">
      <p className="font-semibold text-gray-700 mb-2">{label}歳</p>
      {payload.map((p) => p.value > 0 ? (
        <p key={p.dataKey} style={{ color: p.fill }} className="font-medium">
          {p.name}: {formatYen(p.value)}
        </p>
      ) : null)}
      <p className="font-semibold text-gray-700 mt-1.5 pt-1.5 border-t border-gray-100">
        {totalLabel}: {formatYen(total)}
      </p>
    </div>
  )
}

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function DataTable({ rows, columns, label }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition">
        <span>{open ? '▲' : '▼'}</span> {label}（{rows.length}行）
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(c => (
                  <th key={c.key} className="px-3 py-2 text-right text-gray-500 font-medium first:text-left whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  {columns.map(c => (
                    <td key={c.key} className="px-3 py-2 text-right text-gray-700 first:text-left font-medium whitespace-nowrap">{row[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const DEFAULT_BRACKETS = [
  { id: 1, fromAge: 25, toAge: 29, monthlyAmount: 30_000 },
  { id: 2, fromAge: 30, toAge: 39, monthlyAmount: 50_000 },
  { id: 3, fromAge: 40, toAge: 65, monthlyAmount: 80_000 },
]

export default function App() {
  const [saved] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
  })

  const [currentAge, setCurrentAge] = useState(saved.currentAge ?? 25)
  const [currentAssets, setCurrentAssets] = useState(saved.currentAssets ?? 500_000)
  const [nominalRate, setNominalRate] = useState(saved.nominalRate ?? 5)
  const [inflationRate, setInflationRate] = useState(saved.inflationRate ?? 2)
  const [targetAge, setTargetAge] = useState(saved.targetAge ?? 65)
  const [brackets, setBrackets] = useState(saved.brackets ?? DEFAULT_BRACKETS)
  const [filter, setFilter] = useState(saved.filter ?? 'both')
  const [showAfterTax, setShowAfterTax] = useState(saved.showAfterTax ?? false)
  const [withdrawalEnabled, setWithdrawalEnabled] = useState(saved.withdrawalEnabled ?? false)
  const [withdrawalEndAge, setWithdrawalEndAge] = useState(saved.withdrawalEndAge ?? 90)
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(saved.monthlyWithdrawal ?? 200_000)
  const [withdrawalOrder, setWithdrawalOrder] = useState(saved.withdrawalOrder ?? 'taxable_first')
  const [withdrawalIncreaseRate, setWithdrawalIncreaseRate] = useState(saved.withdrawalIncreaseRate ?? 0)

  const nextId = useRef(null)
  if (nextId.current === null) {
    nextId.current = brackets.length ? Math.max(...brackets.map(b => b.id)) + 1 : 4
  }

  // 設定をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      currentAge, currentAssets, nominalRate, inflationRate, targetAge, brackets,
      filter, showAfterTax, withdrawalEnabled, withdrawalEndAge,
      monthlyWithdrawal, withdrawalOrder, withdrawalIncreaseRate,
    }))
  }, [currentAge, currentAssets, nominalRate, inflationRate, targetAge, brackets,
    filter, showAfterTax, withdrawalEnabled, withdrawalEndAge,
    monthlyWithdrawal, withdrawalOrder, withdrawalIncreaseRate])

  const effectiveRate = nominalRate - inflationRate

  const addBracket = () => setBrackets(p => [...p, { id: nextId.current++, fromAge: currentAge, toAge: targetAge, monthlyAmount: 30_000 }])
  const removeBracket = (id) => setBrackets(p => p.filter(b => b.id !== id))
  const updateBracket = (id, field, value) => setBrackets(p => p.map(b => b.id === id ? { ...b, [field]: value } : b))

  // 積み立て計算
  const { data, finalNisaAssets, finalTaxableAssets, finalTaxableCostBasis } = useMemo(() => {
    if (targetAge <= currentAge) return { data: [], finalNisaAssets: 0, finalTaxableAssets: 0, finalTaxableCostBasis: 0 }
    const mr = effectiveRate / 100 / 12
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
      const bracket = brackets.find(b => age >= b.fromAge && age <= b.toAge)
      const monthly = bracket ? bracket.monthlyAmount : 0
      for (let m = 0; m < 12; m++) {
        nisaAssets *= 1 + mr
        taxableAssets *= 1 + mr
        const nisaRoom = Math.max(0, NISA_LIMIT - nisaInvested)
        const nisaContrib = Math.min(monthly, nisaRoom)
        const taxableContrib = monthly - nisaContrib
        nisaAssets += nisaContrib; nisaInvested += nisaContrib
        taxableAssets += taxableContrib; taxableInvested += taxableContrib
      }
      rows.push(makeRow(age + 1))
    }
    return { data: rows, finalNisaAssets: nisaAssets, finalTaxableAssets: taxableAssets, finalTaxableCostBasis: taxableInvested }
  }, [currentAge, currentAssets, effectiveRate, targetAge, brackets])

  // 取り崩し計算
  const withdrawalData = useMemo(() => {
    if (!withdrawalEnabled || withdrawalEndAge <= targetAge) return []
    const mr = effectiveRate / 100 / 12
    let nisa = finalNisaAssets
    let taxable = finalTaxableAssets

    const rows = [{ age: targetAge, NISA残高: Math.round(nisa), 特定口座残高: Math.round(taxable) }]
    for (let age = targetAge; age < withdrawalEndAge; age++) {
      const monthlyW = monthlyWithdrawal * Math.pow(1 + withdrawalIncreaseRate / 100, age - targetAge)
      for (let m = 0; m < 12; m++) {
        nisa *= 1 + mr
        taxable *= 1 + mr
        let rem = monthlyW
        if (withdrawalOrder === 'taxable_first') {
          const tw = Math.min(rem, taxable); taxable -= tw; rem -= tw
          nisa -= Math.min(rem, nisa)
        } else {
          const nw = Math.min(rem, nisa); nisa -= nw; rem -= nw
          taxable -= Math.min(rem, taxable)
        }
        nisa = Math.max(0, nisa)
        taxable = Math.max(0, taxable)
      }
      rows.push({ age: age + 1, NISA残高: Math.round(nisa), 特定口座残高: Math.round(taxable) })
    }
    return rows
  }, [withdrawalEnabled, withdrawalEndAge, monthlyWithdrawal, withdrawalOrder, withdrawalIncreaseRate, effectiveRate, finalNisaAssets, finalTaxableAssets, targetAge])

  // 積み立てサマリー
  const last = data[data.length - 1]
  const nisaFinal = (last?.NISA投資額 ?? 0) + (last?.NISA運用益 ?? 0)
  const taxableGross = (last?.特定口座投資額 ?? 0) + (last?.特定口座運用益 ?? 0)
  const taxableNet = (last?.特定口座投資額 ?? 0) + (last?.特定口座運用益 ?? 0) * (1 - TAX_RATE)
  const taxableFinal = showAfterTax ? taxableNet : taxableGross
  const totalFinal = nisaFinal + taxableFinal
  const totalInvested = (last?.NISA投資額 ?? 0) + (last?.特定口座投資額 ?? 0)
  const nisaUsed = last?.NISA投資額 ?? 0
  const nisaFillPct = Math.min(100, (nisaUsed / NISA_LIMIT) * 100).toFixed(0)

  // グラフ用データ（税引き後表示対応）
  const chartData = useMemo(() => showAfterTax
    ? data.map(r => ({ ...r, 特定口座運用益: Math.round(r.特定口座運用益 * (1 - TAX_RATE)) }))
    : data
  , [data, showAfterTax])

  // 取り崩しサマリー
  const depletionAge = withdrawalData.find(d => d.NISA残高 + d.特定口座残高 === 0)?.age ?? null
  const lastW = withdrawalData[withdrawalData.length - 1]
  const finalWithdrawalTotal = (lastW?.NISA残高 ?? 0) + (lastW?.特定口座残高 ?? 0)
  const sustainableMonthly = Math.round((finalNisaAssets + finalTaxableAssets) * (effectiveRate / 100 / 12))
  const totalWithdrawalAmount = (() => {
    if (!withdrawalData.length) return 0
    let total = 0
    for (let i = 0; i < withdrawalEndAge - targetAge; i++) {
      total += monthlyWithdrawal * Math.pow(1 + withdrawalIncreaseRate / 100, i) * 12
    }
    return Math.round(total)
  })()

  const showNisa = filter !== 'taxable'
  const showTaxable = filter !== 'nisa'

  // テーブルデータ
  const accumTableRows = data.map(r => {
    const nisaTotal = r.NISA投資額 + r.NISA運用益
    const taxableTotal = showAfterTax
      ? r.特定口座投資額 + r.特定口座運用益 * (1 - TAX_RATE)
      : r.特定口座投資額 + r.特定口座運用益
    return {
      age: `${r.age}歳`,
      nisa: formatYenShort(Math.round(nisaTotal)),
      taxable: formatYenShort(Math.round(taxableTotal)),
      total: formatYenShort(Math.round(nisaTotal + taxableTotal)),
    }
  })

  const withdrawalTableRows = withdrawalData.map(r => ({
    age: `${r.age}歳`,
    nisa: formatYenShort(r.NISA残高),
    taxable: formatYenShort(r.特定口座残高),
    total: formatYenShort(r.NISA残高 + r.特定口座残高),
  }))

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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <BasicInput label="現在の年齢" value={currentAge} onChange={setCurrentAge} min={10} max={80} step={1} unit="歳" />
            <BasicInput label="現在の資産" value={currentAssets} onChange={setCurrentAssets} min={0} step={10000} unit="円" />
            <BasicInput label="積立終了年齢" value={targetAge} onChange={(v) => setTargetAge(Math.max(currentAge + 1, v))} min={currentAge + 1} max={100} step={1} unit="歳" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <BasicInput label="想定年利（名目）" value={nominalRate} onChange={setNominalRate} min={0} max={30} step={0.1} unit="%" />
            <BasicInput
              label="インフレ率"
              value={inflationRate}
              onChange={setInflationRate}
              min={0} max={20} step={0.1} unit="%"
            />
            <div className="flex flex-col justify-end">
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-500 mb-0.5">実質利回り</p>
                <p className={`text-xl font-bold ${effectiveRate >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {effectiveRate.toFixed(1)}%
                </p>
                <p className="text-xs text-blue-400">{nominalRate}% − {inflationRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* 年齢別積立額 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700">年齢別 毎月の積立額</h2>
              <p className="text-xs text-gray-400 mt-0.5">NISAを優先して埋め、1800万円超過分は特定口座へ</p>
            </div>
            <button onClick={addBracket} className="text-sm font-medium text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">+ 追加</button>
          </div>
          {brackets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">「+ 追加」で積立期間を設定してください</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr_auto_2fr_auto_auto] items-center gap-2 px-1">
                <span className="text-xs text-gray-400 text-center">開始年齢</span><span />
                <span className="text-xs text-gray-400 text-center">終了年齢</span><span />
                <span className="text-xs text-gray-400 text-right pr-1">月額積立</span><span /><span />
              </div>
              {brackets.map(b => (
                <div key={b.id} className="grid grid-cols-[1fr_auto_1fr_auto_2fr_auto_auto] items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
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
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-blue-600">新NISA枠 使用状況（{targetAge}歳時点）</span>
              <span className="text-xs font-semibold text-blue-700">{formatYenShort(nisaUsed)} / 1800万円</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${nisaFillPct}%` }} />
            </div>
            <p className="text-right text-xs text-blue-400 mt-1">{nisaFillPct}% 使用</p>
          </div>
        </div>

        {/* 積み立てサマリー */}
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
            <p className="text-xs text-indigo-200 mt-0.5">元本 {formatYenShort(totalInvested)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <p className="text-xs text-gray-400">特定口座最終資産</p>
            </div>
            <p className="text-xl font-bold text-amber-500">{formatYenShort(taxableFinal)}</p>
            {showAfterTax && <p className="text-xs text-amber-400 mt-0.5">税引き後</p>}
          </div>
        </div>

        {/* 積み立てグラフ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">積み立て推移</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAfterTax(v => !v)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${showAfterTax ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600'}`}
              >
                税引き後表示
              </button>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[{ key: 'both', label: '両方' }, { key: 'nisa', label: 'NISA' }, { key: 'taxable', label: '特定口座' }].map(({ key, label }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === key
                      ? key === 'nisa' ? 'bg-blue-500 text-white shadow-sm'
                        : key === 'taxable' ? 'bg-amber-400 text-white shadow-sm'
                        : 'bg-white text-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}`}
                  >{label}</button>
                ))}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="age" tickFormatter={(v) => `${v}歳`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={xInterval(targetAge - currentAge)} />
              <YAxis tickFormatter={formatYenShort} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              {showNisa && <Bar dataKey="NISA投資額" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />}
              {showNisa && <Bar dataKey="NISA運用益" stackId="a" fill="#93c5fd" radius={showTaxable ? [0, 0, 0, 0] : [4, 4, 0, 0]} />}
              {showTaxable && <Bar dataKey="特定口座投資額" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />}
              {showTaxable && <Bar dataKey="特定口座運用益" stackId="a" fill="#fcd34d" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <DataTable
            rows={accumTableRows}
            label="年次データ"
            columns={[
              { key: 'age', label: '年齢' },
              { key: 'nisa', label: 'NISA合計' },
              { key: 'taxable', label: `特定口座合計${showAfterTax ? '（税引後）' : ''}` },
              { key: 'total', label: '合計資産' },
            ]}
          />
        </div>

        {/* 取り崩しシミュレーション */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold text-gray-700">取り崩しシミュレーション</h2>
              <p className="text-xs text-gray-400 mt-0.5">{targetAge}歳時点の {formatYenShort(totalFinal)} を取り崩した場合</p>
            </div>
            <Toggle enabled={withdrawalEnabled} onChange={setWithdrawalEnabled} />
          </div>

          {withdrawalEnabled && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <BasicInput label="取り崩し終了年齢" value={withdrawalEndAge} onChange={(v) => setWithdrawalEndAge(Math.max(targetAge + 1, v))} min={targetAge + 1} max={120} step={1} unit="歳" />
                <BasicInput label="毎月の取り崩し額" value={monthlyWithdrawal} onChange={setMonthlyWithdrawal} min={0} step={10000} unit="円" />
                <BasicInput label="毎年の増額率" value={withdrawalIncreaseRate} onChange={setWithdrawalIncreaseRate} min={0} max={20} step={0.1} unit="%" note={withdrawalIncreaseRate > 0 ? `インフレ対応（${withdrawalIncreaseRate}%/年）` : ''} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">取り崩し順序</label>
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mt-1">
                    <button onClick={() => setWithdrawalOrder('taxable_first')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${withdrawalOrder === 'taxable_first' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}>
                      特定口座優先
                    </button>
                    <button onClick={() => setWithdrawalOrder('nisa_first')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${withdrawalOrder === 'nisa_first' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}>
                      NISA優先
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">{withdrawalOrder === 'taxable_first' ? 'NISAを長く運用（おすすめ）' : 'NISAを先に使い切る'}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                <span className="text-xs text-gray-500">資産を減らさない取り崩し目安</span>
                <span className="text-sm font-bold text-gray-700">{formatYenShort(sustainableMonthly)} / 月</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className={`rounded-2xl p-4 text-center ${depletionAge ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                  <p className="text-xs text-gray-400 mb-1">資産枯渇</p>
                  {depletionAge ? (
                    <><p className="text-lg font-bold text-red-500">{depletionAge}歳</p><p className="text-xs text-red-400 mt-0.5">で資産が尽きます</p></>
                  ) : (
                    <><p className="text-lg font-bold text-emerald-600">枯渇なし</p><p className="text-xs text-emerald-500 mt-0.5">{withdrawalEndAge}歳まで継続</p></>
                  )}
                </div>
                <div className="bg-indigo-500 rounded-2xl p-4 text-center">
                  <p className="text-xs text-indigo-100 mb-1">残資産（{withdrawalEndAge}歳）</p>
                  <p className="text-lg font-bold text-white">{formatYenShort(finalWithdrawalTotal)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">総取り崩し額（予定）</p>
                  <p className="text-lg font-bold text-gray-700">{formatYenShort(totalWithdrawalAmount)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{withdrawalEndAge - targetAge}年間</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={withdrawalData} margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="age" tickFormatter={(v) => `${v}歳`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={xInterval(withdrawalEndAge - targetAge)} />
                  <YAxis tickFormatter={formatYenShort} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip content={<ChartTooltip totalLabel="残高合計" />} cursor={{ fill: '#f8fafc' }} />
                  {depletionAge && <ReferenceLine x={depletionAge} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '枯渇', fill: '#ef4444', fontSize: 11 }} />}
                  <Bar dataKey="NISA残高" stackId="b" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="特定口座残高" stackId="b" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />NISA残高</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />特定口座残高</span>
              </div>

              <DataTable
                rows={withdrawalTableRows}
                label="取り崩し年次データ"
                columns={[
                  { key: 'age', label: '年齢' },
                  { key: 'nisa', label: 'NISA残高' },
                  { key: 'taxable', label: '特定口座残高' },
                  { key: 'total', label: '残高合計' },
                ]}
              />
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-2 mb-6">
          ※ このシミュレーターは概算です。実際の運用成果を保証するものではありません。
        </p>
      </div>
    </div>
  )
}

import { useState, useMemo, useRef } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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

function ChartTooltip({ active, payload, label, totalLabel = '合計' }) {
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
        {totalLabel}: {formatYen(total)}
      </p>
    </div>
  )
}

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
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
  const [filter, setFilter] = useState('both')

  // 取り崩し設定
  const [withdrawalEnabled, setWithdrawalEnabled] = useState(false)
  const [withdrawalEndAge, setWithdrawalEndAge] = useState(90)
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(200_000)
  const [withdrawalOrder, setWithdrawalOrder] = useState('taxable_first')

  const addBracket = () =>
    setBrackets((prev) => [
      ...prev,
      { id: nextId.current++, fromAge: currentAge, toAge: targetAge, monthlyAmount: 30_000 },
    ])
  const removeBracket = (id) => setBrackets((prev) => prev.filter((b) => b.id !== id))
  const updateBracket = (id, field, value) =>
    setBrackets((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)))

  // 積み立てフェーズの計算
  const { data, finalNisaAssets, finalTaxableAssets } = useMemo(() => {
    if (targetAge <= currentAge) return { data: [], finalNisaAssets: 0, finalTaxableAssets: 0 }
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

    return { data: rows, finalNisaAssets: nisaAssets, finalTaxableAssets: taxableAssets }
  }, [currentAge, currentAssets, rate, targetAge, brackets])

  // 取り崩しフェーズの計算
  const withdrawalData = useMemo(() => {
    if (!withdrawalEnabled || withdrawalEndAge <= targetAge) return []
    const monthlyRate = rate / 100 / 12
    let nisa = finalNisaAssets
    let taxable = finalTaxableAssets

    const rows = [{ age: targetAge, NISA残高: Math.round(nisa), 特定口座残高: Math.round(taxable) }]

    for (let age = targetAge; age < withdrawalEndAge; age++) {
      for (let m = 0; m < 12; m++) {
        nisa *= 1 + monthlyRate
        taxable *= 1 + monthlyRate
        let rem = monthlyWithdrawal
        if (withdrawalOrder === 'taxable_first') {
          const tw = Math.min(rem, taxable); taxable -= tw; rem -= tw
          const nw = Math.min(rem, nisa); nisa -= nw
        } else {
          const nw = Math.min(rem, nisa); nisa -= nw; rem -= nw
          const tw = Math.min(rem, taxable); taxable -= tw
        }
        nisa = Math.max(0, nisa)
        taxable = Math.max(0, taxable)
      }
      rows.push({ age: age + 1, NISA残高: Math.round(nisa), 特定口座残高: Math.round(taxable) })
    }

    return rows
  }, [withdrawalEnabled, withdrawalEndAge, monthlyWithdrawal, withdrawalOrder, rate, finalNisaAssets, finalTaxableAssets, targetAge])

  // 積み立てサマリー
  const last = data[data.length - 1]
  const nisaFinal = (last?.NISA投資額 ?? 0) + (last?.NISA運用益 ?? 0)
  const taxableFinal = (last?.特定口座投資額 ?? 0) + (last?.特定口座運用益 ?? 0)
  const totalFinal = nisaFinal + taxableFinal
  const totalInvested = (last?.NISA投資額 ?? 0) + (last?.特定口座投資額 ?? 0)
  const nisaUsed = last?.NISA投資額 ?? 0
  const nisaFillPct = Math.min(100, (nisaUsed / NISA_LIMIT) * 100).toFixed(0)

  // 取り崩しサマリー
  const depletionAge = withdrawalData.find((d) => d.NISA残高 + d.特定口座残高 === 0)?.age ?? null
  const lastW = withdrawalData[withdrawalData.length - 1]
  const finalWithdrawalTotal = (lastW?.NISA残高 ?? 0) + (lastW?.特定口座残高 ?? 0)
  const sustainableMonthly =
    finalNisaAssets + finalTaxableAssets > 0
      ? Math.round(((finalNisaAssets + finalTaxableAssets) * (rate / 100 / 12)))
      : 0

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
            <BasicInput label="積立終了年齢" value={targetAge} onChange={(v) => setTargetAge(Math.max(currentAge + 1, v))} min={currentAge + 1} max={100} step={1} unit="歳" />
          </div>
        </div>

        {/* 年齢別積立額 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700">年齢別 毎月の積立額</h2>
              <p className="text-xs text-gray-400 mt-0.5">NISAを優先して埋め、1800万円超過分は特定口座へ</p>
            </div>
            <button onClick={addBracket} className="text-sm font-medium text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
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
                <span /><span />
              </div>
              {brackets.map((b) => (
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

        {/* 積み立てグラフ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-700">積み立て推移</h2>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { key: 'both', label: '両方' },
                { key: 'nisa', label: 'NISA' },
                { key: 'taxable', label: '特定口座' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    filter === key
                      ? key === 'nisa' ? 'bg-blue-500 text-white shadow-sm'
                        : key === 'taxable' ? 'bg-amber-400 text-white shadow-sm'
                        : 'bg-white text-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="age" tickFormatter={(v) => `${v}歳`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatYenShort} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              {showNisa && <Bar dataKey="NISA投資額" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />}
              {showNisa && <Bar dataKey="NISA運用益" stackId="a" fill="#93c5fd" radius={showTaxable ? [0, 0, 0, 0] : [4, 4, 0, 0]} />}
              {showTaxable && <Bar dataKey="特定口座投資額" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />}
              {showTaxable && <Bar dataKey="特定口座運用益" stackId="a" fill="#fcd34d" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 取り崩しシミュレーション */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold text-gray-700">取り崩しシミュレーション</h2>
              <p className="text-xs text-gray-400 mt-0.5">{targetAge}歳時点の資産（{formatYenShort(totalFinal)}）を取り崩した場合</p>
            </div>
            <Toggle enabled={withdrawalEnabled} onChange={setWithdrawalEnabled} />
          </div>

          {withdrawalEnabled && (
            <>
              {/* 設定 */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <BasicInput label="取り崩し終了年齢" value={withdrawalEndAge} onChange={(v) => setWithdrawalEndAge(Math.max(targetAge + 1, v))} min={targetAge + 1} max={120} step={1} unit="歳" />
                  <BasicInput label="毎月の取り崩し額" value={monthlyWithdrawal} onChange={setMonthlyWithdrawal} min={0} step={10000} unit="円" />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">取り崩し順序</label>
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mt-1">
                      <button
                        onClick={() => setWithdrawalOrder('taxable_first')}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${withdrawalOrder === 'taxable_first' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}
                      >
                        特定口座優先
                      </button>
                      <button
                        onClick={() => setWithdrawalOrder('nisa_first')}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${withdrawalOrder === 'nisa_first' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}
                      >
                        NISA優先
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">{withdrawalOrder === 'taxable_first' ? 'NISAを長く運用（おすすめ）' : 'NISAを先に使い切る'}</p>
                  </div>
                </div>

                {/* 持続可能ライン */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">資産を減らさない取り崩し目安</span>
                  <span className="text-sm font-bold text-gray-700">{formatYenShort(sustainableMonthly)} / 月</span>
                </div>

                {/* 取り崩しサマリー */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className={`rounded-2xl p-4 text-center ${depletionAge ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                    <p className="text-xs text-gray-400 mb-1">資産枯渇</p>
                    {depletionAge ? (
                      <>
                        <p className="text-lg font-bold text-red-500">{depletionAge}歳</p>
                        <p className="text-xs text-red-400 mt-0.5">で資産が尽きます</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-emerald-600">枯渇なし</p>
                        <p className="text-xs text-emerald-500 mt-0.5">{withdrawalEndAge}歳まで継続</p>
                      </>
                    )}
                  </div>
                  <div className="bg-indigo-500 rounded-2xl p-4 text-center">
                    <p className="text-xs text-indigo-100 mb-1">残資産（{withdrawalEndAge}歳）</p>
                    <p className="text-lg font-bold text-white">{formatYenShort(finalWithdrawalTotal)}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">取り崩し期間</p>
                    <p className="text-lg font-bold text-gray-700">{withdrawalEndAge - targetAge}年間</p>
                    <p className="text-xs text-gray-400 mt-0.5">計 {formatYenShort(monthlyWithdrawal * 12 * (withdrawalEndAge - targetAge))}</p>
                  </div>
                </div>

                {/* 取り崩しグラフ */}
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={withdrawalData} margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="age" tickFormatter={(v) => `${v}歳`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={formatYenShort} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<ChartTooltip totalLabel="残高合計" />} cursor={{ fill: '#f8fafc' }} />
                    {depletionAge && (
                      <ReferenceLine x={depletionAge} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '枯渇', fill: '#ef4444', fontSize: 11 }} />
                    )}
                    <Bar dataKey="NISA残高" stackId="b" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="特定口座残高" stackId="b" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* 凡例 */}
                <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />NISA残高</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />特定口座残高</span>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-2 mb-6">
          ※ このシミュレーターは概算です。実際の運用成果を保証するものではありません。
        </p>
      </div>
    </div>
  )
}

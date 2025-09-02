"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type KeepMode = "keep" | "noKeep";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Compute combination C(n, k) as a floating-point ratio using a stable product
function combination(n: number, k: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(k)) return 0;
  n = Math.floor(n);
  k = Math.floor(k);
  if (k < 0 || k > n) return 0;
  const kEff = Math.min(k, n - k);
  if (kEff === 0) return 1;
  let result = 1;
  for (let i = 1; i <= kEff; i += 1) {
    result *= (n - kEff + i) / i;
  }
  return result;
}

// Probability that we draw zero target cards when drawing `draws` from a deck of `total`
// that contains `targetInDeck` target cards.
// This equals C(total - targetInDeck, draws) / C(total, draws).
function zeroHitHypergeometricRatio(total: number, targetInDeck: number, draws: number): number {
  if (draws <= 0) return 1;
  if (targetInDeck <= 0) return 1;
  if (total <= 0) return 1;
  if (draws > total) return 0; // drawing more than total implies certain hit in our usage
  const nonTargets = total - targetInDeck;
  if (nonTargets < 0) return 0;
  let product = 1;
  for (let i = 0; i < draws; i += 1) {
    const numerator = nonTargets - i;
    const denominator = total - i;
    if (numerator <= 0) return 0;
    product *= numerator / denominator;
  }
  return product;
}

function probabilityAtLeastOne(
  keepMode: KeepMode,
  mulliganCount: number,
  targetsInDeck: number,
  drawsFromDeck: number
): number {
  // Provided formulas:
  // Keep: 1 - (40-n)C4/40C4 * (36-n)Cl/36Cl * (36-n)Cm/36Cm
  // No keep: 1 - (36-n)Cl/36Cl * (36-n)Cm/36Cm
  const n = clamp(Math.floor(targetsInDeck), 0, 40);
  const l = clamp(Math.floor(mulliganCount), 0, 40);
  const m = clamp(Math.floor(drawsFromDeck), 0, 40);

  if (keepMode === "keep") {
    const pNoInitial = zeroHitHypergeometricRatio(40, n, 4);
    const pNoMulligan = zeroHitHypergeometricRatio(36, n, l);
    const pNoDraws = zeroHitHypergeometricRatio(36, n, m);
    const pNo = pNoInitial * pNoMulligan * pNoDraws;
    return clamp(1 - pNo, 0, 1);
  }
  // noKeep case with corrected model:
  // P(no hit) = Q_m * sum_{k=0..min(l,n)} P_l(k) * Q_l(k)
  // where
  //   P_l(k) = C(n, k) * C(36 + l - n, l - k) / C(36 + l, l)
  //   Q_l(k) = C(36 - (n - k), l) / C(36, l) = zeroHitHypergeometricRatio(36, n - k, l)
  //   Q_m     = C(36 - n, m) / C(36, m)     = zeroHitHypergeometricRatio(36, n, m)
  const qM = zeroHitHypergeometricRatio(36, n, m);
  const denomInitial = combination(36 + l, l);
  let sum = 0;
  const kMax = Math.min(l, n);
  for (let k = 0; k <= kMax; k += 1) {
    const plNumerator = combination(n, k) * combination(36 + l - n, l - k);
    const pl = denomInitial === 0 ? 0 : plNumerator / denomInitial;
    const qLk = zeroHitHypergeometricRatio(36, n - k, l);
    sum += pl * qLk;
  }
  const pNo = qM * sum;
  return clamp(1 - pNo, 0, 1);
}

type DualRangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (minValue: number, maxValue: number) => void;
};

function DualRangeSlider({ min, max, step = 1, valueMin, valueMax, onChange }: DualRangeSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<null | 'min' | 'max'>(null);
  const range = max - min;
  const percent = (v: number) => ((v - min) / range) * 100;
  const left = percent(valueMin);
  const right = percent(valueMax);

  function quantize(value: number): number {
    const snapped = Math.round((value - min) / step) * step + min;
    return clamp(snapped, min, max);
  }

  function positionToValue(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return min;
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width === 0 ? 0 : x / rect.width;
    const raw = min + ratio * (max - min);
    return quantize(raw);
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging) return;
      const val = positionToValue(e.clientX);
      if (dragging === 'min') {
        const next = Math.min(val, valueMax);
        if (next !== valueMin) onChange(next, valueMax);
      } else if (dragging === 'max') {
        const next = Math.max(val, valueMin);
        if (next !== valueMax) onChange(valueMin, next);
      }
    }
    function onUp() {
      setDragging(null);
    }
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }
    return undefined;
  }, [dragging, valueMin, valueMax, onChange]);

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const val = positionToValue(touch.clientX);
      if (dragging === 'min') {
        const next = Math.min(val, valueMax);
        if (next !== valueMin) onChange(next, valueMax);
      } else if (dragging === 'max') {
        const next = Math.max(val, valueMin);
        if (next !== valueMax) onChange(valueMin, next);
      }
    }
    function onTouchEnd() {
      setDragging(null);
    }
    if (dragging) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
      return () => {
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };
    }
    return undefined;
  }, [dragging, valueMin, valueMax, onChange]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: 40, userSelect: 'none' }}>
      {/* Track */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, height: 4, background: '#e5e7eb', borderRadius: 4 }} />
      {/* Selected range */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          height: 4,
          left: `${left}%`,
          width: `${Math.max(0, right - left)}%`,
          background: '#6b7280',
          borderRadius: 4,
        }}
      />
      {/* Min handle */}
      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={valueMax}
        aria-valuenow={valueMin}
        title={`${valueMin}`}
        onMouseDown={() => setDragging('min')}
        onTouchStart={() => setDragging('min')}
        style={{
          position: 'absolute',
          top: 10,
          left: `calc(${left}% - 10px)`,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--foreground)',
          boxShadow: '0 0 0 2px var(--background)',
          border: '1px solid #d1d5db',
          cursor: 'pointer',
        }}
      />
      {/* Max handle */}
      <div
        role="slider"
        aria-valuemin={valueMin}
        aria-valuemax={max}
        aria-valuenow={valueMax}
        title={`${valueMax}`}
        onMouseDown={() => setDragging('max')}
        onTouchStart={() => setDragging('max')}
        style={{
          position: 'absolute',
          top: 10,
          left: `calc(${right}% - 10px)`,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--foreground)',
          boxShadow: '0 0 0 2px var(--background)',
          border: '1px solid #d1d5db',
          cursor: 'pointer',
        }}
      />
      {/* Value markers */}
      <div style={{ position: 'absolute', top: 0, left: `calc(${left}% - 12px)`, fontSize: 12, color: 'var(--foreground)' }}>{valueMin}</div>
      <div style={{ position: 'absolute', top: 0, left: `calc(${right}% + 8px)`, fontSize: 12, color: 'var(--foreground)' }}>{valueMax}</div>
    </div>
  );
}

export default function Home() {
  const [keepMode, setKeepMode] = useState<KeepMode>("keep");
  const [mulliganCount, setMulliganCount] = useState<number>(0);
  const [nMin, setNMin] = useState<number>(3);
  const [nMax, setNMax] = useState<number>(3);
  const [mMin, setMMin] = useState<number>(1);
  const [mMax, setMMax] = useState<number>(9);

  const nValues = useMemo(() => {
    const start = Math.min(nMin, nMax);
    const end = Math.max(nMin, nMax);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [nMin, nMax]);

  const mValues = useMemo(() => {
    const start = Math.min(mMin, mMax);
    const end = Math.max(mMin, mMax);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [mMin, mMax]);

  const tableData: number[][] = useMemo(() => {
    return nValues.map((n) => mValues.map((m) => probabilityAtLeastOne(keepMode, mulliganCount, n, m)));
  }, [nValues, mValues, keepMode, mulliganCount]);

  const chartWidth = 720;
  const chartHeight = 320;
  const margin = { top: 16, right: 16, bottom: 32, left: 40 } as const;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  function colorForN(n: number): string {
    const hue = (n * 37) % 360;
    return `hsl(${hue} 70% 45%)`;
  }

  return (
    <main>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Shadowverse：Worlds Beyond 計算機</h1>

        {/* 条件の設定エレメント */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="keepMode" style={{ fontWeight: 600 }}>対象を初手に</label>
            <select
              id="keepMode"
              value={keepMode}
              onChange={(e) => setKeepMode(e.target.value as KeepMode)}
              style={{ padding: 6, minWidth: 200, background: 'var(--background)', color: 'var(--foreground)', border: '1px solid #d1d5db', borderRadius: 6 }}
            >
              <option value="keep">キープする</option>
              <option value="noKeep">キープしない</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="mulligan" style={{ fontWeight: 600 }}>マリガン枚数 (l)</label>
            <select
              id="mulligan"
              value={mulliganCount}
              onChange={(e) => setMulliganCount(Number(e.target.value))}
              style={{ padding: 6, minWidth: 120, background: 'var(--background)', color: 'var(--foreground)', border: '1px solid #d1d5db', borderRadius: 6 }}
            >
              {[0, 1, 2, 3, 4].map((v) => (
                <option key={v} value={v}>{v} 枚</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320, flex: 1 }}>
            <div style={{ fontWeight: 600 }}>デッキ内のカード枚数 (n) 範囲</div>
            <DualRangeSlider
              min={0}
              max={20}
              step={1}
              valueMin={nMin}
              valueMax={nMax}
              onChange={(minVal, maxVal) => {
                setNMin(minVal);
                setNMax(maxVal);
              }}
            />
            <div style={{ color: '#6b7280' }}>n = [{Math.min(nMin, nMax)} 〜 {Math.max(nMin, nMax)}]</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320, flex: 1 }}>
            <div style={{ fontWeight: 600 }}>デッキから引く枚数 (m) 範囲</div>
            <DualRangeSlider
              min={0}
              max={40}
              step={1}
              valueMin={mMin}
              valueMax={mMax}
              onChange={(minVal, maxVal) => {
                setMMin(minVal);
                setMMax(maxVal);
              }}
            />
            <div style={{ color: '#6b7280' }}>m = [{Math.min(mMin, mMax)} 〜 {Math.max(mMin, mMax)}]</div>
          </div>
        </section>

        {/* 結果のグラフエレメント */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 12 }}>
          <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto', background: 'transparent' }}>
            <g transform={`translate(${margin.left},${margin.top})`}>
              <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#9ca3af" />
              <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#9ca3af" />

              {Array.from({ length: 11 }, (_, i) => i / 10).map((t) => {
                const y = innerHeight - t * innerHeight;
                return (
                  <g key={t}>
                    <line x1={0} y1={y} x2={innerWidth} y2={y} stroke="#e5e7eb" />
                    <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b7280">
                      {(t * 100).toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              {mValues.map((m, idx) => {
                const x = mValues.length > 1 ? (idx * innerWidth) / (mValues.length - 1) : innerWidth / 2;
                return (
                  <g key={m}>
                    <line x1={x} y1={innerHeight} x2={x} y2={innerHeight + 4} stroke="#9ca3af" />
                    <text x={x} y={innerHeight + 16} textAnchor="middle" fontSize={10} fill="#6b7280">{m}</text>
                  </g>
                );
              })}

              {nValues.map((n) => {
                const points = mValues.map((m, idx) => {
                  const p = probabilityAtLeastOne(keepMode, mulliganCount, n, m);
                  const x = mValues.length > 1 ? (idx * innerWidth) / (mValues.length - 1) : innerWidth / 2;
                  const y = innerHeight - p * innerHeight;
                  return `${x},${y}`;
                }).join(" ");
                const color = colorForN(n);
                return (
                  <g key={`line-${n}`}>
                    <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          </svg>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {nValues.map((n) => (
              <div key={`legend-${n}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 2, background: colorForN(n), display: 'inline-block' }} />
                <span style={{ fontSize: 12 }}>n={n}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 結果の表エレメント */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 12 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>n：デッキ内のカード枚数, m：デッキから引く枚数</div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #e5e7eb', padding: 6, background: '#f9fafb', position: 'sticky', left: 0 }}>n \ m</th>
                  {mValues.map((m) => (
                    <th key={`m-${m}`} style={{ border: '1px solid #e5e7eb', padding: 6, background: '#f9fafb' }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nValues.map((n, rIdx) => (
                  <tr key={`row-${n}`}>
                    <th style={{ border: '1px solid #e5e7eb', padding: 6, background: '#f9fafb', textAlign: 'right', position: 'sticky', left: 0 }}>n={n}</th>
                    {tableData[rIdx].map((p, cIdx) => (
                      <td key={`cell-${rIdx}-${cIdx}`} style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'right' }}>
                        {(p * 100).toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        
        {/* 計算式の説明 */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 12 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>計算式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#111' }}>
            <div style={{ color: '#6b7280' }}>記号: C(a,b) は「a 個から b 個を選ぶ組合せ数」。n: 対象枚数, l: マリガン枚数, m: ゲーム開始後のドロー枚数。</div>
            <div style={{ fontWeight: 600 }}>キープする場合</div>
            <div>少なくとも1枚: 1 - C(40 - n, 4)/C(40, 4) × C(36 - n, l)/C(36, l) × C(36 - n, m)/C(36, m)</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>キープしない場合</div>
            <div>対象は戻す前提なので、キープしたカードに対象が含まれていない場合の条件付き確率で考える</div>
            <div>少なくとも1枚: 1 - Q_m × Σ k=0..min(l,n) P_l(k) × Q_l(k)</div>
            <div>P_l(k) = C(n, k) × C(36 + l - n, l - k) / C(36 + l, l)</div>
            <div>Q_l(k) = C(36 - (n - k), l) / C(36, l)</div>
            <div>Q_m = C(36 - n, m) / C(36, m)</div>
          </div>
        </section>
        
        {/* フッターリンク */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <a
            href="https://note.com/maddogmtg/n/n3edfb7fc7f10"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline' }}
          >
            このページについて
          </a>
        </div>
      </div>
    </main>
  );
}

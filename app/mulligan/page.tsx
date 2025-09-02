"use client";

import { useMemo, useRef, useState, useEffect } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Probability of drawing zero targets when drawing `draws` from `total` that has `targetInDeck` targets
function zeroHitHypergeometricRatio(total: number, targetInDeck: number, draws: number): number {
  if (draws <= 0) return 1;
  if (targetInDeck <= 0) return 1;
  if (total <= 0) return 1;
  if (draws > total) return 0;
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

// Keep case (conditioned on initial 4 having zero targets):
// P(no hit) = noHit(Mulligan l | 36 with n) * noHit(Later m | 36 with n)
function probabilityAtLeastOneKeep(n: number, l: number, m: number): number {
  const nn = clamp(Math.floor(n), 0, 40);
  const ll = clamp(Math.floor(l), 0, 4);
  const mm = clamp(Math.floor(m), 0, 40);
  const pNoMulligan = zeroHitHypergeometricRatio(36, nn, ll);
  const pNoDraws = zeroHitHypergeometricRatio(36, nn, mm);
  const pNo = pNoMulligan * pNoDraws;
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
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, height: 4, background: '#e5e7eb', borderRadius: 4 }} />
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
      <div style={{ position: 'absolute', top: 0, left: `calc(${left}% - 12px)`, fontSize: 12, color: 'var(--foreground)' }}>{valueMin}</div>
      <div style={{ position: 'absolute', top: 0, left: `calc(${right}% + 8px)`, fontSize: 12, color: 'var(--foreground)' }}>{valueMax}</div>
    </div>
  );
}

export default function MulliganKeepPage() {
  const [n, setN] = useState<number>(3);
  const [mMin, setMMin] = useState<number>(1);
  const [mMax, setMMax] = useState<number>(12);

  const mValues = useMemo(() => {
    const start = Math.min(mMin, mMax);
    const end = Math.max(mMin, mMax);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [mMin, mMax]);

  // Curves for l = 0..4 (5本)
  const lCurves = [0, 1, 2, 3, 4];
  // Table rows for l = 0..4 (常に5行)
  const lRows = [0, 1, 2, 3, 4];

  const chartWidth = 720;
  const chartHeight = 320;
  const margin = { top: 16, right: 16, bottom: 32, left: 40 } as const;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  function colorForL(l: number): string {
    // High-contrast, colorblind-friendly (Okabe-Ito inspired) palette
    const palette = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7"]; // blue, orange, green, vermillion, purple
    return palette[l % palette.length];
  }

  return (
    <main>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Shadowverse：Worlds Beyond 探しに行く行動計算機</h1>

        {/* 条件設定 */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="n" style={{ fontWeight: 600 }}>デッキ内の対象枚数 (n)</label>
            <select
              id="n"
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              style={{ padding: 6, minWidth: 160, background: 'var(--background)', color: 'var(--foreground)', border: '1px solid #d1d5db', borderRadius: 6 }}
            >
              {Array.from({ length: 21 }, (_, i) => i).map((v) => (
                <option key={v} value={v}>{v} 枚</option>
              ))}
            </select>
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

        {/* グラフ */}
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

              {lCurves.map((l) => {
                const points = mValues.map((m, idx) => {
                  const p = probabilityAtLeastOneKeep(n, l, m);
                  const x = mValues.length > 1 ? (idx * innerWidth) / (mValues.length - 1) : innerWidth / 2;
                  const y = innerHeight - p * innerHeight;
                  return `${x},${y}`;
                }).join(" ");
                const color = colorForL(l);
                return (
                  <g key={`line-l-${l}`}>
                    <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          </svg>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' }}>
            {lCurves.map((l) => (
              <div key={`legend-l-${l}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 2, background: colorForL(l), display: 'inline-block' }} />
                <span style={{ fontSize: 12 }}>l={l}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 表 */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 12 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>表（行: 引き直し枚数 l, 列: 引く枚数 m）</div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #e5e7eb', padding: 6, background: '#f9fafb', position: 'sticky', left: 0 }}>l \ m</th>
                  {mValues.map((m) => (
                    <th key={`m-${m}`} style={{ border: '1px solid #e5e7eb', padding: 6, background: '#f9fafb' }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lRows.map((l) => (
                  <tr key={`row-l-${l}`}>
                    <th style={{ border: '1px solid #e5e7eb', padding: 6, background: '#f9fafb', textAlign: 'right', position: 'sticky', left: 0 }}>{l}枚引き直し</th>
                    {mValues.map((m) => (
                      <td key={`cell-${l}-${m}`} style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'right' }}>
                        {(probabilityAtLeastOneKeep(n, l, m) * 100).toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}



"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import type { OracleComparisonSnapshot, OracleSource } from "@/src/app/types";

interface Props {
  snapshots: OracleComparisonSnapshot[];
  history:   OracleComparisonSnapshot[];
}

const SOURCE_META: Record<OracleSource, { label: string; color: string }> = {
  chainlink: { label: "Chainlink", color: "#f59e0b" },
  pyth:      { label: "Pyth",      color: "#a78bfa" },
  twap:      { label: "Uniswap TWAP", color: "#34d399" },
};

function ScoreBar({ value }: { value: number }) {
  const abs   = Math.abs(value);
  const color = abs >= 1 ? "bg-red-500" : abs >= 0.5 ? "bg-yellow-400" : "bg-green-400";
  const label = abs >= 1 ? "High risk" : abs >= 0.5 ? "Warning" : "Healthy";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-border rounded-full h-1.5 relative">
        <div
          className={`${color} h-1.5 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(abs * 50, 100)}%` }}
        />
      </div>
      <span className={`text-xs w-16 text-right ${abs >= 1 ? "text-red-400" : abs >= 0.5 ? "text-yellow-400" : "text-green-400"}`}>
        {value >= 0 ? "+" : ""}{value.toFixed(3)}%
      </span>
      <span className="text-xs text-muted-foreground/50 w-16">{label}</span>
    </div>
  );
}

function FeedBlock({ snap }: { snap: OracleComparisonSnapshot }) {
  const sources = (Object.keys(SOURCE_META) as OracleSource[]).filter(s => snap.prices[s] !== undefined);
  return (
    <div className="bg-background border border-border rounded p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-foreground">{snap.label}</span>
        <span className="text-xs text-muted-foreground/50 font-mono">
          Median ${snap.median.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="space-y-3">
        {sources.map(source => {
          const meta  = SOURCE_META[source];
          const price = snap.prices[source]!;
          const score = snap.scores[source] ?? 0;
          return (
            <div key={source}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-xs text-white font-mono">
                  ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <ScoreBar value={score} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildChartData(history: OracleComparisonSnapshot[], feedId: string) {
  return history
    .filter(s => s.feedId === feedId)
    .map(s => ({
      time:      s.time,
      chainlink: s.scores.chainlink,
      pyth:      s.scores.pyth,
      twap:      s.scores.twap,
    }));
}

export default function OracleComparisonPanel({ snapshots, history }: Props) {
  const feedIds = [...new Set(snapshots.map(s => s.feedId))];

  return (
    <div className="bg-card border border-border p-6 rounded mb-6">
      <div className="flex justify-between items-start mb-1">
        <h2 className="text-muted-foreground text-sm">Oracle Source Comparison</h2>
        <div className="flex gap-4 text-xs text-muted-foreground/60">
          {(Object.entries(SOURCE_META) as [OracleSource, typeof SOURCE_META[OracleSource]][]).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: v.color }} />
              {v.label}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground/50 mb-5">
        Each oracle scored against the median price — deviation % shows how far each source diverges
      </p>

      {/* Price bars */}
      {snapshots.length === 0 ? (
        <p className="text-muted-foreground text-sm">Fetching oracle sources…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {snapshots.map(snap => <FeedBlock key={snap.feedId} snap={snap} />)}
        </div>
      )}

      {/* Deviation over time chart per feed */}
      {feedIds.map(feedId => {
        const data  = buildChartData(history, feedId);
        const label = snapshots.find(s => s.feedId === feedId)?.label ?? feedId.toUpperCase();
        if (data.length < 2) return null;
        return (
          <div key={feedId} className="mb-4">
            <p className="text-xs text-muted-foreground/70 mb-2">{label} — deviation from median over time</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 9 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} unit="%" width={48} domain={["auto", "auto"]} />
                <ReferenceLine y={0}    stroke="#374151" strokeDasharray="4 2" />
                <ReferenceLine y={0.5}  stroke="#d97706" strokeDasharray="3 3" strokeOpacity={0.4} />
                <ReferenceLine y={-0.5} stroke="#d97706" strokeDasharray="3 3" strokeOpacity={0.4} />
                <ReferenceLine y={1}    stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={-1}   stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", color: "#fff", fontSize: 11 }}
                  formatter={(v: any) => [`${v >= 0 ? "+" : ""}${Number(v).toFixed(4)}%`]}
                />
                <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />
                <Line type="monotone" dataKey="chainlink" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Chainlink" connectNulls />
                <Line type="monotone" dataKey="pyth"      stroke="#a78bfa" dot={false} strokeWidth={1.5} name="Pyth"      connectNulls />
                <Line type="monotone" dataKey="twap"      stroke="#34d399" dot={false} strokeWidth={1.5} name="TWAP"      connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

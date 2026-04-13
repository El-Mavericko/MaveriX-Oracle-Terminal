"use client";

import { useState } from "react";
import type { FeedDeviationAlert } from "@/src/app/hooks/useFeedDeviationAlerts";
import type { FeedConfig } from "@/src/app/types";

interface Props {
  alerts: FeedDeviationAlert[];
  feeds: FeedConfig[];
  onAdd: (feedId: string, feedLabel: string, threshold: number) => void;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
}

export default function OracleDeviationAlerts({ alerts, feeds, onAdd, onRemove, onReset }: Props) {
  const [selectedFeed, setSelectedFeed] = useState(feeds[0]?.id ?? "eth");
  const [threshold, setThreshold] = useState("0.5");

  function handleAdd() {
    const val = parseFloat(threshold);
    if (isNaN(val) || val <= 0) return;
    const feed = feeds.find(f => f.id === selectedFeed);
    if (!feed) return;
    onAdd(feed.id, feed.label, val);
    setThreshold("0.5");
  }

  return (
    <div className="bg-card border border-border p-6 rounded">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-muted-foreground text-sm">Oracle Deviation Alerts</h2>
        <span className="text-xs text-muted-foreground/60">Fires when oracle drifts from market price</span>
      </div>
      <p className="text-xs text-muted-foreground/50 mb-4">
        &gt;1% deviation can affect DeFi health factors and trigger liquidations
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={selectedFeed}
          onChange={e => setSelectedFeed(e.target.value)}
          className="bg-background border border-border text-foreground/80 text-sm px-2 py-1.5 rounded"
        >
          {feeds.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            step="0.1"
            min="0.1"
            placeholder="Threshold %"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="flex-1 bg-background border border-border text-white text-sm px-3 py-1.5 rounded"
          />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded"
        >
          Add
        </button>
      </div>

      {alerts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No deviation alerts set.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map(alert => (
            <li
              key={alert.id}
              className={`flex justify-between items-center text-sm px-3 py-2 rounded border ${
                alert.triggered
                  ? "border-red-800 bg-red-900/10 text-red-400"
                  : "border-border text-foreground/80"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span>
                  {alert.triggered ? "⚠ " : "·  "}
                  {alert.feedLabel} &gt; {alert.threshold}% deviation
                </span>
                {alert.triggered && alert.triggeredAt && (
                  <span className="text-xs text-red-400/70">
                    Triggered at {alert.triggeredAt}
                    {alert.lastDeviation !== undefined ? ` — ${alert.lastDeviation.toFixed(3)}% off` : ""}
                  </span>
                )}
                {!alert.triggered && alert.lastDeviation !== undefined && (
                  <span className="text-xs text-muted-foreground/50">
                    Current: {alert.lastDeviation.toFixed(3)}%
                  </span>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                {alert.triggered && (
                  <button
                    onClick={() => onReset(alert.id)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => onRemove(alert.id)}
                  className="text-muted-foreground/70 hover:text-red-400 text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

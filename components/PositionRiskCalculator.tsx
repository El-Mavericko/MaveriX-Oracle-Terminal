"use client";

import { useState } from "react";
import type { AavePosition } from "@/src/app/hooks/useAavePositions";
import type { FeedPrice } from "@/src/app/types";

// Aave V3 mainnet liquidation thresholds
const LIQ_THRESHOLDS: Record<string, number> = {
  eth:  0.825,
  btc:  0.750,
  link: 0.650,
};

const ASSET_LABELS: Record<string, string> = {
  eth: "ETH", btc: "BTC (WBTC)", link: "LINK",
};

interface Props {
  feedPrices:   Record<string, FeedPrice>;
  aavePosition: AavePosition | null;
  aaveLoading:  boolean;
  walletConnected: boolean;
}

function HFBar({ hf }: { hf: number }) {
  const capped = Math.min(hf, 3);
  const pct    = (capped / 3) * 100;
  const color  = hf < 1.1 ? "bg-red-500" : hf < 1.5 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="w-full bg-border rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RiskLabel({ hf }: { hf: number }) {
  if (hf < 1.0) return <span className="text-red-500 font-semibold">⚠ Liquidatable now</span>;
  if (hf < 1.1) return <span className="text-red-400 font-semibold">⚠ Critical</span>;
  if (hf < 1.25) return <span className="text-orange-400">⚠ At risk</span>;
  if (hf < 1.5)  return <span className="text-yellow-400">⚡ Moderate</span>;
  return <span className="text-green-400">✓ Healthy</span>;
}

export default function PositionRiskCalculator({ feedPrices, aavePosition, aaveLoading, walletConnected }: Props) {
  const [asset,      setAsset]      = useState("eth");
  const [collateral, setCollateral] = useState("");
  const [borrow,     setBorrow]     = useState("");

  const oraclePrice   = feedPrices[asset]?.price ?? 0;
  const liqThreshold  = LIQ_THRESHOLDS[asset];
  const collateralAmt = parseFloat(collateral) || 0;
  const borrowAmt     = parseFloat(borrow)     || 0;

  const collateralUSD      = collateralAmt * oraclePrice;
  const healthFactor       = borrowAmt > 0 ? (collateralUSD * liqThreshold) / borrowAmt : Infinity;
  const liqPrice           = borrowAmt > 0 && collateralAmt > 0
    ? borrowAmt / (collateralAmt * liqThreshold)
    : null;
  const driftToLiquidation = liqPrice && oraclePrice > 0
    ? ((oraclePrice - liqPrice) / oraclePrice) * 100
    : null;

  return (
    <div className="bg-card border border-border p-6 rounded mb-6">
      <h2 className="text-muted-foreground text-sm mb-1">Position Risk Calculator</h2>
      <p className="text-xs text-muted-foreground/50 mb-5">
        Calculate how much oracle drift would liquidate your position — uses Aave V3 liquidation thresholds
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Manual Calculator ── */}
        <div>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-widest mb-3">Manual Calculator</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Collateral Asset</label>
              <select
                value={asset}
                onChange={e => setAsset(e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm px-3 py-2 rounded"
              >
                {Object.entries(ASSET_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Collateral Amount ({ASSET_LABELS[asset]})
              </label>
              <input
                type="number" min="0" step="0.01"
                placeholder={`e.g. 2.5`}
                value={collateral}
                onChange={e => setCollateral(e.target.value)}
                className="w-full bg-background border border-border text-white text-sm px-3 py-2 rounded"
              />
              {oraclePrice > 0 && collateralAmt > 0 && (
                <p className="text-xs text-muted-foreground/50 mt-1">
                  ≈ ${collateralUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} at current oracle price
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Borrow Amount (USD)</label>
              <input
                type="number" min="0" step="1"
                placeholder="e.g. 3000"
                value={borrow}
                onChange={e => setBorrow(e.target.value)}
                className="w-full bg-background border border-border text-white text-sm px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* Results */}
          {borrowAmt > 0 && collateralAmt > 0 && oraclePrice > 0 && (
            <div className="mt-4 space-y-3 border border-border rounded p-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Health Factor</span>
                <RiskLabel hf={healthFactor} />
              </div>
              <HFBar hf={isFinite(healthFactor) ? healthFactor : 3} />
              <p className="text-2xl font-bold text-white">
                {isFinite(healthFactor) ? healthFactor.toFixed(3) : "∞"}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Liquidation Price</p>
                  <p className="text-white font-mono">
                    {liqPrice ? `$${liqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                  </p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Drift to Liquidation</p>
                  <p className={`font-mono font-semibold ${
                    driftToLiquidation !== null && driftToLiquidation < 5 ? "text-red-400" :
                    driftToLiquidation !== null && driftToLiquidation < 15 ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {driftToLiquidation !== null ? `${driftToLiquidation.toFixed(2)}%` : "—"}
                  </p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Liq. Threshold</p>
                  <p className="text-white font-mono">{(liqThreshold * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Oracle Price</p>
                  <p className="text-white font-mono">
                    ${oraclePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {driftToLiquidation !== null && driftToLiquidation < 5 && (
                <p className="text-xs text-red-400 mt-2">
                  ⚠ Only {driftToLiquidation.toFixed(2)}% oracle drop separates you from liquidation
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Live Aave Position ── */}
        <div>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-widest mb-3">
            Live Aave V3 Position
          </p>

          {!walletConnected ? (
            <div className="border border-border rounded p-4 text-center">
              <p className="text-muted-foreground text-sm">Connect wallet to view your live Aave positions</p>
            </div>
          ) : aaveLoading ? (
            <div className="border border-border rounded p-4">
              <p className="text-muted-foreground text-sm animate-pulse">Loading Aave position…</p>
            </div>
          ) : !aavePosition || aavePosition.totalCollateralUSD === 0 ? (
            <div className="border border-border rounded p-4">
              <p className="text-muted-foreground text-sm">No active Aave V3 position found on mainnet.</p>
            </div>
          ) : (
            <div className="border border-border rounded p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Health Factor</span>
                <RiskLabel hf={aavePosition.healthFactor} />
              </div>
              <HFBar hf={aavePosition.healthFactor} />
              <p className="text-3xl font-bold text-white">{aavePosition.healthFactor.toFixed(3)}</p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Collateral</p>
                  <p className="text-white font-mono">${aavePosition.totalCollateralUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Debt</p>
                  <p className="text-white font-mono">${aavePosition.totalDebtUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Available to Borrow</p>
                  <p className="text-white font-mono">${aavePosition.availableBorrowsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-background rounded p-3">
                  <p className="text-muted-foreground mb-1">Drift to Liquidation</p>
                  <p className={`font-mono font-semibold ${
                    aavePosition.driftToLiquidation < 5  ? "text-red-400" :
                    aavePosition.driftToLiquidation < 15 ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {aavePosition.driftToLiquidation.toFixed(2)}%
                  </p>
                </div>
              </div>

              {aavePosition.driftToLiquidation < 10 && (
                <p className="text-xs text-red-400">
                  ⚠ Your collateral only needs to drop {aavePosition.driftToLiquidation.toFixed(2)}% in oracle value to trigger liquidation
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

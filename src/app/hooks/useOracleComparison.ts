"use client";

import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import {
  PYTH_PRICE_IDS, PYTH_HERMES_URL,
  UNISWAP_TWAP_POOLS, TWAP_WINDOW_SECONDS, UNISWAP_OBSERVE_ABI,
  ORACLE_COMPARISON_INTERVAL_MS, ORACLE_COMPARISON_HISTORY_MAX,
  FALLBACK_RPCS, CHAIN_MAINNET,
} from "@/src/app/constants";
import type { FeedPrice, OracleComparisonSnapshot } from "@/src/app/types";

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function deviationPct(price: number, med: number): number {
  if (!med) return 0;
  return parseFloat((((price - med) / med) * 100).toFixed(4));
}

async function fetchPythPrices(feedIds: string[]): Promise<Record<string, { price: number; confidence: number }>> {
  const ids = feedIds.map(id => `ids[]=${id}`).join("&");
  const res = await fetch(`${PYTH_HERMES_URL}?${ids}`);
  if (!res.ok) throw new Error(`Pyth HTTP ${res.status}`);
  const json = await res.json();

  const out: Record<string, { price: number; confidence: number }> = {};
  for (const [feedId, priceId] of Object.entries(PYTH_PRICE_IDS)) {
    const parsed = json.parsed?.find((p: any) => `0x${p.id}` === priceId || p.id === priceId.replace("0x", ""));
    if (parsed) {
      const expo = parsed.price.expo;
      out[feedId] = {
        price:      parsed.price.price * Math.pow(10, expo),
        confidence: parsed.price.conf  * Math.pow(10, expo),
      };
    }
  }
  return out;
}

async function fetchTWAP(feedId: string, provider: ethers.JsonRpcProvider): Promise<number | null> {
  const pool = UNISWAP_TWAP_POOLS[feedId];
  if (!pool) return null;
  try {
    const contract = new ethers.Contract(pool.address, UNISWAP_OBSERVE_ABI, provider);
    const [tickCumulatives] = await contract.observe([TWAP_WINDOW_SECONDS, 0]);
    const meanTick = Number(tickCumulatives[1] - tickCumulatives[0]) / TWAP_WINDOW_SECONDS;
    const P = Math.pow(1.0001, meanTick);
    const adjFactor = Math.pow(10, pool.token0Decimals - pool.token1Decimals);
    const rawPrice = P * adjFactor;
    return pool.invertPrice ? 1 / rawPrice : rawPrice;
  } catch {
    return null;
  }
}

export function useOracleComparison(
  feedPrices: Record<string, FeedPrice>,
  feedIds: string[],
  feedLabels: Record<string, string>,
) {
  const [snapshots, setSnapshots] = useState<OracleComparisonSnapshot[]>([]);
  const [history,   setHistory]   = useState<OracleComparisonSnapshot[]>([]);
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);

  useEffect(() => {
    providerRef.current = new ethers.JsonRpcProvider(
      FALLBACK_RPCS[CHAIN_MAINNET]
    );
  }, []);

  async function fetchComparison() {
    const provider = providerRef.current;
    if (!provider) return;

    // Pyth prices for all feeds
    let pythPrices: Record<string, { price: number; confidence: number }> = {};
    try {
      pythPrices = await fetchPythPrices(feedIds.map(id => PYTH_PRICE_IDS[id]).filter(Boolean));
    } catch { /* pyth unavailable */ }

    // TWAP prices (sequential to avoid rate limits)
    const twapPrices: Record<string, number> = {};
    for (const feedId of feedIds) {
      const twap = await fetchTWAP(feedId, provider);
      if (twap !== null) twapPrices[feedId] = twap;
      await new Promise(r => setTimeout(r, 200));
    }

    const time = new Date().toLocaleTimeString();
    const newSnapshots: OracleComparisonSnapshot[] = [];

    for (const feedId of feedIds) {
      const chainlinkPrice = feedPrices[feedId]?.price;
      const pythPrice      = pythPrices[feedId]?.price;
      const twapPrice      = twapPrices[feedId];

      const available = [chainlinkPrice, pythPrice, twapPrice].filter((v): v is number => v !== undefined && v > 0);
      if (!available.length) continue;

      const med = median(available);

      const prices: OracleComparisonSnapshot["prices"] = {};
      const scores: OracleComparisonSnapshot["scores"] = {};

      if (chainlinkPrice) { prices.chainlink = chainlinkPrice; scores.chainlink = deviationPct(chainlinkPrice, med); }
      if (pythPrice)      { prices.pyth      = pythPrice;      scores.pyth      = deviationPct(pythPrice, med);      }
      if (twapPrice)      { prices.twap      = twapPrice;      scores.twap      = deviationPct(twapPrice, med);      }

      newSnapshots.push({ feedId, label: feedLabels[feedId] ?? feedId.toUpperCase(), time, prices, median: med, scores });
    }

    if (newSnapshots.length) {
      setSnapshots(newSnapshots);
      setHistory(prev => [...prev, ...newSnapshots].slice(-ORACLE_COMPARISON_HISTORY_MAX));
    }
  }

  useEffect(() => {
    fetchComparison();
    const interval = setInterval(fetchComparison, ORACLE_COMPARISON_INTERVAL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedPrices]);

  return { snapshots, history };
}

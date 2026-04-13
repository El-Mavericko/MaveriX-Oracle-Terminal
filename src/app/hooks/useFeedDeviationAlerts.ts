"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedPrice } from "../types/oracle";

export interface FeedDeviationAlert {
  id: string;
  feedId: string;
  feedLabel: string;
  threshold: number; // % deviation that triggers
  triggered: boolean;
  triggeredAt?: string;
  lastDeviation?: number;
}

const STORAGE_KEY = "oracle_deviation_alerts";

export function useFeedDeviationAlerts() {
  const [alerts, setAlerts] = useState<FeedDeviationAlert[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAlerts(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  }, [alerts]);

  function addDeviationAlert(feedId: string, feedLabel: string, threshold: number) {
    setAlerts(prev => [
      ...prev,
      {
        id: `${feedId}-${Date.now()}`,
        feedId,
        feedLabel,
        threshold,
        triggered: false,
      },
    ]);
  }

  function removeDeviationAlert(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  function resetDeviationAlert(id: string) {
    notifiedRef.current.delete(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: false, triggeredAt: undefined } : a));
  }

  function checkDeviationAlerts(
    feedPrices: Record<string, FeedPrice>,
    marketPrices: Record<string, number>,
    feedLabelMap: Record<string, string>,
  ) {
    const feedToGecko: Record<string, string> = {
      eth: "ethereum", btc: "bitcoin", link: "chainlink",
    };

    setAlerts(prev => prev.map(alert => {
      const oracle = feedPrices[alert.feedId]?.price;
      const market = marketPrices[feedToGecko[alert.feedId]];
      if (!oracle || !market) return alert;

      const deviation = Math.abs(((oracle - market) / market) * 100);
      const exceeded = deviation >= alert.threshold;

      if (exceeded && !notifiedRef.current.has(alert.id)) {
        notifiedRef.current.add(alert.id);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("MaveriX Oracle Deviation Alert", {
            body: `${alert.feedLabel} oracle is ${deviation.toFixed(3)}% off market — exceeds your ${alert.threshold}% threshold`,
          });
        }
        return { ...alert, triggered: true, triggeredAt: new Date().toLocaleTimeString(), lastDeviation: deviation };
      }

      if (!exceeded && notifiedRef.current.has(alert.id)) {
        notifiedRef.current.delete(alert.id);
        return { ...alert, triggered: false, triggeredAt: undefined, lastDeviation: deviation };
      }

      return { ...alert, lastDeviation: deviation };
    }));
  }

  return { alerts, addDeviationAlert, removeDeviationAlert, resetDeviationAlert, checkDeviationAlerts };
}

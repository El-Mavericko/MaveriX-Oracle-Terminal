"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { FALLBACK_RPCS, CHAIN_MAINNET } from "@/src/app/constants";

// Aave V3 Pool — mainnet
const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const AAVE_ABI = [
  "function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
];

export interface AavePosition {
  totalCollateralUSD:        number;
  totalDebtUSD:              number;
  availableBorrowsUSD:       number;
  currentLiquidationThreshold: number; // e.g. 0.825 = 82.5%
  ltv:                       number;   // e.g. 0.80
  healthFactor:              number;
  // derived
  driftToLiquidation:        number;   // % oracle drop that would liquidate
}

export function useAavePositions(address: string | null, chainId: number | null) {
  const [position, setPosition] = useState<AavePosition | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!address || chainId !== CHAIN_MAINNET) {
      setPosition(null);
      return;
    }

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : new ethers.JsonRpcProvider(FALLBACK_RPCS[CHAIN_MAINNET]);
        const pool = new ethers.Contract(AAVE_V3_POOL, AAVE_ABI, provider);
        const data = await pool.getUserAccountData(address);

        const totalCollateralUSD          = Number(data[0]) / 1e8;
        const totalDebtUSD                = Number(data[1]) / 1e8;
        const availableBorrowsUSD         = Number(data[2]) / 1e8;
        const currentLiquidationThreshold = Number(data[3]) / 10000;
        const ltv                         = Number(data[4]) / 10000;
        const healthFactor                = Number(data[5]) / 1e18;

        // How much collateral value needs to drop before HF = 1 (liquidation)
        // HF = (collateral * liqThreshold) / debt = 1 at liquidation
        // liquidation_collateral = debt / liqThreshold
        // drift = (collateral - liquidation_collateral) / collateral * 100
        const liquidationCollateral = totalDebtUSD / currentLiquidationThreshold;
        const driftToLiquidation = totalCollateralUSD > 0
          ? ((totalCollateralUSD - liquidationCollateral) / totalCollateralUSD) * 100
          : 0;

        setPosition({
          totalCollateralUSD,
          totalDebtUSD,
          availableBorrowsUSD,
          currentLiquidationThreshold,
          ltv,
          healthFactor,
          driftToLiquidation,
        });
      } catch (e) {
        setError("Could not load Aave position");
      } finally {
        setLoading(false);
      }
    }

    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [address, chainId]);

  return { position, loading, error };
}

// Pyth Network price feed IDs (mainnet)
export const PYTH_PRICE_IDS: Record<string, string> = {
  eth:  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  btc:  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  link: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
};

export const PYTH_HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";

// Uniswap V3 pool configs for TWAP (30-minute window)
// token0/token1 sorted by address (lower address = token0)
export const UNISWAP_TWAP_POOLS: Record<string, {
  address: string;
  token0Decimals: number;
  token1Decimals: number;
  invertPrice: boolean; // true = want price of token1 in token0 terms
}> = {
  // USDC(token0,6dec) / WETH(token1,18dec) 0.05% — ETH price = 10^12 / P
  eth: {
    address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    token0Decimals: 6,
    token1Decimals: 18,
    invertPrice: true,
  },
  // WBTC(token0,8dec) / USDC(token1,6dec) 0.3% — BTC price = P * 10^(8-6) = P*100
  btc: {
    address: "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35",
    token0Decimals: 8,
    token1Decimals: 6,
    invertPrice: false,
  },
};

export const TWAP_WINDOW_SECONDS = 1800; // 30 minutes

export const UNISWAP_OBSERVE_ABI = [
  "function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)",
];

export const ORACLE_COMPARISON_INTERVAL_MS = 60_000; // poll every 60s
export const ORACLE_COMPARISON_HISTORY_MAX = 50;

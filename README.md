# Satoshi Nakamoto Market Sentiment

A real-time Bitcoin sentiment tracker visualizing market and network health via a digital Satoshi Nakamoto statue. Built as a single-page app in `bitcoin.html`, it fetches live data to display metrics like price, energy usage, difficulty, and market cap. Explanatory pages educate users, ideal for investors, miners, and blockchain enthusiasts.

## Features
- **Sentiment Visualization** (updates every 60 seconds):
  - **Bullish**: Price change >0.5% (`SpringBloom*.png`).
  - **Bearish**: Price change <-0.5% (`Fall*.png`).
  - **Neutral**: -0.5% to +0.5% (`NeutralMarket.jpg`).
  - **Need Energy**: Blocks <130/day (`WinterStorm.png`).
  - **Doom's Day**: Difficulty >2.06e67 (`DoomsDay.png`).
  - **Working too Hard**: Energy >2% renewables (`DrySummer.png`).
  - Tooltips link to explanatory pages.
- **Metrics**:
  - Price (USD, CoinGecko).
  - 24-hour price change (%).
  - Market capitalization.
  - Daily energy usage (GWh/day).
  - Mining difficulty.
  - Dollars yield per kWh.
- **Responsive UI**: Tailwind CSS (CDN).
- **Scalable**: Supports miner automation.

## Project Structure
- `bitcoin.html`: Core app (HTML, JS, ~10 KB).
- `energy.html`: Energy usage (~500 B).
- `difficulty.html`: Difficulty’s role (~1.2 KB).
- `yield.html`: Dollars per kWh (~800 B).
- `marketcap.html`: Market cap feedback (~2.5 KB).
- `/images/`: 12 sentiment visuals.

## How It Works
`bitcoin.html` fetches data from CoinGecko (market), mempool.space (network), and Blockchair (blocks) to compute sentiment and metrics:
- **Calculations**:
  - Block reward: 3.125 BTC (2025) + ~0.7 BTC fees.
  - Energy: `hashrate * efficiency / 1e15 * 24` (~374 GWh/day).
  - Dollars per kWh: `(price * dailyBlocks * reward) / energy_kwh` (~$0.16/kWh).
- **Sentiment Logic**:
  ```javascript
  if (dailyBlocks < 130) return { sentiment: "Need Energy", image: "WinterStorm.png", tooltip: "Network strain: Low block production (<130/day, 9.8% below 144/day target) signals insufficient hashrate, requiring more energy to maintain stable coin minting." };
  if (difficulty > DOOMSDAY_DIFFICULTY) return { sentiment: "Doom's Day", image: "DoomsDay.png" };
  if (dailyEnergyKwh > RENEWABLES_ENERGY_MAX) return { sentiment: "Working too Hard", image: "DrySummer.png" };
  if (priceChange > 0.005) return { sentiment: "Bullish", image: `SpringBloom-${Math.min(priceChange * 100, 1).toFixed(1)}.png` };
  if (priceChange < -0.005) return { sentiment: "Bearish", image: `Fall-${Math.min(-priceChange * 100, 1).toFixed(1)}.png` };
  return { sentiment: "Neutral", image: "NeutralMarket.jpg" };
  ```
- **Outputs**: Updates statue image, tooltip, and metrics.

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/macroadster/howssatoshi.git
   ```
2. Open `bitcoin.html` in a browser (e.g., `file:///path/to/howssatoshi/bitcoin.html`).
3. APIs: Public, no authentication needed.
4. Customize: Edit `bitcoin.html` thresholds (e.g., `HARD_DIFFICULTY_THRESHOLD`).

## Limitations
- `dollarsPerKWatt` omits fees (~0.7 BTC/block).
- mempool.space returns EH/s, needs ×10¹⁸ for H/s.
- Difficulty bound (2.06e67) is approximate.

## Future Improvements
- Include transaction fees in `dollarsPerKWatt`.
- Dynamic difficulty threshold.
- Rig-specific efficiency for scaling.
- Charts for trends (e.g., blocks vs. energy).

## License
Apache 2.0 License. See [LICENSE](https://github.com/macroadster/howssatoshi/blob/main/LICENSE) for details.

## About
Built by [macroadster](https://github.com/macroadster) to visualize Bitcoin sentiment and support miner scaling.
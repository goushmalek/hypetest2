# Hyperliquid DEX Market Maker Bot

A fully autonomous, high-performance market-making bot for Hyperliquid DEX with advanced features including adaptive intelligence, risk management, and self-optimization.

![Hyperliquid Market Maker](https://i.imgur.com/placeholder.png)

## 🚀 Features

### 💼 Wallet Integration
- Seamless connection to wallet address 0xE68c93e73D6841a0640E8ACc528494287366f084
- AES-256-GCM encryption for secure credential management
- Autonomous trading without manual private key input

### 🔌 API Architecture
- Redundant WebSocket connections with automatic failover
- Intelligent rate-limiting to prevent API throttling
- Parallel order processing for maximum efficiency
- Sub-50ms latency for high-frequency trading operations

### 📊 Market Making Engine
- Multi-tier spread algorithms based on volatility metrics:
  - 5-minute (short-term)
  - 1-hour (medium-term)
  - 24-hour (long-term)
- Dynamic inventory management with directional bias
- Order book imbalance detection for opportunistic spread adjustments
- Layered order placement with configurable depth

### 🧠 Adaptive Intelligence
- Market regime detection (momentum/mean-reversion/ranging)
- Reinforcement learning for parameter optimization
- Bayesian optimization for unsupervised tuning
- Flash crash/spike protection with automatic strategy adjustment

### 🛡️ Risk Management
- Multi-layered circuit breakers (position/asset/portfolio)
- Volatility-adjusted position sizing
- Asymmetric stop-loss/take-profit with trailing functionality
- Correlation-based portfolio balancing

### 📈 Performance Analytics
- Real-time P&L attribution
- Spread capture efficiency metrics
- Slippage measurement and optimization
- Strategy performance benchmarking

### 🔄 Self-Optimization
- Genetic algorithms for parameter evolution
- A/B testing of strategy variants
- Time-series decomposition for regime-based strategy selection
- Automated drawdown analysis and adjustment

### 🔒 Security Architecture
- Multi-signature protocols for high-value transactions
- Tiered security based on transaction value
- Real-time anomaly detection
- Tamper-evident audit logging

## 🏗️ Architecture

```
src/bot/
  ├── config/           # Configuration modules
  │   └── wallet.ts     # Wallet configuration and management
  ├── core/             # Core bot functionality
  │   ├── analytics.ts  # Performance analytics
  │   ├── marketMaker.ts # Market-making engine
  │   ├── optimizer.ts  # Self-optimization framework
  │   ├── riskManager.ts # Risk management system
  │   └── security.ts   # Security architecture
  ├── services/         # External services integration
  │   └── api.ts        # Hyperliquid API integration
  ├── types/            # TypeScript type definitions
  │   └── index.ts      # Bot type definitions
  └── index.ts          # Main bot class
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- A Hyperliquid account
- A wallet with the address 0xE68c93e73D6841a0640E8ACc528494287366f084

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/hyperliquid-market-maker.git
   cd hyperliquid-market-maker
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file with your environment variables:
   ```
   NEXT_PUBLIC_HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
   NEXT_PUBLIC_HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000/bot](http://localhost:3000/bot) in your browser to access the bot dashboard.

## 📋 Usage Guide

### Connecting Your Wallet

1. Navigate to the bot dashboard at `/bot`
2. Click "Connect Wallet" and approve the connection request
3. Ensure you're using the wallet with address 0xE68c93e73D6841a0640E8ACc528494287366f084

### Initializing the Bot

1. Enter your encryption key in the provided field
2. Click "Initialize Bot"
3. The bot will securely store your encrypted credentials

### Configuring the Bot

The bot comes with optimized default settings, but you can customize:

- **Trading Pairs**: Which cryptocurrency pairs to trade
- **Spread Settings**: Base spread tiers and adjustment parameters
- **Inventory Management**: Target ratios and rebalancing thresholds
- **Risk Parameters**: Position limits, stop-loss/take-profit settings
- **Optimization Settings**: Parameter ranges and intervals

### Starting the Bot

1. Click the "Start" button on the dashboard
2. The bot will connect to Hyperliquid's API and begin market making
3. Monitor the bot's performance in real-time through the dashboard

### Monitoring Performance

The dashboard provides several tabs for monitoring:

- **Dashboard**: Overview of P&L, trading activity, and risk exposure
- **Performance**: Detailed metrics by trading pair and execution quality
- **Settings**: Current bot configuration
- **Logs**: Activity logs and alerts

### Stopping the Bot

1. Click the "Stop" button on the dashboard
2. The bot will safely close all open orders and disconnect

## ⚙️ Configuration Options

### Market Making Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `baseTiers.tier1` | Spread percentage for normal conditions | 0.1% |
| `baseTiers.tier2` | Spread percentage for medium volatility | 0.2% |
| `baseTiers.tier3` | Spread percentage for high volatility | 0.5% |
| `targetRatio` | Target inventory ratio (0.5 = 50% base, 50% quote) | 0.5 |
| `rebalanceThreshold` | Threshold to trigger inventory rebalancing | 0.1 |
| `orderRefreshInterval` | How often to refresh orders (ms) | 5000 |

### Risk Management Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `stopLoss.percentage` | Stop-loss percentage from entry | 5% |
| `takeProfit.percentage` | Take-profit percentage from entry | 10% |
| `circuitBreakers.volatilityThreshold` | Volatility threshold for circuit breaker | 100% |
| `maxLeverage` | Maximum allowed leverage | 5.0 |

### Optimization Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `optimizationInterval` | How often to run optimization (hours) | 24 |
| `geneticAlgorithm.populationSize` | Population size for genetic algorithm | 20 |
| `abTesting.variants` | Number of A/B test variants | 2 |

## 🔍 Advanced Features

### Market Regime Detection

The bot automatically detects the current market regime:

- **Momentum**: Trends with strong directional movement
- **Mean-Reversion**: Oscillating price action around a mean
- **Ranging**: Low volatility sideways movement

It adjusts its strategy accordingly to optimize performance in each regime.

### Genetic Algorithm Optimization

The bot uses genetic algorithms to evolve its parameters:

1. Creates a population of parameter sets
2. Evaluates each set's performance
3. Selects the best performers for "breeding"
4. Creates new parameter sets through crossover and mutation
5. Repeats the process to continuously improve

### Multi-Signature Security

For high-value transactions, the bot implements multi-signature security:

1. Bot initiates the transaction
2. Transaction requires additional signatures based on value
3. Only executes when required signatures are collected
4. Provides tamper-evident audit trail

## 🔧 Troubleshooting

### Common Issues

- **Connection Problems**: Check your internet connection and Hyperliquid API status
- **Initialization Failures**: Verify your wallet connection and encryption key
- **Trading Issues**: Ensure sufficient funds and check risk limits
- **Performance Concerns**: Allow time for self-optimization to work

### Logs and Debugging

The bot provides comprehensive logging:

- **Info**: Normal operation events
- **Warning**: Potential issues that don't stop operation
- **Error**: Problems that prevent normal operation
- **Debug**: Detailed information for troubleshooting

## 🚀 Production Deployment

For production use:

1. Deploy to a reliable server with 24/7 uptime
2. Set up monitoring and alerts
3. Start with smaller position sizes
4. Gradually increase as performance is verified
5. Regularly back up your encryption key

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This bot is provided for educational and research purposes only. Use at your own risk. Trading cryptocurrencies involves significant risk and can result in the loss of your invested capital. You should not invest more than you can afford to lose.

---

## 📞 Support

For questions or support, please open an issue on the GitHub repository or contact the development team.

Happy trading! 📈

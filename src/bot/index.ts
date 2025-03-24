import { EventEmitter } from "events"
import { BotConfig } from "./types"
import { WalletManager, createWalletManager } from "./config/wallet"
import { HyperliquidAPI, createHyperliquidAPI } from "./services/api"
import { MarketMaker, createMarketMaker } from "./core/marketMaker"
import { RiskManager, createRiskManager } from "./core/riskManager"
import { PerformanceAnalytics, createPerformanceAnalytics } from "./core/analytics"
import { Optimizer, createOptimizer } from "./core/optimizer"
import { SecurityManager, createSecurityManager } from "./core/security"

/**
 * HyperliquidBot is the main class that integrates all components of the
 * Hyperliquid DEX market-making bot.
 */
export class HyperliquidBot extends EventEmitter {
  private config: BotConfig
  private walletManager: WalletManager
  private api: HyperliquidAPI
  private marketMaker: MarketMaker
  private riskManager: RiskManager
  private analytics: PerformanceAnalytics
  private optimizer: Optimizer
  private securityManager: SecurityManager
  private isRunning = false
  private startTime = 0
  private healthCheckInterval?: NodeJS.Timeout

  /**
   * Creates a new HyperliquidBot instance
   * @param config Bot configuration
   */
  constructor(config: BotConfig) {
    super()
    this.config = config
    
    // Initialize components
    this.walletManager = createWalletManager(config.wallet.address)
    this.api = createHyperliquidAPI()
    this.marketMaker = createMarketMaker(this.api)
    this.riskManager = createRiskManager(this.api)
    this.analytics = createPerformanceAnalytics(this.api, this.config.marketMaking.pairs)
    this.optimizer = createOptimizer(this.api, this.analytics, this.config)
    this.securityManager = createSecurityManager(this.api, this.walletManager)
    
    // Set up event listeners
    this.setupEventListeners()
  }

  /**
   * Set up event listeners between components
   */
  private setupEventListeners(): void {
    // Risk manager events
    this.riskManager.on("limit_exceeded", (data) => {
      console.log("Risk limit exceeded:", data)
      this.emit("risk_limit_exceeded", data)
    })
    
    this.riskManager.on("circuit_breaker_triggered", (data) => {
      console.log("Circuit breaker triggered:", data)
      this.emit("circuit_breaker_triggered", data)
      
      // Pause market making for the affected symbol
      if (this.isRunning) {
        // In a real implementation, you would pause only for the affected symbol
        // For simplicity, we'll just log the event
        console.log(`Market making would be paused for ${data.symbol} until ${new Date(data.cooldownUntil).toISOString()}`)
      }
    })
    
    // Security manager events
    this.securityManager.on("anomaly_detected", (data) => {
      console.log("Security anomaly detected:", data)
      this.emit("security_anomaly_detected", data)
    })
    
    this.securityManager.on("transaction_pending", (data) => {
      console.log("Transaction pending approval:", data)
      this.emit("transaction_pending", data)
    })
    
    // Optimizer events
    this.optimizer.on("config_update", ({ config }) => {
      console.log("Bot configuration updated by optimizer")
      this.config = config
      this.emit("config_updated", config)
    })
    
    // API connection events
    this.api.on("ws_error", (data) => {
      console.error("WebSocket error:", data)
      this.emit("connection_error", {
        type: "websocket",
        details: data
      })
    })
    
    this.api.on("ws_close", (data) => {
      console.log("WebSocket connection closed:", data)
      this.emit("connection_closed", {
        type: "websocket",
        details: data
      })
    })
  }

  /**
   * Initialize the bot with encryption key
   * @param encryptionKey Encryption key for wallet credentials
   * @returns True if initialization was successful
   */
  public async initialize(encryptionKey: string): Promise<boolean> {
    try {
      console.log("Initializing Hyperliquid bot...")
      
      // Initialize wallet manager
      const walletInitialized = await this.walletManager.initialize(encryptionKey)
      if (!walletInitialized) {
        console.error("Failed to initialize wallet manager")
        return false
      }
      
      // Initialize API connection
      const apiInitialized = await this.api.initialize()
      if (!apiInitialized) {
        console.error("Failed to initialize API connection")
        return false
      }
      
      console.log("Hyperliquid bot initialized successfully")
      return true
    } catch (error) {
      console.error("Failed to initialize bot:", error)
      return false
    }
  }

  /**
   * Start the bot
   * @returns True if bot was started successfully
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("Bot already running")
      return true
    }
    
    try {
      console.log("Starting Hyperliquid bot...")
      
      // Check if wallet is ready
      if (!this.walletManager.isReady()) {
        console.error("Wallet not ready, please initialize the bot first")
        return false
      }
      
      // Connect to wallet
      await this.walletManager.connect()
      
      // Start components in sequence
      await this.securityManager.start()
      await this.riskManager.start()
      await this.analytics.start()
      
      // Only start market maker if enabled in config
      if (this.config.marketMaking.enabled) {
        await this.marketMaker.start()
      }
      
      // Start optimizer if enabled in config
      if (this.config.optimization.enable) {
        await this.optimizer.start()
      }
      
      // Start health check interval
      this.startHealthCheck()
      
      this.isRunning = true
      this.startTime = Date.now()
      
      console.log("Hyperliquid bot started successfully")
      this.emit("bot_started", {
        timestamp: this.startTime,
        config: this.config
      })
      
      return true
    } catch (error) {
      console.error("Failed to start bot:", error)
      return false
    }
  }

  /**
   * Stop the bot
   * @returns True if bot was stopped successfully
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning) {
      console.log("Bot not running")
      return true
    }
    
    try {
      console.log("Stopping Hyperliquid bot...")
      
      // Stop health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = undefined
      }
      
      // Stop components in reverse sequence
      if (this.config.optimization.enable) {
        await this.optimizer.stop()
      }
      
      if (this.config.marketMaking.enabled) {
        await this.marketMaker.stop()
      }
      
      await this.analytics.stop()
      await this.riskManager.stop()
      await this.securityManager.stop()
      
      // Close API connection
      this.api.close()
      
      this.isRunning = false
      
      console.log("Hyperliquid bot stopped successfully")
      this.emit("bot_stopped", {
        timestamp: Date.now(),
        runningTime: Date.now() - this.startTime
      })
      
      return true
    } catch (error) {
      console.error("Failed to stop bot:", error)
      return false
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth()
    }, 30000)
  }

  /**
   * Check bot health
   */
  private checkHealth(): void {
    if (!this.isRunning) {
      return
    }
    
    const health = {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      components: {
        api: this.api.getActiveWebSocket() !== undefined,
        marketMaker: this.config.marketMaking.enabled,
        riskManager: true,
        analytics: true,
        optimizer: this.config.optimization.enable,
        securityManager: true
      },
      status: "healthy"
    }
    
    // Check if any critical component is down
    if (!health.components.api) {
      health.status = "degraded"
    }
    
    this.emit("health_check", health)
  }

  /**
   * Update bot configuration
   * @param config New configuration
   * @returns True if configuration was updated successfully
   */
  public async updateConfig(config: Partial<BotConfig>): Promise<boolean> {
    try {
      console.log("Updating bot configuration...")
      
      // Create new config by merging current config with updates
      const newConfig = {
        ...this.config,
        ...config,
        // Handle nested objects
        wallet: {
          ...this.config.wallet,
          ...(config.wallet || {})
        },
        api: {
          ...this.config.api,
          ...(config.api || {})
        },
        marketMaking: {
          ...this.config.marketMaking,
          ...(config.marketMaking || {})
        },
        risk: {
          ...this.config.risk,
          ...(config.risk || {})
        },
        optimization: {
          ...this.config.optimization,
          ...(config.optimization || {})
        },
        security: {
          ...this.config.security,
          ...(config.security || {})
        },
        logging: {
          ...this.config.logging,
          ...(config.logging || {})
        }
      }
      
      // If bot is running, restart components affected by config changes
      if (this.isRunning) {
        // For simplicity, we'll just restart the entire bot
        // In a real implementation, you would only restart affected components
        await this.stop()
        this.config = newConfig as BotConfig
        await this.start()
      } else {
        this.config = newConfig as BotConfig
      }
      
      console.log("Bot configuration updated successfully")
      this.emit("config_updated", this.config)
      
      return true
    } catch (error) {
      console.error("Failed to update bot configuration:", error)
      return false
    }
  }

  /**
   * Get bot status
   * @returns Bot status
   */
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime > 0 ? new Date(this.startTime).toISOString() : null,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      wallet: {
        address: this.walletManager.getAddress(),
        isReady: this.walletManager.isReady()
      },
      components: {
        marketMaker: this.marketMaker.getState(),
        riskManager: this.riskManager.getState(),
        analytics: this.analytics.getState(),
        optimizer: this.optimizer.getState(),
        securityManager: this.securityManager.getState()
      }
    }
  }

  /**
   * Get performance metrics
   * @returns Performance metrics
   */
  public getPerformanceMetrics(): any {
    return this.analytics.getPerformanceReport()
  }

  /**
   * Get bot configuration
   * @returns Bot configuration
   */
  public getConfig(): BotConfig {
    return { ...this.config }
  }
}

/**
 * Create a default bot configuration
 * @param walletAddress Wallet address
 * @returns Default bot configuration
 */
export function createDefaultBotConfig(walletAddress: string): BotConfig {
  return {
    name: "Hyperliquid DEX Market Maker",
    version: "1.0.0",
    wallet: {
      address: walletAddress
    },
    api: {
      wsEndpoint: "wss://api.hyperliquid.xyz/ws",
      restEndpoint: "https://api.hyperliquid.xyz",
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: {
        maxRequests: 10,
        timeWindow: 1000
      }
    },
    marketMaking: {
      enabled: true,
      pairs: ["BTC-USDT", "ETH-USDT"],
      spread: {
        baseTiers: {
          tier1: 0.1,
          tier2: 0.2,
          tier3: 0.5
        },
        volatilityAdjustment: {
          enable: true,
          lookbackPeriods: {
            short: 5,
            medium: 60,
            long: 1440
          },
          thresholds: {
            medium: 50,
            high: 100
          }
        },
        orderBookImbalanceAdjustment: {
          enable: true,
          threshold: 0.2,
          adjustmentFactor: 0.5
        }
      },
      inventory: {
        targetRatio: 0.5,
        rebalanceThreshold: 0.1,
        maxImbalance: 5,
        rebalanceStrategy: "passive"
      },
      orders: {
        minOrderSize: 0.001,
        maxOrderSize: 1.0,
        orderSizeIncrement: 0.001,
        priceIncrement: 0.01,
        maxOpenOrders: 10,
        orderRefreshInterval: 5000,
        layering: {
          enable: true,
          levels: 3,
          sizeMultiplier: 1.5,
          spreadMultiplier: 1.0
        }
      }
    },
    risk: {
      positionLimits: {
        "BTC-USDT": {
          maxLongSize: 1.0,
          maxShortSize: 1.0,
          maxLeverage: 5.0
        },
        "ETH-USDT": {
          maxLongSize: 10.0,
          maxShortSize: 10.0,
          maxLeverage: 5.0
        }
      },
      portfolioLimit: {
        maxTotalExposure: 100000,
        maxDrawdown: 10
      },
      stopLoss: {
        enable: true,
        percentage: 5,
        trailingEnable: true,
        trailingPercentage: 2
      },
      takeProfit: {
        enable: true,
        percentage: 10
      },
      circuitBreakers: {
        enable: true,
        volatilityThreshold: 100,
        timeWindow: 5,
        cooldownPeriod: 15
      }
    },
    optimization: {
      enable: true,
      optimizationInterval: 24,
      parameterRanges: {
        "marketMaking.spread.baseTiers.tier1": {
          min: 0.05,
          max: 0.5,
          step: 0.01
        },
        "marketMaking.spread.baseTiers.tier2": {
          min: 0.1,
          max: 1.0,
          step: 0.01
        },
        "marketMaking.spread.baseTiers.tier3": {
          min: 0.2,
          max: 2.0,
          step: 0.01
        },
        "marketMaking.spread.volatilityAdjustment.thresholds.medium": {
          min: 30,
          max: 80,
          step: 5
        },
        "marketMaking.spread.volatilityAdjustment.thresholds.high": {
          min: 60,
          max: 150,
          step: 5
        },
        "marketMaking.inventory.targetRatio": {
          min: 0.3,
          max: 0.7,
          step: 0.05
        },
        "marketMaking.inventory.rebalanceThreshold": {
          min: 0.05,
          max: 0.3,
          step: 0.01
        },
        "risk.stopLoss.percentage": {
          min: 1,
          max: 10,
          step: 0.5
        },
        "risk.takeProfit.percentage": {
          min: 2,
          max: 20,
          step: 0.5
        }
      },
      geneticAlgorithm: {
        populationSize: 20,
        generations: 5,
        mutationRate: 0.1,
        crossoverRate: 0.7
      },
      abTesting: {
        enable: true,
        variants: 2,
        testDuration: 24
      }
    },
    security: {
      multiSig: {
        enable: true,
        requiredSignatures: 2,
        authorizedAddresses: [
          walletAddress,
          "0x0000000000000000000000000000000000000000"
        ]
      },
      transactionLimits: {
        tier1: {
          maxAmount: 1000,
          securityLevel: "low"
        },
        tier2: {
          maxAmount: 10000,
          securityLevel: "medium"
        },
        tier3: {
          maxAmount: Number.MAX_SAFE_INTEGER,
          securityLevel: "high"
        }
      },
      anomalyDetection: {
        enable: true,
        sensitivityLevel: "medium",
        alertThreshold: 3.0
      }
    },
    logging: {
      level: "info",
      logToFile: true,
      logFilePath: "./logs/hyperliquid-bot.log"
    }
  }
}

/**
 * Create a HyperliquidBot instance with default configuration
 * @param walletAddress Wallet address
 * @returns HyperliquidBot instance
 */
export function createBot(walletAddress: string): HyperliquidBot {
  const config = createDefaultBotConfig(walletAddress)
  return new HyperliquidBot(config)
}
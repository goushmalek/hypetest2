import { z } from "zod"

// Wallet Configuration Types
export interface WalletConfig {
  address: string
  encryptedCredentials?: string
}

// API Types
export interface ApiConfig {
  wsEndpoint: string
  restEndpoint: string
  maxRetries: number
  retryDelay: number
  rateLimit: {
    maxRequests: number
    timeWindow: number // in milliseconds
  }
}

export interface WebSocketMessage {
  type: string
  data: any
}

export interface OrderBookData {
  asks: [number, number][] // [price, size]
  bids: [number, number][] // [price, size]
  timestamp: number
}

export interface MarketData {
  symbol: string
  lastPrice: number
  markPrice: number
  indexPrice: number
  fundingRate: number
  volume24h: number
  openInterest: number
}

// Market Making Types
export interface SpreadConfig {
  baseTiers: {
    tier1: number // Percentage for normal conditions
    tier2: number // Percentage for medium volatility
    tier3: number // Percentage for high volatility
  }
  volatilityAdjustment: {
    enable: boolean
    lookbackPeriods: {
      short: number // in minutes
      medium: number // in minutes
      long: number // in minutes
    }
    thresholds: {
      medium: number // Volatility threshold for medium tier
      high: number // Volatility threshold for high tier
    }
  }
  orderBookImbalanceAdjustment: {
    enable: boolean
    threshold: number // Imbalance threshold to trigger adjustment
    adjustmentFactor: number // How much to adjust the spread
  }
}

export interface InventoryConfig {
  targetRatio: number // Target inventory ratio (0.5 means 50% base, 50% quote)
  rebalanceThreshold: number // Threshold to trigger rebalancing
  maxImbalance: number // Maximum allowed imbalance
  rebalanceStrategy: "passive" | "aggressive" // How to rebalance
}

export interface OrderConfig {
  minOrderSize: number
  maxOrderSize: number
  orderSizeIncrement: number
  priceIncrement: number
  maxOpenOrders: number
  orderRefreshInterval: number // in milliseconds
  layering: {
    enable: boolean
    levels: number
    sizeMultiplier: number // How size changes across levels
    spreadMultiplier: number // How spread changes across levels
  }
}

export interface MarketMakingConfig {
  enabled: boolean
  pairs: string[] // Trading pairs to market make on
  spread: SpreadConfig
  inventory: InventoryConfig
  orders: OrderConfig
}

// Risk Management Types
export interface PositionLimit {
  maxLongSize: number
  maxShortSize: number
  maxLeverage: number
}

export interface RiskConfig {
  positionLimits: Record<string, PositionLimit> // Per asset position limits
  portfolioLimit: {
    maxTotalExposure: number
    maxDrawdown: number
  }
  stopLoss: {
    enable: boolean
    percentage: number // Percentage from entry price
    trailingEnable: boolean
    trailingPercentage: number
  }
  takeProfit: {
    enable: boolean
    percentage: number // Percentage from entry price
  }
  circuitBreakers: {
    enable: boolean
    volatilityThreshold: number
    timeWindow: number // in minutes
    cooldownPeriod: number // in minutes
  }
}

// Performance Analytics Types
export interface PerformanceMetrics {
  pnl: {
    realized: number
    unrealized: number
    total: number
  }
  trades: {
    count: number
    winRate: number
    averageProfit: number
    averageLoss: number
    profitFactor: number
  }
  exposure: {
    current: number
    average: number
    max: number
  }
  spreadCapture: {
    efficiency: number // Percentage of theoretical spread captured
    slippage: number // Average slippage
  }
}

// Self-Optimization Types
export interface OptimizationConfig {
  enable: boolean
  optimizationInterval: number // in hours
  parameterRanges: {
    [key: string]: {
      min: number
      max: number
      step: number
    }
  }
  geneticAlgorithm: {
    populationSize: number
    generations: number
    mutationRate: number
    crossoverRate: number
  }
  abTesting: {
    enable: boolean
    variants: number
    testDuration: number // in hours
  }
}

// Security Types
export interface SecurityConfig {
  multiSig: {
    enable: boolean
    requiredSignatures: number
    authorizedAddresses: string[]
  }
  transactionLimits: {
    tier1: {
      maxAmount: number
      securityLevel: "low" | "medium" | "high"
    }
    tier2: {
      maxAmount: number
      securityLevel: "low" | "medium" | "high"
    }
    tier3: {
      maxAmount: number
      securityLevel: "low" | "medium" | "high"
    }
  }
  anomalyDetection: {
    enable: boolean
    sensitivityLevel: "low" | "medium" | "high"
    alertThreshold: number
  }
}

// Bot Configuration Type
export interface BotConfig {
  name: string
  version: string
  wallet: WalletConfig
  api: ApiConfig
  marketMaking: MarketMakingConfig
  risk: RiskConfig
  optimization: OptimizationConfig
  security: SecurityConfig
  logging: {
    level: "debug" | "info" | "warn" | "error"
    logToFile: boolean
    logFilePath?: string
  }
}

// Order Types
export type OrderSide = "buy" | "sell"
export type OrderType = "limit" | "market" | "stopLimit" | "stopMarket"
export type OrderStatus = "new" | "partiallyFilled" | "filled" | "canceled" | "rejected" | "expired"

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  price: number
  size: number
  status: OrderStatus
  filledSize: number
  avgFillPrice: number
  timestamp: number
  clientOrderId?: string
}

// Position Types
export interface Position {
  symbol: string
  size: number // Positive for long, negative for short
  entryPrice: number
  markPrice: number
  liquidationPrice: number
  unrealizedPnl: number
  realizedPnl: number
  leverage: number
  marginType: "isolated" | "cross"
}

// Validation Schemas
export const botConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  wallet: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    encryptedCredentials: z.string().optional()
  }),
  api: z.object({
    wsEndpoint: z.string().url(),
    restEndpoint: z.string().url(),
    maxRetries: z.number().int().positive(),
    retryDelay: z.number().int().positive(),
    rateLimit: z.object({
      maxRequests: z.number().int().positive(),
      timeWindow: z.number().int().positive()
    })
  }),
  marketMaking: z.object({
    enabled: z.boolean(),
    pairs: z.array(z.string()),
    spread: z.object({
      baseTiers: z.object({
        tier1: z.number().positive(),
        tier2: z.number().positive(),
        tier3: z.number().positive()
      }),
      volatilityAdjustment: z.object({
        enable: z.boolean(),
        lookbackPeriods: z.object({
          short: z.number().int().positive(),
          medium: z.number().int().positive(),
          long: z.number().int().positive()
        }),
        thresholds: z.object({
          medium: z.number().positive(),
          high: z.number().positive()
        })
      }),
      orderBookImbalanceAdjustment: z.object({
        enable: z.boolean(),
        threshold: z.number().positive(),
        adjustmentFactor: z.number().positive()
      })
    }),
    inventory: z.object({
      targetRatio: z.number().min(0).max(1),
      rebalanceThreshold: z.number().positive(),
      maxImbalance: z.number().positive(),
      rebalanceStrategy: z.enum(["passive", "aggressive"])
    }),
    orders: z.object({
      minOrderSize: z.number().positive(),
      maxOrderSize: z.number().positive(),
      orderSizeIncrement: z.number().positive(),
      priceIncrement: z.number().positive(),
      maxOpenOrders: z.number().int().positive(),
      orderRefreshInterval: z.number().int().positive(),
      layering: z.object({
        enable: z.boolean(),
        levels: z.number().int().positive(),
        sizeMultiplier: z.number().positive(),
        spreadMultiplier: z.number().positive()
      })
    })
  }),
  risk: z.object({
    positionLimits: z.record(z.object({
      maxLongSize: z.number().positive(),
      maxShortSize: z.number().positive(),
      maxLeverage: z.number().positive()
    })),
    portfolioLimit: z.object({
      maxTotalExposure: z.number().positive(),
      maxDrawdown: z.number().positive()
    }),
    stopLoss: z.object({
      enable: z.boolean(),
      percentage: z.number().positive(),
      trailingEnable: z.boolean(),
      trailingPercentage: z.number().positive()
    }),
    takeProfit: z.object({
      enable: z.boolean(),
      percentage: z.number().positive()
    }),
    circuitBreakers: z.object({
      enable: z.boolean(),
      volatilityThreshold: z.number().positive(),
      timeWindow: z.number().int().positive(),
      cooldownPeriod: z.number().int().positive()
    })
  }),
  optimization: z.object({
    enable: z.boolean(),
    optimizationInterval: z.number().int().positive(),
    parameterRanges: z.record(z.object({
      min: z.number(),
      max: z.number(),
      step: z.number().positive()
    })),
    geneticAlgorithm: z.object({
      populationSize: z.number().int().positive(),
      generations: z.number().int().positive(),
      mutationRate: z.number().min(0).max(1),
      crossoverRate: z.number().min(0).max(1)
    }),
    abTesting: z.object({
      enable: z.boolean(),
      variants: z.number().int().positive(),
      testDuration: z.number().int().positive()
    })
  }),
  security: z.object({
    multiSig: z.object({
      enable: z.boolean(),
      requiredSignatures: z.number().int().positive(),
      authorizedAddresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
    }),
    transactionLimits: z.object({
      tier1: z.object({
        maxAmount: z.number().positive(),
        securityLevel: z.enum(["low", "medium", "high"])
      }),
      tier2: z.object({
        maxAmount: z.number().positive(),
        securityLevel: z.enum(["low", "medium", "high"])
      }),
      tier3: z.object({
        maxAmount: z.number().positive(),
        securityLevel: z.enum(["low", "medium", "high"])
      })
    }),
    anomalyDetection: z.object({
      enable: z.boolean(),
      sensitivityLevel: z.enum(["low", "medium", "high"]),
      alertThreshold: z.number().positive()
    })
  }),
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]),
    logToFile: z.boolean(),
    logFilePath: z.string().optional()
  })
})
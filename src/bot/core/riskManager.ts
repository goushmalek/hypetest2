import { EventEmitter } from "events"
import {
  RiskConfig,
  Position,
  MarketData,
  Order,
  OrderSide
} from "../types"
import { HyperliquidAPI } from "../services/api"

/**
 * RiskManager implements comprehensive risk management for the Hyperliquid DEX bot.
 * It handles position limits, stop-loss/take-profit, and circuit breakers.
 */
export class RiskManager extends EventEmitter {
  private config: RiskConfig
  private api: HyperliquidAPI
  private positions: Map<string, Position> = new Map() // symbol -> Position
  private marketData: Map<string, MarketData> = new Map() // symbol -> MarketData
  private stopLossOrders: Map<string, Order> = new Map() // positionId -> Order
  private takeProfitOrders: Map<string, Order> = new Map() // positionId -> Order
  private circuitBreakers: Map<string, {
    triggered: boolean,
    cooldownUntil: number,
    lastVolatility: number,
    priceHistory: Array<{ price: number, timestamp: number }>
  }> = new Map() // symbol -> circuit breaker state
  private isRunning = false
  private monitorInterval?: NodeJS.Timeout

  /**
   * Creates a new RiskManager instance
   * @param config Risk management configuration
   * @param api HyperliquidAPI instance
   */
  constructor(config: RiskConfig, api: HyperliquidAPI) {
    super()
    this.config = config
    this.api = api
    
    // Set up API event listeners
    this.setupEventListeners()
  }

  /**
   * Set up event listeners for API events
   */
  private setupEventListeners(): void {
    // Position updates
    this.api.on("position", (position: Position) => {
      const prevPosition = this.positions.get(position.symbol)
      this.positions.set(position.symbol, position)
      
      // Check if this is a new position or position size changed
      if (!prevPosition || prevPosition.size !== position.size) {
        this.handlePositionChange(position, prevPosition)
      }
      
      // Check position limits
      this.checkPositionLimits(position)
      
      this.emit("position_update", position)
    })
    
    // Market data updates
    this.api.on("market", (data: MarketData) => {
      this.marketData.set(data.symbol, data)
      
      // Update circuit breaker price history
      this.updateCircuitBreakerPriceHistory(data.symbol, data.lastPrice)
      
      // Check stop-loss and take-profit for all positions
      const position = this.positions.get(data.symbol)
      if (position) {
        this.checkStopLossAndTakeProfit(position, data.lastPrice)
      }
      
      // Check circuit breakers
      if (this.config.circuitBreakers.enable) {
        this.checkCircuitBreaker(data.symbol, data.lastPrice)
      }
      
      this.emit("market_update", data)
    })
    
    // Order updates
    this.api.on("order", (order: Order) => {
      // Update stop-loss and take-profit orders
      for (const [positionId, slOrder] of this.stopLossOrders.entries()) {
        if (slOrder.id === order.id) {
          if (order.status === "filled") {
            console.log(`Stop-loss triggered for position ${positionId}`)
            this.stopLossOrders.delete(positionId)
            this.emit("stop_loss_triggered", { positionId, order })
          } else if (order.status === "canceled" || order.status === "rejected" || order.status === "expired") {
            this.stopLossOrders.delete(positionId)
          } else {
            this.stopLossOrders.set(positionId, order)
          }
        }
      }
      
      for (const [positionId, tpOrder] of this.takeProfitOrders.entries()) {
        if (tpOrder.id === order.id) {
          if (order.status === "filled") {
            console.log(`Take-profit triggered for position ${positionId}`)
            this.takeProfitOrders.delete(positionId)
            this.emit("take_profit_triggered", { positionId, order })
          } else if (order.status === "canceled" || order.status === "rejected" || order.status === "expired") {
            this.takeProfitOrders.delete(positionId)
          } else {
            this.takeProfitOrders.set(positionId, order)
          }
        }
      }
      
      this.emit("order_update", order)
    })
  }

  /**
   * Start the risk manager
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("Risk manager already running")
      return true
    }
    
    try {
      console.log("Starting risk manager...")
      
      // Fetch initial positions
      await this.fetchInitialData()
      
      // Start monitoring interval
      this.startMonitoring()
      
      this.isRunning = true
      console.log("Risk manager started successfully")
      
      return true
    } catch (error) {
      console.error("Failed to start risk manager:", error)
      return false
    }
  }

  /**
   * Stop the risk manager
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning) {
      console.log("Risk manager not running")
      return true
    }
    
    try {
      console.log("Stopping risk manager...")
      
      // Stop monitoring interval
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval)
        this.monitorInterval = undefined
      }
      
      this.isRunning = false
      console.log("Risk manager stopped successfully")
      
      return true
    } catch (error) {
      console.error("Failed to stop risk manager:", error)
      return false
    }
  }

  /**
   * Fetch initial position data
   */
  private async fetchInitialData(): Promise<void> {
    try {
      // Get positions
      const positions = await this.api.getPositions()
      for (const position of positions) {
        this.positions.set(position.symbol, position)
        
        // Set up stop-loss and take-profit for existing positions
        if (position.size !== 0) {
          this.setupStopLossAndTakeProfit(position)
        }
      }
      
      console.log(`Fetched ${positions.length} positions`)
      
      // Initialize circuit breakers
      for (const position of positions) {
        this.circuitBreakers.set(position.symbol, {
          triggered: false,
          cooldownUntil: 0,
          lastVolatility: 0,
          priceHistory: []
        })
      }
    } catch (error) {
      console.error("Failed to fetch initial position data:", error)
      throw error
    }
  }

  /**
   * Start the risk monitoring interval
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
    }
    
    // Check risk metrics every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.monitorRisk()
    }, 5000)
  }

  /**
   * Monitor overall risk metrics
   */
  private monitorRisk(): void {
    if (!this.isRunning) {
      return
    }
    
    try {
      // Check portfolio limits
      this.checkPortfolioLimits()
      
      // Check for trailing stop-loss updates
      if (this.config.stopLoss.trailingEnable) {
        this.updateTrailingStopLoss()
      }
    } catch (error) {
      console.error("Error in risk monitoring:", error)
    }
  }

  /**
   * Handle position changes
   * @param position New position
   * @param prevPosition Previous position (if any)
   */
  private handlePositionChange(position: Position, prevPosition?: Position): void {
    // If position size is zero, remove any stop-loss and take-profit orders
    if (position.size === 0) {
      this.removeStopLossAndTakeProfit(position.symbol)
      return
    }
    
    // If this is a new position or position direction changed, set up new SL/TP
    if (!prevPosition || Math.sign(prevPosition.size) !== Math.sign(position.size)) {
      this.setupStopLossAndTakeProfit(position)
    }
  }

  /**
   * Check if a position exceeds its limits
   * @param position Position to check
   * @returns True if position exceeds limits
   */
  private checkPositionLimits(position: Position): boolean {
    // Skip if position size is zero
    if (position.size === 0) {
      return false
    }
    
    // Get position limits for this symbol
    const limits = this.config.positionLimits[position.symbol]
    if (!limits) {
      return false // No limits defined for this symbol
    }
    
    let limitExceeded = false
    
    // Check max long size
    if (position.size > 0 && position.size > limits.maxLongSize) {
      console.log(`Position ${position.symbol} exceeds max long size: ${position.size} > ${limits.maxLongSize}`)
      limitExceeded = true
      this.emit("limit_exceeded", {
        symbol: position.symbol,
        limit: "maxLongSize",
        current: position.size,
        max: limits.maxLongSize
      })
    }
    
    // Check max short size
    if (position.size < 0 && Math.abs(position.size) > limits.maxShortSize) {
      console.log(`Position ${position.symbol} exceeds max short size: ${Math.abs(position.size)} > ${limits.maxShortSize}`)
      limitExceeded = true
      this.emit("limit_exceeded", {
        symbol: position.symbol,
        limit: "maxShortSize",
        current: Math.abs(position.size),
        max: limits.maxShortSize
      })
    }
    
    // Check max leverage
    if (position.leverage > limits.maxLeverage) {
      console.log(`Position ${position.symbol} exceeds max leverage: ${position.leverage} > ${limits.maxLeverage}`)
      limitExceeded = true
      this.emit("limit_exceeded", {
        symbol: position.symbol,
        limit: "maxLeverage",
        current: position.leverage,
        max: limits.maxLeverage
      })
    }
    
    return limitExceeded
  }

  /**
   * Check portfolio-wide risk limits
   */
  private checkPortfolioLimits(): void {
    // Calculate total exposure
    let totalExposure = 0
    let totalUnrealizedPnl = 0
    
    for (const position of this.positions.values()) {
      // Skip positions with zero size
      if (position.size === 0) {
        continue
      }
      
      // Add absolute position value to total exposure
      const positionValue = Math.abs(position.size * position.markPrice)
      totalExposure += positionValue
      
      // Add unrealized PnL
      totalUnrealizedPnl += position.unrealizedPnl
    }
    
    // Check max total exposure
    if (totalExposure > this.config.portfolioLimit.maxTotalExposure) {
      console.log(`Portfolio exceeds max total exposure: ${totalExposure} > ${this.config.portfolioLimit.maxTotalExposure}`)
      this.emit("limit_exceeded", {
        limit: "maxTotalExposure",
        current: totalExposure,
        max: this.config.portfolioLimit.maxTotalExposure
      })
    }
    
    // Check max drawdown (if we have negative unrealized PnL)
    if (totalUnrealizedPnl < 0) {
      const drawdownPercentage = Math.abs(totalUnrealizedPnl) / totalExposure * 100
      
      if (drawdownPercentage > this.config.portfolioLimit.maxDrawdown) {
        console.log(`Portfolio exceeds max drawdown: ${drawdownPercentage.toFixed(2)}% > ${this.config.portfolioLimit.maxDrawdown}%`)
        this.emit("limit_exceeded", {
          limit: "maxDrawdown",
          current: drawdownPercentage,
          max: this.config.portfolioLimit.maxDrawdown
        })
      }
    }
  }

  /**
   * Set up stop-loss and take-profit orders for a position
   * @param position Position to set up SL/TP for
   */
  private setupStopLossAndTakeProfit(position: Position): void {
    // Skip if position size is zero
    if (position.size === 0) {
      return
    }
    
    const symbol = position.symbol
    const positionId = `${symbol}-${position.size > 0 ? "long" : "short"}`
    
    // Set up stop-loss if enabled
    if (this.config.stopLoss.enable) {
      this.setupStopLoss(position, positionId)
    }
    
    // Set up take-profit if enabled
    if (this.config.takeProfit.enable) {
      this.setupTakeProfit(position, positionId)
    }
  }

  /**
   * Set up a stop-loss order for a position
   * @param position Position to set up stop-loss for
   * @param positionId Unique position identifier
   */
  private async setupStopLoss(position: Position, positionId: string): Promise<void> {
    try {
      // Calculate stop-loss price
      const isLong = position.size > 0
      const stopLossPercentage = this.config.stopLoss.percentage / 100
      
      let stopPrice
      if (isLong) {
        // For long positions, stop-loss is below entry price
        stopPrice = position.entryPrice * (1 - stopLossPercentage)
      } else {
        // For short positions, stop-loss is above entry price
        stopPrice = position.entryPrice * (1 + stopLossPercentage)
      }
      
      // Round to appropriate precision
      stopPrice = parseFloat(stopPrice.toFixed(2))
      
      // Place stop order
      const side: OrderSide = isLong ? "sell" : "buy"
      const size = Math.abs(position.size)
      
      const order = await this.api.placeOrder({
        symbol: position.symbol,
        side,
        type: "stopMarket",
        price: stopPrice,
        size,
        clientOrderId: `sl-${Date.now()}`
      })
      
      console.log(`Set up stop-loss for ${positionId} at ${stopPrice}`)
      this.stopLossOrders.set(positionId, order)
    } catch (error) {
      console.error(`Failed to set up stop-loss for ${positionId}:`, error)
    }
  }

  /**
   * Set up a take-profit order for a position
   * @param position Position to set up take-profit for
   * @param positionId Unique position identifier
   */
  private async setupTakeProfit(position: Position, positionId: string): Promise<void> {
    try {
      // Calculate take-profit price
      const isLong = position.size > 0
      const takeProfitPercentage = this.config.takeProfit.percentage / 100
      
      let takeProfitPrice
      if (isLong) {
        // For long positions, take-profit is above entry price
        takeProfitPrice = position.entryPrice * (1 + takeProfitPercentage)
      } else {
        // For short positions, take-profit is below entry price
        takeProfitPrice = position.entryPrice * (1 - takeProfitPercentage)
      }
      
      // Round to appropriate precision
      takeProfitPrice = parseFloat(takeProfitPrice.toFixed(2))
      
      // Place limit order
      const side: OrderSide = isLong ? "sell" : "buy"
      const size = Math.abs(position.size)
      
      const order = await this.api.placeOrder({
        symbol: position.symbol,
        side,
        type: "limit",
        price: takeProfitPrice,
        size,
        clientOrderId: `tp-${Date.now()}`
      })
      
      console.log(`Set up take-profit for ${positionId} at ${takeProfitPrice}`)
      this.takeProfitOrders.set(positionId, order)
    } catch (error) {
      console.error(`Failed to set up take-profit for ${positionId}:`, error)
    }
  }

  /**
   * Remove stop-loss and take-profit orders for a position
   * @param symbol Trading symbol
   */
  private async removeStopLossAndTakeProfit(symbol: string): Promise<void> {
    const longPositionId = `${symbol}-long`
    const shortPositionId = `${symbol}-short`
    
    // Cancel and remove stop-loss orders
    const stopLossLong = this.stopLossOrders.get(longPositionId)
    const stopLossShort = this.stopLossOrders.get(shortPositionId)
    
    if (stopLossLong) {
      try {
        await this.api.cancelOrder(symbol, stopLossLong.id)
      } catch (error) {
        console.error(`Failed to cancel stop-loss for ${longPositionId}:`, error)
      }
      this.stopLossOrders.delete(longPositionId)
    }
    
    if (stopLossShort) {
      try {
        await this.api.cancelOrder(symbol, stopLossShort.id)
      } catch (error) {
        console.error(`Failed to cancel stop-loss for ${shortPositionId}:`, error)
      }
      this.stopLossOrders.delete(shortPositionId)
    }
    
    // Cancel and remove take-profit orders
    const takeProfitLong = this.takeProfitOrders.get(longPositionId)
    const takeProfitShort = this.takeProfitOrders.get(shortPositionId)
    
    if (takeProfitLong) {
      try {
        await this.api.cancelOrder(symbol, takeProfitLong.id)
      } catch (error) {
        console.error(`Failed to cancel take-profit for ${longPositionId}:`, error)
      }
      this.takeProfitOrders.delete(longPositionId)
    }
    
    if (takeProfitShort) {
      try {
        await this.api.cancelOrder(symbol, takeProfitShort.id)
      } catch (error) {
        console.error(`Failed to cancel take-profit for ${shortPositionId}:`, error)
      }
      this.takeProfitOrders.delete(shortPositionId)
    }
  }

  /**
   * Check if stop-loss or take-profit should be triggered
   * @param position Position to check
   * @param currentPrice Current market price
   */
  private checkStopLossAndTakeProfit(position: Position, currentPrice: number): void {
    // Skip if position size is zero
    if (position.size === 0) {
      return
    }
    
    const symbol = position.symbol
    const isLong = position.size > 0
    const positionId = `${symbol}-${isLong ? "long" : "short"}`
    
    // Check if we need to update trailing stop-loss
    if (
      this.config.stopLoss.enable &&
      this.config.stopLoss.trailingEnable
    ) {
      this.updateTrailingStopLossForPosition(position, currentPrice, positionId)
    }
  }

  /**
   * Update trailing stop-loss for all positions
   */
  private updateTrailingStopLoss(): void {
    for (const position of this.positions.values()) {
      // Skip positions with zero size
      if (position.size === 0) {
        continue
      }
      
      const marketData = this.marketData.get(position.symbol)
      if (!marketData) {
        continue
      }
      
      const positionId = `${position.symbol}-${position.size > 0 ? "long" : "short"}`
      this.updateTrailingStopLossForPosition(position, marketData.lastPrice, positionId)
    }
  }

  /**
   * Update trailing stop-loss for a specific position
   * @param position Position to update
   * @param currentPrice Current market price
   * @param positionId Unique position identifier
   */
  private async updateTrailingStopLossForPosition(
    position: Position,
    currentPrice: number,
    positionId: string
  ): Promise<void> {
    // Skip if no stop-loss order exists
    const stopLossOrder = this.stopLossOrders.get(positionId)
    if (!stopLossOrder) {
      return
    }
    
    const isLong = position.size > 0
    const trailingPercentage = this.config.stopLoss.trailingPercentage / 100
    
    let newStopPrice
    let shouldUpdate = false
    
    if (isLong) {
      // For long positions, trail upward as price increases
      const trailingDistance = currentPrice * trailingPercentage
      newStopPrice = currentPrice - trailingDistance
      
      // Only update if new stop price is higher than current stop price
      if (newStopPrice > stopLossOrder.price) {
        shouldUpdate = true
      }
    } else {
      // For short positions, trail downward as price decreases
      const trailingDistance = currentPrice * trailingPercentage
      newStopPrice = currentPrice + trailingDistance
      
      // Only update if new stop price is lower than current stop price
      if (newStopPrice < stopLossOrder.price) {
        shouldUpdate = true
      }
    }
    
    if (shouldUpdate) {
      try {
        // Cancel existing stop-loss order
        await this.api.cancelOrder(position.symbol, stopLossOrder.id)
        this.stopLossOrders.delete(positionId)
        
        // Round to appropriate precision
        newStopPrice = parseFloat(newStopPrice.toFixed(2))
        
        // Place new stop order
        const side: OrderSide = isLong ? "sell" : "buy"
        const size = Math.abs(position.size)
        
        const order = await this.api.placeOrder({
          symbol: position.symbol,
          side,
          type: "stopMarket",
          price: newStopPrice,
          size,
          clientOrderId: `sl-${Date.now()}`
        })
        
        console.log(`Updated trailing stop-loss for ${positionId} to ${newStopPrice}`)
        this.stopLossOrders.set(positionId, order)
      } catch (error) {
        console.error(`Failed to update trailing stop-loss for ${positionId}:`, error)
      }
    }
  }

  /**
   * Update circuit breaker price history
   * @param symbol Trading symbol
   * @param price Current price
   */
  private updateCircuitBreakerPriceHistory(symbol: string, price: number): void {
    // Skip if circuit breakers are disabled
    if (!this.config.circuitBreakers.enable) {
      return
    }
    
    let circuitBreaker = this.circuitBreakers.get(symbol)
    if (!circuitBreaker) {
      circuitBreaker = {
        triggered: false,
        cooldownUntil: 0,
        lastVolatility: 0,
        priceHistory: []
      }
      this.circuitBreakers.set(symbol, circuitBreaker)
    }
    
    const now = Date.now()
    
    // Add current price to history
    circuitBreaker.priceHistory.push({
      timestamp: now,
      price
    })
    
    // Keep only data points within the circuit breaker time window
    const timeWindowMs = this.config.circuitBreakers.timeWindow * 60 * 1000
    const cutoffTime = now - timeWindowMs
    
    circuitBreaker.priceHistory = circuitBreaker.priceHistory.filter(
      point => point.timestamp >= cutoffTime
    )
  }

  /**
   * Check if a circuit breaker should be triggered
   * @param symbol Trading symbol
   * @param currentPrice Current market price
   */
  private checkCircuitBreaker(symbol: string, currentPrice: number): void {
    // Skip if circuit breakers are disabled
    if (!this.config.circuitBreakers.enable) {
      return
    }
    
    const circuitBreaker = this.circuitBreakers.get(symbol)
    if (!circuitBreaker) {
      return
    }
    
    const now = Date.now()
    
    // Skip if in cooldown period
    if (circuitBreaker.triggered && now < circuitBreaker.cooldownUntil) {
      return
    }
    
    // Reset triggered state if cooldown period has ended
    if (circuitBreaker.triggered && now >= circuitBreaker.cooldownUntil) {
      circuitBreaker.triggered = false
    }
    
    // Calculate volatility
    const volatility = this.calculateCircuitBreakerVolatility(symbol)
    circuitBreaker.lastVolatility = volatility
    
    // Check if volatility exceeds threshold
    if (volatility > this.config.circuitBreakers.volatilityThreshold) {
      console.log(`Circuit breaker triggered for ${symbol}: volatility ${volatility.toFixed(2)}% > threshold ${this.config.circuitBreakers.volatilityThreshold}%`)
      
      // Set triggered state and cooldown period
      circuitBreaker.triggered = true
      circuitBreaker.cooldownUntil = now + this.config.circuitBreakers.cooldownPeriod * 60 * 1000
      
      this.emit("circuit_breaker_triggered", {
        symbol,
        volatility,
        threshold: this.config.circuitBreakers.volatilityThreshold,
        cooldownUntil: new Date(circuitBreaker.cooldownUntil)
      })
    }
  }

  /**
   * Calculate volatility for circuit breaker
   * @param symbol Trading symbol
   * @returns Volatility as a percentage
   */
  private calculateCircuitBreakerVolatility(symbol: string): number {
    const circuitBreaker = this.circuitBreakers.get(symbol)
    if (!circuitBreaker || circuitBreaker.priceHistory.length < 2) {
      return 0
    }
    
    const priceHistory = circuitBreaker.priceHistory
    
    // Calculate returns
    const returns: number[] = []
    for (let i = 1; i < priceHistory.length; i++) {
      const prevPrice = priceHistory[i - 1].price
      const currentPrice = priceHistory[i].price
      const returnPct = (currentPrice - prevPrice) / prevPrice
      returns.push(returnPct)
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
    const squaredDiffs = returns.map(value => Math.pow(value - mean, 2))
    const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / squaredDiffs.length
    const stdDev = Math.sqrt(variance)
    
    // Convert to percentage and annualize
    // Assuming price points are roughly 1 second apart
    const secondsInYear = 365 * 24 * 60 * 60
    const annualizationFactor = Math.sqrt(secondsInYear / (priceHistory.length - 1))
    const annualizedVolatility = stdDev * annualizationFactor * 100
    
    return annualizedVolatility
  }

  /**
   * Check if a symbol has an active circuit breaker
   * @param symbol Trading symbol
   * @returns True if circuit breaker is active
   */
  public isCircuitBreakerActive(symbol: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(symbol)
    if (!circuitBreaker) {
      return false
    }
    
    return circuitBreaker.triggered && Date.now() < circuitBreaker.cooldownUntil
  }

  /**
   * Get the current state of the risk manager
   * @returns Risk manager state
   */
  public getState(): any {
    return {
      isRunning: this.isRunning,
      positions: Array.from(this.positions.values()),
      stopLossOrders: Array.from(this.stopLossOrders.entries()).map(([id, order]) => ({
        positionId: id,
        order
      })),
      takeProfitOrders: Array.from(this.takeProfitOrders.entries()).map(([id, order]) => ({
        positionId: id,
        order
      })),
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([symbol, state]) => [
          symbol,
          {
            triggered: state.triggered,
            cooldownUntil: state.cooldownUntil,
            lastVolatility: state.lastVolatility
          }
        ])
      )
    }
  }
}

/**
 * Create a default risk configuration
 * @returns Default risk configuration
 */
export function createDefaultRiskConfig(): RiskConfig {
  return {
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
      maxTotalExposure: 100000, // $100,000
      maxDrawdown: 10 // 10%
    },
    stopLoss: {
      enable: true,
      percentage: 5, // 5%
      trailingEnable: true,
      trailingPercentage: 2 // 2%
    },
    takeProfit: {
      enable: true,
      percentage: 10 // 10%
    },
    circuitBreakers: {
      enable: true,
      volatilityThreshold: 100, // 100% annualized volatility
      timeWindow: 5, // 5 minutes
      cooldownPeriod: 15 // 15 minutes
    }
  }
}

/**
 * Create a RiskManager instance with default configuration
 * @param api HyperliquidAPI instance
 * @returns RiskManager instance
 */
export function createRiskManager(api: HyperliquidAPI): RiskManager {
  const config = createDefaultRiskConfig()
  return new RiskManager(config, api)
}
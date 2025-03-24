import { EventEmitter } from "events"
import {
  MarketMakingConfig,
  OrderBookData,
  MarketData,
  Order,
  Position,
  OrderSide
} from "../types"
import { HyperliquidAPI } from "../services/api"

/**
 * MarketMaker implements the core market-making logic for the Hyperliquid DEX bot.
 * It handles spread calculation, inventory management, and order placement.
 */
export class MarketMaker extends EventEmitter {
  private config: MarketMakingConfig
  private api: HyperliquidAPI
  private isRunning = false
  private orderRefreshInterval?: NodeJS.Timeout
  private activeOrders: Map<string, Order> = new Map() // orderId -> Order
  private orderBooks: Map<string, OrderBookData> = new Map() // symbol -> OrderBookData
  private marketData: Map<string, MarketData> = new Map() // symbol -> MarketData
  private positions: Map<string, Position> = new Map() // symbol -> Position
  private volatilityMetrics: Map<string, {
    short: number,
    medium: number,
    long: number
  }> = new Map() // symbol -> volatility metrics
  private historicalPrices: Map<string, {
    timestamp: number,
    price: number
  }[]> = new Map() // symbol -> price history

  /**
   * Creates a new MarketMaker instance
   * @param config Market making configuration
   * @param api HyperliquidAPI instance
   */
  constructor(config: MarketMakingConfig, api: HyperliquidAPI) {
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
    // Order book updates
    this.api.on("orderbook", (data: OrderBookData) => {
      this.orderBooks.set(data.symbol, data)
      this.emit("orderbook_update", data)
      
      // Check for order book imbalance and adjust orders if needed
      if (this.config.spread.orderBookImbalanceAdjustment.enable) {
        this.checkOrderBookImbalance(data.symbol)
      }
    })
    
    // Market data updates
    this.api.on("market", (data: MarketData) => {
      this.marketData.set(data.symbol, data)
      this.emit("market_update", data)
      
      // Update historical prices for volatility calculation
      this.updateHistoricalPrices(data.symbol, data.lastPrice)
      
      // Update volatility metrics
      this.updateVolatilityMetrics(data.symbol)
    })
    
    // Order updates
    this.api.on("order", (data: Order) => {
      if (data.status === "filled" || data.status === "canceled" || data.status === "rejected" || data.status === "expired") {
        this.activeOrders.delete(data.id)
      } else {
        this.activeOrders.set(data.id, data)
      }
      
      this.emit("order_update", data)
    })
    
    // Position updates
    this.api.on("position", (data: Position) => {
      this.positions.set(data.symbol, data)
      this.emit("position_update", data)
    })
  }

  /**
   * Start the market maker
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("Market maker already running")
      return true
    }
    
    try {
      console.log("Starting market maker...")
      
      // Subscribe to relevant channels for each trading pair
      for (const symbol of this.config.pairs) {
        await this.api.subscribe("orderbook", symbol)
        await this.api.subscribe("market", symbol)
        await this.api.subscribe("trade", symbol)
      }
      
      // Get initial market data
      await this.fetchInitialData()
      
      // Start order refresh loop
      this.startOrderRefreshLoop()
      
      this.isRunning = true
      console.log("Market maker started successfully")
      
      return true
    } catch (error) {
      console.error("Failed to start market maker:", error)
      return false
    }
  }

  /**
   * Stop the market maker
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning) {
      console.log("Market maker not running")
      return true
    }
    
    try {
      console.log("Stopping market maker...")
      
      // Stop order refresh loop
      if (this.orderRefreshInterval) {
        clearInterval(this.orderRefreshInterval)
        this.orderRefreshInterval = undefined
      }
      
      // Cancel all active orders
      await this.cancelAllOrders()
      
      // Unsubscribe from channels
      for (const symbol of this.config.pairs) {
        await this.api.unsubscribe("orderbook", symbol)
        await this.api.unsubscribe("market", symbol)
        await this.api.unsubscribe("trade", symbol)
      }
      
      this.isRunning = false
      console.log("Market maker stopped successfully")
      
      return true
    } catch (error) {
      console.error("Failed to stop market maker:", error)
      return false
    }
  }

  /**
   * Fetch initial market data for all trading pairs
   */
  private async fetchInitialData(): Promise<void> {
    for (const symbol of this.config.pairs) {
      try {
        // Get order book
        const orderBook = await this.api.getOrderBook(symbol)
        this.orderBooks.set(symbol, orderBook)
        
        // Get market data
        const market = await this.api.getMarketData(symbol)
        this.marketData.set(symbol, market)
        
        // Initialize historical prices
        this.historicalPrices.set(symbol, [
          {
            timestamp: Date.now(),
            price: market.lastPrice
          }
        ])
        
        // Initialize volatility metrics
        this.volatilityMetrics.set(symbol, {
          short: 0,
          medium: 0,
          long: 0
        })
        
        console.log(`Fetched initial data for ${symbol}`)
      } catch (error) {
        console.error(`Failed to fetch initial data for ${symbol}:`, error)
      }
    }
    
    // Get open orders
    try {
      const openOrders = await this.api.getOpenOrders()
      for (const order of openOrders) {
        this.activeOrders.set(order.id, order)
      }
      console.log(`Fetched ${openOrders.length} open orders`)
    } catch (error) {
      console.error("Failed to fetch open orders:", error)
    }
    
    // Get positions
    try {
      const positions = await this.api.getPositions()
      for (const position of positions) {
        this.positions.set(position.symbol, position)
      }
      console.log(`Fetched ${positions.length} positions`)
    } catch (error) {
      console.error("Failed to fetch positions:", error)
    }
  }

  /**
   * Start the order refresh loop
   */
  private startOrderRefreshLoop(): void {
    if (this.orderRefreshInterval) {
      clearInterval(this.orderRefreshInterval)
    }
    
    this.orderRefreshInterval = setInterval(
      () => this.refreshOrders(),
      this.config.orders.orderRefreshInterval
    )
  }

  /**
   * Refresh orders for all trading pairs
   */
  private async refreshOrders(): Promise<void> {
    if (!this.isRunning) {
      return
    }
    
    for (const symbol of this.config.pairs) {
      try {
        await this.refreshOrdersForSymbol(symbol)
      } catch (error) {
        console.error(`Failed to refresh orders for ${symbol}:`, error)
      }
    }
  }

  /**
   * Refresh orders for a specific trading pair
   * @param symbol Trading symbol
   */
  private async refreshOrdersForSymbol(symbol: string): Promise<void> {
    // Get current order book and market data
    const orderBook = this.orderBooks.get(symbol)
    const market = this.marketData.get(symbol)
    
    if (!orderBook || !market) {
      console.log(`Missing data for ${symbol}, skipping order refresh`)
      return
    }
    
    // Calculate optimal bid and ask prices
    const { bidPrice, askPrice } = this.calculateOptimalPrices(symbol)
    
    // Calculate order sizes based on inventory management
    const { bidSize, askSize } = this.calculateOrderSizes(symbol)
    
    // Cancel existing orders for this symbol
    await this.cancelOrdersForSymbol(symbol)
    
    // Place new orders if sizes are above minimum
    const minOrderSize = this.config.orders.minOrderSize
    
    if (bidSize >= minOrderSize) {
      await this.placeLimitOrder(symbol, "buy", bidPrice, bidSize)
    }
    
    if (askSize >= minOrderSize) {
      await this.placeLimitOrder(symbol, "sell", askPrice, askSize)
    }
    
    // If layering is enabled, place additional orders
    if (this.config.orders.layering.enable) {
      await this.placeLayeredOrders(symbol, bidPrice, askPrice, bidSize, askSize)
    }
  }

  /**
   * Calculate optimal bid and ask prices based on market conditions
   * @param symbol Trading symbol
   * @returns Optimal bid and ask prices
   */
  private calculateOptimalPrices(symbol: string): { bidPrice: number, askPrice: number } {
    const orderBook = this.orderBooks.get(symbol)
    const market = this.marketData.get(symbol)
    
    if (!orderBook || !market) {
      throw new Error(`Missing data for ${symbol}`)
    }
    
    // Get mid price from order book
    const bestBid = orderBook.bids[0]?.[0] || 0
    const bestAsk = orderBook.asks[0]?.[0] || 0
    const midPrice = (bestBid + bestAsk) / 2
    
    // Determine spread tier based on volatility
    const volatility = this.volatilityMetrics.get(symbol)
    let spreadTier = this.config.spread.baseTiers.tier1
    
    if (volatility) {
      const { medium: mediumThreshold, high: highThreshold } = this.config.spread.volatilityAdjustment.thresholds
      
      if (volatility.short > highThreshold) {
        spreadTier = this.config.spread.baseTiers.tier3
      } else if (volatility.short > mediumThreshold) {
        spreadTier = this.config.spread.baseTiers.tier2
      }
    }
    
    // Calculate base spread
    const spreadPercentage = spreadTier / 100 // Convert percentage to decimal
    const halfSpread = midPrice * spreadPercentage / 2
    
    // Apply order book imbalance adjustment if enabled
    let imbalanceAdjustment = 0
    if (this.config.spread.orderBookImbalanceAdjustment.enable) {
      imbalanceAdjustment = this.calculateImbalanceAdjustment(symbol)
    }
    
    // Calculate final prices
    const bidPrice = midPrice - halfSpread - imbalanceAdjustment
    const askPrice = midPrice + halfSpread + imbalanceAdjustment
    
    // Round prices to price increment
    const priceIncrement = this.config.orders.priceIncrement
    const roundedBidPrice = Math.floor(bidPrice / priceIncrement) * priceIncrement
    const roundedAskPrice = Math.ceil(askPrice / priceIncrement) * priceIncrement
    
    return {
      bidPrice: roundedBidPrice,
      askPrice: roundedAskPrice
    }
  }

  /**
   * Calculate order sizes based on inventory management
   * @param symbol Trading symbol
   * @returns Bid and ask order sizes
   */
  private calculateOrderSizes(symbol: string): { bidSize: number, askSize: number } {
    // Get current position
    const position = this.positions.get(symbol)
    const positionSize = position?.size || 0
    
    // Calculate base order size
    const baseOrderSize = this.calculateBaseOrderSize(symbol)
    
    // Adjust sizes based on inventory management
    const targetRatio = this.config.inventory.targetRatio
    const maxImbalance = this.config.inventory.maxImbalance
    
    // Calculate inventory skew factor (-1 to 1)
    // -1 means fully skewed to short, 1 means fully skewed to long
    let inventorySkew = 0
    if (positionSize !== 0) {
      // Normalize position size to a value between -1 and 1
      inventorySkew = Math.max(
        -1,
        Math.min(1, positionSize / (baseOrderSize * maxImbalance))
      )
    }
    
    // Adjust order sizes based on inventory skew
    // If we're skewed long (positive), reduce ask size and increase bid size
    // If we're skewed short (negative), reduce bid size and increase ask size
    const inventoryAdjustmentFactor = 1 - Math.abs(inventorySkew)
    
    let bidSize = baseOrderSize
    let askSize = baseOrderSize
    
    if (inventorySkew > 0) {
      // Skewed long, reduce ask size
      askSize = baseOrderSize * (2 - targetRatio - inventorySkew * (1 - targetRatio))
      
      // If aggressive rebalancing is enabled, also reduce bid size
      if (this.config.inventory.rebalanceStrategy === "aggressive") {
        bidSize = baseOrderSize * inventoryAdjustmentFactor
      }
    } else if (inventorySkew < 0) {
      // Skewed short, reduce bid size
      bidSize = baseOrderSize * (1 + targetRatio + inventorySkew * targetRatio)
      
      // If aggressive rebalancing is enabled, also reduce ask size
      if (this.config.inventory.rebalanceStrategy === "aggressive") {
        askSize = baseOrderSize * inventoryAdjustmentFactor
      }
    }
    
    // Ensure sizes are within limits
    const minOrderSize = this.config.orders.minOrderSize
    const maxOrderSize = this.config.orders.maxOrderSize
    const sizeIncrement = this.config.orders.orderSizeIncrement
    
    bidSize = Math.max(minOrderSize, Math.min(maxOrderSize, bidSize))
    askSize = Math.max(minOrderSize, Math.min(maxOrderSize, askSize))
    
    // Round sizes to size increment
    bidSize = Math.floor(bidSize / sizeIncrement) * sizeIncrement
    askSize = Math.floor(askSize / sizeIncrement) * sizeIncrement
    
    return { bidSize, askSize }
  }

  /**
   * Calculate base order size for a symbol
   * @param symbol Trading symbol
   * @returns Base order size
   */
  private calculateBaseOrderSize(symbol: string): number {
    const market = this.marketData.get(symbol)
    
    if (!market) {
      return this.config.orders.minOrderSize
    }
    
    // Base size on a percentage of 24h volume
    // This is a simplified approach - in a real implementation,
    // you would consider more factors like available capital,
    // risk limits, etc.
    const volumePercentage = 0.001 // 0.1% of 24h volume
    const baseSize = market.volume24h * volumePercentage
    
    // Ensure size is within limits
    const minOrderSize = this.config.orders.minOrderSize
    const maxOrderSize = this.config.orders.maxOrderSize
    
    return Math.max(minOrderSize, Math.min(maxOrderSize, baseSize))
  }

  /**
   * Calculate order book imbalance adjustment
   * @param symbol Trading symbol
   * @returns Price adjustment based on imbalance
   */
  private calculateImbalanceAdjustment(symbol: string): number {
    const orderBook = this.orderBooks.get(symbol)
    
    if (!orderBook) {
      return 0
    }
    
    // Calculate total volume on bid and ask sides (top 10 levels)
    const bidVolume = orderBook.bids.slice(0, 10).reduce((sum, [_, size]) => sum + size, 0)
    const askVolume = orderBook.asks.slice(0, 10).reduce((sum, [_, size]) => sum + size, 0)
    
    // Calculate imbalance ratio (-1 to 1)
    // Positive means more bids than asks (bullish)
    // Negative means more asks than bids (bearish)
    const totalVolume = bidVolume + askVolume
    const imbalanceRatio = totalVolume > 0 ? (bidVolume - askVolume) / totalVolume : 0
    
    // Only adjust if imbalance exceeds threshold
    const threshold = this.config.spread.orderBookImbalanceAdjustment.threshold
    if (Math.abs(imbalanceRatio) < threshold) {
      return 0
    }
    
    // Calculate adjustment
    const adjustmentFactor = this.config.spread.orderBookImbalanceAdjustment.adjustmentFactor
    const midPrice = (orderBook.bids[0][0] + orderBook.asks[0][0]) / 2
    
    return midPrice * imbalanceRatio * adjustmentFactor
  }

  /**
   * Check for order book imbalance and adjust orders if needed
   * @param symbol Trading symbol
   */
  private async checkOrderBookImbalance(symbol: string): Promise<void> {
    // Skip if not running or imbalance adjustment is disabled
    if (
      !this.isRunning ||
      !this.config.spread.orderBookImbalanceAdjustment.enable
    ) {
      return
    }
    
    const imbalanceAdjustment = this.calculateImbalanceAdjustment(symbol)
    
    // If significant imbalance detected, refresh orders
    if (Math.abs(imbalanceAdjustment) > 0) {
      await this.refreshOrdersForSymbol(symbol)
    }
  }

  /**
   * Update historical prices for volatility calculation
   * @param symbol Trading symbol
   * @param price Current price
   */
  private updateHistoricalPrices(symbol: string, price: number): void {
    const now = Date.now()
    const history = this.historicalPrices.get(symbol) || []
    
    // Add current price to history
    history.push({
      timestamp: now,
      price
    })
    
    // Keep only data points within the longest lookback period
    const lookbackPeriods = this.config.spread.volatilityAdjustment.lookbackPeriods
    const maxLookback = Math.max(
      lookbackPeriods.short,
      lookbackPeriods.medium,
      lookbackPeriods.long
    )
    
    // Convert minutes to milliseconds
    const maxLookbackMs = maxLookback * 60 * 1000
    const cutoffTime = now - maxLookbackMs
    
    // Filter out old data points
    const filteredHistory = history.filter(point => point.timestamp >= cutoffTime)
    
    this.historicalPrices.set(symbol, filteredHistory)
  }

  /**
   * Update volatility metrics for a symbol
   * @param symbol Trading symbol
   */
  private updateVolatilityMetrics(symbol: string): void {
    const history = this.historicalPrices.get(symbol)
    
    if (!history || history.length < 2) {
      return
    }
    
    const now = Date.now()
    const lookbackPeriods = this.config.spread.volatilityAdjustment.lookbackPeriods
    
    // Calculate volatility for each lookback period
    const shortVolatility = this.calculateVolatility(
      symbol,
      now - lookbackPeriods.short * 60 * 1000
    )
    
    const mediumVolatility = this.calculateVolatility(
      symbol,
      now - lookbackPeriods.medium * 60 * 1000
    )
    
    const longVolatility = this.calculateVolatility(
      symbol,
      now - lookbackPeriods.long * 60 * 1000
    )
    
    // Update volatility metrics
    this.volatilityMetrics.set(symbol, {
      short: shortVolatility,
      medium: mediumVolatility,
      long: longVolatility
    })
  }

  /**
   * Calculate price volatility for a symbol over a specific time period
   * @param symbol Trading symbol
   * @param startTime Start time in milliseconds
   * @returns Volatility as a percentage
   */
  private calculateVolatility(symbol: string, startTime: number): number {
    const history = this.historicalPrices.get(symbol)
    
    if (!history || history.length < 2) {
      return 0
    }
    
    // Filter history to the specified time period
    const periodHistory = history.filter(point => point.timestamp >= startTime)
    
    if (periodHistory.length < 2) {
      return 0
    }
    
    // Calculate returns
    const returns: number[] = []
    for (let i = 1; i < periodHistory.length; i++) {
      const prevPrice = periodHistory[i - 1].price
      const currentPrice = periodHistory[i].price
      const returnPct = (currentPrice - prevPrice) / prevPrice
      returns.push(returnPct)
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
    const squaredDiffs = returns.map(value => Math.pow(value - mean, 2))
    const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / squaredDiffs.length
    const stdDev = Math.sqrt(variance)
    
    // Annualize volatility (assuming returns are per minute)
    // √(minutes in a year) * stdDev
    const annualizationFactor = Math.sqrt(525600) // √(365 * 24 * 60)
    const annualizedVolatility = stdDev * annualizationFactor
    
    // Convert to percentage
    return annualizedVolatility * 100
  }

  /**
   * Place layered orders around the optimal prices
   * @param symbol Trading symbol
   * @param baseBidPrice Base bid price
   * @param baseAskPrice Base ask price
   * @param baseBidSize Base bid size
   * @param baseAskSize Base ask size
   */
  private async placeLayeredOrders(
    symbol: string,
    baseBidPrice: number,
    baseAskPrice: number,
    baseBidSize: number,
    baseAskSize: number
  ): Promise<void> {
    const levels = this.config.orders.layering.levels
    const spreadMultiplier = this.config.orders.layering.spreadMultiplier
    const sizeMultiplier = this.config.orders.layering.sizeMultiplier
    const priceIncrement = this.config.orders.priceIncrement
    
    // Place layered bid orders
    for (let i = 1; i <= levels; i++) {
      const priceDelta = baseBidPrice * spreadMultiplier * i / 100
      const layerPrice = Math.floor((baseBidPrice - priceDelta) / priceIncrement) * priceIncrement
      const layerSize = Math.floor(baseBidSize * Math.pow(sizeMultiplier, i))
      
      if (layerSize >= this.config.orders.minOrderSize) {
        await this.placeLimitOrder(symbol, "buy", layerPrice, layerSize)
      }
    }
    
    // Place layered ask orders
    for (let i = 1; i <= levels; i++) {
      const priceDelta = baseAskPrice * spreadMultiplier * i / 100
      const layerPrice = Math.ceil((baseAskPrice + priceDelta) / priceIncrement) * priceIncrement
      const layerSize = Math.floor(baseAskSize * Math.pow(sizeMultiplier, i))
      
      if (layerSize >= this.config.orders.minOrderSize) {
        await this.placeLimitOrder(symbol, "sell", layerPrice, layerSize)
      }
    }
  }

  /**
   * Place a limit order
   * @param symbol Trading symbol
   * @param side Order side (buy or sell)
   * @param price Order price
   * @param size Order size
   * @returns Order ID if successful
   */
  private async placeLimitOrder(
    symbol: string,
    side: OrderSide,
    price: number,
    size: number
  ): Promise<string | undefined> {
    try {
      // Check if we've reached the maximum number of open orders
      const symbolOrders = Array.from(this.activeOrders.values())
        .filter(order => order.symbol === symbol)
      
      if (symbolOrders.length >= this.config.orders.maxOpenOrders) {
        console.log(`Maximum number of open orders reached for ${symbol}`)
        return undefined
      }
      
      // Place the order
      const order = await this.api.placeOrder({
        symbol,
        side,
        type: "limit",
        price,
        size,
        clientOrderId: `mm-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      })
      
      console.log(`Placed ${side} order for ${symbol}: ${size} @ ${price}`)
      
      // Add to active orders
      this.activeOrders.set(order.id, order)
      
      return order.id
    } catch (error) {
      console.error(`Failed to place ${side} order for ${symbol}:`, error)
      return undefined
    }
  }

  /**
   * Cancel all active orders
   */
  private async cancelAllOrders(): Promise<void> {
    for (const symbol of this.config.pairs) {
      await this.cancelOrdersForSymbol(symbol)
    }
  }

  /**
   * Cancel all active orders for a specific symbol
   * @param symbol Trading symbol
   */
  private async cancelOrdersForSymbol(symbol: string): Promise<void> {
    const symbolOrders = Array.from(this.activeOrders.values())
      .filter(order => order.symbol === symbol)
    
    for (const order of symbolOrders) {
      try {
        await this.api.cancelOrder(symbol, order.id)
        this.activeOrders.delete(order.id)
        console.log(`Canceled order ${order.id} for ${symbol}`)
      } catch (error) {
        console.error(`Failed to cancel order ${order.id} for ${symbol}:`, error)
      }
    }
  }

  /**
   * Get the current state of the market maker
   * @returns Market maker state
   */
  public getState(): any {
    return {
      isRunning: this.isRunning,
      activeOrders: Array.from(this.activeOrders.values()),
      positions: Array.from(this.positions.values()),
      volatilityMetrics: Object.fromEntries(this.volatilityMetrics.entries()),
      orderBooks: Object.fromEntries(this.orderBooks.entries()),
      marketData: Object.fromEntries(this.marketData.entries())
    }
  }
}

/**
 * Create a default market making configuration
 * @returns Default market making configuration
 */
export function createDefaultMarketMakingConfig(): MarketMakingConfig {
  return {
    enabled: true,
    pairs: ["BTC-USDT", "ETH-USDT"],
    spread: {
      baseTiers: {
        tier1: 0.1, // 0.1% for normal conditions
        tier2: 0.2, // 0.2% for medium volatility
        tier3: 0.5  // 0.5% for high volatility
      },
      volatilityAdjustment: {
        enable: true,
        lookbackPeriods: {
          short: 5,    // 5 minutes
          medium: 60,  // 1 hour
          long: 1440   // 24 hours
        },
        thresholds: {
          medium: 50,  // 50% annualized volatility for medium tier
          high: 100    // 100% annualized volatility for high tier
        }
      },
      orderBookImbalanceAdjustment: {
        enable: true,
        threshold: 0.2,  // 20% imbalance threshold
        adjustmentFactor: 0.5  // 50% of the imbalance
      }
    },
    inventory: {
      targetRatio: 0.5,  // 50% base, 50% quote
      rebalanceThreshold: 0.1,  // 10% deviation from target
      maxImbalance: 5,  // Maximum 5x base order size imbalance
      rebalanceStrategy: "passive"  // Passive rebalancing
    },
    orders: {
      minOrderSize: 0.001,
      maxOrderSize: 1.0,
      orderSizeIncrement: 0.001,
      priceIncrement: 0.01,
      maxOpenOrders: 10,
      orderRefreshInterval: 5000,  // 5 seconds
      layering: {
        enable: true,
        levels: 3,
        sizeMultiplier: 1.5,  // Each level is 1.5x the size of the previous
        spreadMultiplier: 1.0  // Each level adds 1% to the spread
      }
    }
  }
}

/**
 * Create a MarketMaker instance with default configuration
 * @param api HyperliquidAPI instance
 * @returns MarketMaker instance
 */
export function createMarketMaker(api: HyperliquidAPI): MarketMaker {
  const config = createDefaultMarketMakingConfig()
  return new MarketMaker(config, api)
}
import { EventEmitter } from "events"
import {
  Order,
  Position,
  MarketData,
  OrderBookData,
  PerformanceMetrics
} from "../types"
import { HyperliquidAPI } from "../services/api"

/**
 * PerformanceAnalytics tracks and analyzes the bot's trading performance.
 * It provides real-time metrics on profitability, spread capture, and risk exposure.
 */
export class PerformanceAnalytics extends EventEmitter {
  private api: HyperliquidAPI
  private isRunning = false
  private analyzeInterval?: NodeJS.Timeout
  private orders: Map<string, Order> = new Map() // orderId -> Order
  private positions: Map<string, Position> = new Map() // symbol -> Position
  private marketData: Map<string, MarketData> = new Map() // symbol -> MarketData
  private orderBooks: Map<string, OrderBookData> = new Map() // symbol -> OrderBookData
  private filledOrders: Order[] = [] // Historical filled orders
  private metrics: Map<string, PerformanceMetrics> = new Map() // symbol -> PerformanceMetrics
  private overallMetrics: PerformanceMetrics = this.createEmptyMetrics()
  private startTime: number = Date.now()
  private lastUpdateTime: number = Date.now()
  private tradingPairs: string[] = []

  /**
   * Creates a new PerformanceAnalytics instance
   * @param api HyperliquidAPI instance
   * @param tradingPairs Trading pairs to analyze
   */
  constructor(api: HyperliquidAPI, tradingPairs: string[]) {
    super()
    this.api = api
    this.tradingPairs = tradingPairs
    
    // Initialize metrics for each trading pair
    for (const symbol of tradingPairs) {
      this.metrics.set(symbol, this.createEmptyMetrics())
    }
    
    // Set up API event listeners
    this.setupEventListeners()
  }

  /**
   * Set up event listeners for API events
   */
  private setupEventListeners(): void {
    // Order updates
    this.api.on("order", (order: Order) => {
      // Store all orders
      this.orders.set(order.id, order)
      
      // Track filled orders for historical analysis
      if (order.status === "filled") {
        this.filledOrders.push(order)
        this.analyzeFilledOrder(order)
      }
      
      this.emit("order_update", order)
    })
    
    // Position updates
    this.api.on("position", (position: Position) => {
      this.positions.set(position.symbol, position)
      this.updatePositionMetrics(position)
      this.emit("position_update", position)
    })
    
    // Market data updates
    this.api.on("market", (data: MarketData) => {
      this.marketData.set(data.symbol, data)
      this.emit("market_update", data)
    })
    
    // Order book updates
    this.api.on("orderbook", (data: OrderBookData) => {
      this.orderBooks.set(data.symbol, data)
      this.emit("orderbook_update", data)
    })
  }

  /**
   * Start the performance analytics
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("Performance analytics already running")
      return true
    }
    
    try {
      console.log("Starting performance analytics...")
      
      // Reset start time
      this.startTime = Date.now()
      this.lastUpdateTime = Date.now()
      
      // Fetch initial data
      await this.fetchInitialData()
      
      // Start analysis interval
      this.startAnalysisInterval()
      
      this.isRunning = true
      console.log("Performance analytics started successfully")
      
      return true
    } catch (error) {
      console.error("Failed to start performance analytics:", error)
      return false
    }
  }

  /**
   * Stop the performance analytics
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning) {
      console.log("Performance analytics not running")
      return true
    }
    
    try {
      console.log("Stopping performance analytics...")
      
      // Stop analysis interval
      if (this.analyzeInterval) {
        clearInterval(this.analyzeInterval)
        this.analyzeInterval = undefined
      }
      
      this.isRunning = false
      console.log("Performance analytics stopped successfully")
      
      return true
    } catch (error) {
      console.error("Failed to stop performance analytics:", error)
      return false
    }
  }

  /**
   * Fetch initial data for analysis
   */
  private async fetchInitialData(): Promise<void> {
    try {
      // Get open orders
      const openOrders = await this.api.getOpenOrders()
      for (const order of openOrders) {
        this.orders.set(order.id, order)
      }
      console.log(`Fetched ${openOrders.length} open orders`)
      
      // Get positions
      const positions = await this.api.getPositions()
      for (const position of positions) {
        this.positions.set(position.symbol, position)
        this.updatePositionMetrics(position)
      }
      console.log(`Fetched ${positions.length} positions`)
      
      // Get market data for each trading pair
      for (const symbol of this.tradingPairs) {
        try {
          const marketData = await this.api.getMarketData(symbol)
          this.marketData.set(symbol, marketData)
          
          const orderBook = await this.api.getOrderBook(symbol)
          this.orderBooks.set(symbol, orderBook)
        } catch (error) {
          console.error(`Failed to fetch data for ${symbol}:`, error)
        }
      }
    } catch (error) {
      console.error("Failed to fetch initial data for analysis:", error)
      throw error
    }
  }

  /**
   * Start the analysis interval
   */
  private startAnalysisInterval(): void {
    if (this.analyzeInterval) {
      clearInterval(this.analyzeInterval)
    }
    
    // Update metrics every 10 seconds
    this.analyzeInterval = setInterval(() => {
      this.updateAllMetrics()
    }, 10000)
  }

  /**
   * Create empty performance metrics
   * @returns Empty performance metrics
   */
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      pnl: {
        realized: 0,
        unrealized: 0,
        total: 0
      },
      trades: {
        count: 0,
        winRate: 0,
        averageProfit: 0,
        averageLoss: 0,
        profitFactor: 0
      },
      exposure: {
        current: 0,
        average: 0,
        max: 0
      },
      spreadCapture: {
        efficiency: 0,
        slippage: 0
      }
    }
  }

  /**
   * Analyze a filled order
   * @param order Filled order
   */
  private analyzeFilledOrder(order: Order): void {
    // Skip if order is not filled
    if (order.status !== "filled") {
      return
    }
    
    const symbol = order.symbol
    const metrics = this.metrics.get(symbol)
    
    if (!metrics) {
      return
    }
    
    // Update trade count
    metrics.trades.count++
    
    // Calculate PnL for this trade (simplified)
    // In a real implementation, you would need to track the entry and exit prices
    // for each position to calculate accurate PnL
    const position = this.positions.get(symbol)
    if (position) {
      // Update realized PnL if available from position
      metrics.pnl.realized = position.realizedPnl
      
      // Update unrealized PnL
      metrics.pnl.unrealized = position.unrealizedPnl
      
      // Update total PnL
      metrics.pnl.total = metrics.pnl.realized + metrics.pnl.unrealized
    }
    
    // Calculate win/loss statistics
    this.updateWinLossStatistics(symbol)
    
    // Calculate spread capture efficiency
    this.calculateSpreadCapture(order)
    
    // Update overall metrics
    this.updateOverallMetrics()
    
    // Emit metrics update event
    this.emit("metrics_update", {
      symbol,
      metrics: { ...metrics }
    })
  }

  /**
   * Update position metrics
   * @param position Position
   */
  private updatePositionMetrics(position: Position): void {
    const symbol = position.symbol
    const metrics = this.metrics.get(symbol)
    
    if (!metrics) {
      return
    }
    
    // Update PnL
    metrics.pnl.unrealized = position.unrealizedPnl
    metrics.pnl.realized = position.realizedPnl
    metrics.pnl.total = metrics.pnl.realized + metrics.pnl.unrealized
    
    // Update exposure
    const currentExposure = Math.abs(position.size * position.markPrice)
    metrics.exposure.current = currentExposure
    
    // Update max exposure
    if (currentExposure > metrics.exposure.max) {
      metrics.exposure.max = currentExposure
    }
    
    // Update average exposure (simple moving average)
    const alpha = 0.1 // Smoothing factor
    metrics.exposure.average = alpha * currentExposure + (1 - alpha) * metrics.exposure.average
    
    // Update overall metrics
    this.updateOverallMetrics()
    
    // Emit metrics update event
    this.emit("metrics_update", {
      symbol,
      metrics: { ...metrics }
    })
  }

  /**
   * Update win/loss statistics for a symbol
   * @param symbol Trading symbol
   */
  private updateWinLossStatistics(symbol: string): void {
    const metrics = this.metrics.get(symbol)
    
    if (!metrics) {
      return
    }
    
    // Filter orders for this symbol
    const symbolOrders = this.filledOrders.filter(order => order.symbol === symbol)
    
    if (symbolOrders.length === 0) {
      return
    }
    
    // Group orders by client order ID to identify related orders
    const orderGroups = new Map<string, Order[]>()
    
    for (const order of symbolOrders) {
      const clientId = order.clientOrderId || order.id
      const baseId = clientId.split("-")[0] // Extract base ID
      
      if (!orderGroups.has(baseId)) {
        orderGroups.set(baseId, [])
      }
      
      orderGroups.get(baseId)?.push(order)
    }
    
    // Calculate profit/loss for each group
    let winCount = 0
    let lossCount = 0
    let totalProfit = 0
    let totalLoss = 0
    
    for (const [_, orders] of orderGroups.entries()) {
      // Skip incomplete order groups
      if (orders.length < 2) {
        continue
      }
      
      // Sort by timestamp
      orders.sort((a, b) => a.timestamp - b.timestamp)
      
      // Calculate profit/loss (simplified)
      let pnl = 0
      
      for (const order of orders) {
        if (order.side === "buy") {
          pnl -= order.avgFillPrice * order.filledSize
        } else {
          pnl += order.avgFillPrice * order.filledSize
        }
      }
      
      if (pnl > 0) {
        winCount++
        totalProfit += pnl
      } else if (pnl < 0) {
        lossCount++
        totalLoss += Math.abs(pnl)
      }
    }
    
    // Update metrics
    const totalTrades = winCount + lossCount
    
    if (totalTrades > 0) {
      metrics.trades.winRate = (winCount / totalTrades) * 100
    }
    
    if (winCount > 0) {
      metrics.trades.averageProfit = totalProfit / winCount
    }
    
    if (lossCount > 0) {
      metrics.trades.averageLoss = totalLoss / lossCount
    }
    
    if (totalLoss > 0) {
      metrics.trades.profitFactor = totalProfit / totalLoss
    } else if (totalProfit > 0) {
      metrics.trades.profitFactor = Number.POSITIVE_INFINITY
    }
  }

  /**
   * Calculate spread capture efficiency for an order
   * @param order Filled order
   */
  private calculateSpreadCapture(order: Order): void {
    // Skip if order is not filled
    if (order.status !== "filled") {
      return
    }
    
    const symbol = order.symbol
    const metrics = this.metrics.get(symbol)
    const orderBook = this.orderBooks.get(symbol)
    
    if (!metrics || !orderBook) {
      return
    }
    
    // Calculate mid price from order book
    const bestBid = orderBook.bids[0]?.[0] || 0
    const bestAsk = orderBook.asks[0]?.[0] || 0
    const midPrice = (bestBid + bestAsk) / 2
    
    // Calculate theoretical spread
    const theoreticalSpread = bestAsk - bestBid
    
    // Calculate actual spread captured
    let actualSpread = 0
    
    if (order.side === "buy") {
      // For buy orders, we want to buy below mid price
      actualSpread = midPrice - order.avgFillPrice
    } else {
      // For sell orders, we want to sell above mid price
      actualSpread = order.avgFillPrice - midPrice
    }
    
    // Calculate slippage
    const slippage = order.side === "buy"
      ? order.avgFillPrice - bestBid
      : bestAsk - order.avgFillPrice
    
    // Calculate spread capture efficiency
    let efficiency = 0
    if (theoreticalSpread > 0) {
      efficiency = (actualSpread / (theoreticalSpread / 2)) * 100
    }
    
    // Update metrics with exponential moving average
    const alpha = 0.2 // Smoothing factor
    metrics.spreadCapture.efficiency = alpha * efficiency + (1 - alpha) * metrics.spreadCapture.efficiency
    metrics.spreadCapture.slippage = alpha * slippage + (1 - alpha) * metrics.spreadCapture.slippage
  }

  /**
   * Update all metrics
   */
  private updateAllMetrics(): void {
    if (!this.isRunning) {
      return
    }
    
    // Update metrics for each trading pair
    for (const symbol of this.tradingPairs) {
      const position = this.positions.get(symbol)
      if (position) {
        this.updatePositionMetrics(position)
      }
      
      this.updateWinLossStatistics(symbol)
    }
    
    // Update overall metrics
    this.updateOverallMetrics()
    
    // Update last update time
    this.lastUpdateTime = Date.now()
  }

  /**
   * Update overall metrics across all trading pairs
   */
  private updateOverallMetrics(): void {
    // Reset overall metrics
    const overall = this.createEmptyMetrics()
    
    // Aggregate metrics from all trading pairs
    let totalTradeCount = 0
    let totalWinCount = 0
    let totalProfit = 0
    let totalLoss = 0
    
    for (const [symbol, metrics] of this.metrics.entries()) {
      // Sum up PnL
      overall.pnl.realized += metrics.pnl.realized
      overall.pnl.unrealized += metrics.pnl.unrealized
      
      // Sum up exposure
      overall.exposure.current += metrics.exposure.current
      overall.exposure.average += metrics.exposure.average
      overall.exposure.max = Math.max(overall.exposure.max, metrics.exposure.max)
      
      // Aggregate trade statistics
      totalTradeCount += metrics.trades.count
      totalWinCount += (metrics.trades.count * metrics.trades.winRate / 100)
      
      if (metrics.trades.averageProfit > 0) {
        totalProfit += metrics.trades.averageProfit * (metrics.trades.count * metrics.trades.winRate / 100)
      }
      
      if (metrics.trades.averageLoss > 0) {
        totalLoss += metrics.trades.averageLoss * (metrics.trades.count * (1 - metrics.trades.winRate / 100))
      }
      
      // Average spread capture efficiency (weighted by trade count)
      overall.spreadCapture.efficiency += metrics.spreadCapture.efficiency * metrics.trades.count
      overall.spreadCapture.slippage += metrics.spreadCapture.slippage * metrics.trades.count
    }
    
    // Calculate overall totals
    overall.pnl.total = overall.pnl.realized + overall.pnl.unrealized
    
    // Calculate overall trade statistics
    if (totalTradeCount > 0) {
      overall.trades.count = totalTradeCount
      overall.trades.winRate = (totalWinCount / totalTradeCount) * 100
      
      if (totalWinCount > 0) {
        overall.trades.averageProfit = totalProfit / totalWinCount
      }
      
      if (totalTradeCount - totalWinCount > 0) {
        overall.trades.averageLoss = totalLoss / (totalTradeCount - totalWinCount)
      }
      
      if (totalLoss > 0) {
        overall.trades.profitFactor = totalProfit / totalLoss
      } else if (totalProfit > 0) {
        overall.trades.profitFactor = Number.POSITIVE_INFINITY
      }
      
      // Calculate overall spread capture metrics
      overall.spreadCapture.efficiency /= totalTradeCount
      overall.spreadCapture.slippage /= totalTradeCount
    }
    
    // Update overall metrics
    this.overallMetrics = overall
    
    // Emit overall metrics update event
    this.emit("overall_metrics_update", { ...overall })
  }

  /**
   * Get performance metrics for a specific symbol
   * @param symbol Trading symbol
   * @returns Performance metrics for the symbol
   */
  public getMetrics(symbol: string): PerformanceMetrics | undefined {
    return this.metrics.get(symbol)
  }

  /**
   * Get overall performance metrics
   * @returns Overall performance metrics
   */
  public getOverallMetrics(): PerformanceMetrics {
    return { ...this.overallMetrics }
  }

  /**
   * Get performance report
   * @returns Detailed performance report
   */
  public getPerformanceReport(): any {
    const runningTime = Date.now() - this.startTime
    const runningHours = runningTime / (1000 * 60 * 60)
    
    const report = {
      startTime: new Date(this.startTime).toISOString(),
      runningTime: `${Math.floor(runningHours)} hours ${Math.floor((runningHours % 1) * 60)} minutes`,
      overall: this.getOverallMetrics(),
      bySymbol: Object.fromEntries(
        Array.from(this.metrics.entries()).map(([symbol, metrics]) => [
          symbol,
          { ...metrics }
        ])
      ),
      tradeSummary: {
        totalTrades: this.overallMetrics.trades.count,
        tradesPerHour: runningHours > 0 ? this.overallMetrics.trades.count / runningHours : 0,
        winRate: this.overallMetrics.trades.winRate,
        profitFactor: this.overallMetrics.trades.profitFactor
      },
      pnlSummary: {
        realized: this.overallMetrics.pnl.realized,
        unrealized: this.overallMetrics.pnl.unrealized,
        total: this.overallMetrics.pnl.total,
        hourlyPnL: runningHours > 0 ? this.overallMetrics.pnl.total / runningHours : 0
      },
      riskSummary: {
        currentExposure: this.overallMetrics.exposure.current,
        maxExposure: this.overallMetrics.exposure.max,
        exposureUtilization: this.overallMetrics.exposure.max > 0
          ? (this.overallMetrics.exposure.current / this.overallMetrics.exposure.max) * 100
          : 0
      },
      executionQuality: {
        spreadCaptureEfficiency: this.overallMetrics.spreadCapture.efficiency,
        averageSlippage: this.overallMetrics.spreadCapture.slippage
      }
    }
    
    return report
  }

  /**
   * Get historical filled orders
   * @param symbol Trading symbol (optional)
   * @param limit Maximum number of orders to return (optional)
   * @returns Array of filled orders
   */
  public getFilledOrders(symbol?: string, limit?: number): Order[] {
    // Filter by symbol if provided
    let orders = symbol
      ? this.filledOrders.filter(order => order.symbol === symbol)
      : this.filledOrders
    
    // Sort by timestamp (newest first)
    orders = orders.sort((a, b) => b.timestamp - a.timestamp)
    
    // Apply limit if provided
    if (limit && limit > 0) {
      orders = orders.slice(0, limit)
    }
    
    return orders
  }

  /**
   * Get the current state of the performance analytics
   * @returns Performance analytics state
   */
  public getState(): any {
    return {
      isRunning: this.isRunning,
      startTime: new Date(this.startTime).toISOString(),
      lastUpdateTime: new Date(this.lastUpdateTime).toISOString(),
      overallMetrics: this.getOverallMetrics(),
      symbolMetrics: Object.fromEntries(
        Array.from(this.metrics.entries()).map(([symbol, metrics]) => [
          symbol,
          { ...metrics }
        ])
      ),
      filledOrderCount: this.filledOrders.length
    }
  }
}

/**
 * Create a PerformanceAnalytics instance
 * @param api HyperliquidAPI instance
 * @param tradingPairs Trading pairs to analyze
 * @returns PerformanceAnalytics instance
 */
export function createPerformanceAnalytics(
  api: HyperliquidAPI,
  tradingPairs: string[]
): PerformanceAnalytics {
  return new PerformanceAnalytics(api, tradingPairs)
}
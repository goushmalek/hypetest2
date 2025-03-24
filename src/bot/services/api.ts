import { ApiConfig, WebSocketMessage, OrderBookData, MarketData, Order, Position } from "../types"
import WebSocket from "ws"
import axios, { AxiosInstance, AxiosRequestConfig } from "axios"
import { EventEmitter } from "events"

/**
 * HyperliquidAPI handles all communication with the Hyperliquid exchange
 * including WebSocket connections and REST API calls.
 */
export class HyperliquidAPI extends EventEmitter {
  private config: ApiConfig
  private wsConnections: WebSocket[] = []
  private activeWsIndex = 0
  private restClient: AxiosInstance
  private requestQueue: Array<() => Promise<any>> = []
  private processingQueue = false
  private connectionRetryCount = 0
  private reconnectTimeout?: NodeJS.Timeout
  private pingInterval?: NodeJS.Timeout
  private lastMessageTime = 0
  private subscriptions: Set<string> = new Set()

  /**
   * Creates a new HyperliquidAPI instance
   * @param config API configuration
   */
  constructor(config: ApiConfig) {
    super()
    this.config = config
    
    // Initialize REST client with rate limiting
    this.restClient = axios.create({
      baseURL: this.config.restEndpoint,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "HyperliquidBot/1.0"
      }
    })
    
    // Add request interceptor for rate limiting
    this.restClient.interceptors.request.use(async (config) => {
      await this.waitForRateLimit()
      return config
    })
  }

  /**
   * Initialize the API connection
   */
  public async initialize(): Promise<boolean> {
    try {
      // Connect to WebSocket
      await this.connectWebSocket()
      
      // Start ping interval to keep connection alive
      this.startPingInterval()
      
      // Test REST connection
      await this.getExchangeInfo()
      
      return true
    } catch (error) {
      console.error("Failed to initialize API:", error)
      return false
    }
  }

  /**
   * Connect to the WebSocket endpoint with redundancy
   */
  private async connectWebSocket(): Promise<void> {
    // Close existing connections
    this.closeWebSocketConnections()
    
    // Reset connections array
    this.wsConnections = []
    
    try {
      // Create primary connection
      const primaryWs = new WebSocket(this.config.wsEndpoint)
      this.setupWebSocketHandlers(primaryWs, 0)
      this.wsConnections.push(primaryWs)
      
      // Create backup connection
      const backupWs = new WebSocket(this.config.wsEndpoint)
      this.setupWebSocketHandlers(backupWs, 1)
      this.wsConnections.push(backupWs)
      
      // Wait for at least one connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"))
        }, 10000)
        
        const onOpen = () => {
          clearTimeout(timeout)
          resolve()
        }
        
        primaryWs.once("open", onOpen)
        backupWs.once("open", onOpen)
      })
      
      // Reset retry count on successful connection
      this.connectionRetryCount = 0
      
      // Resubscribe to channels if we have any
      this.resubscribeToChannels()
    } catch (error) {
      console.error("WebSocket connection failed:", error)
      
      // Increment retry count
      this.connectionRetryCount++
      
      // Retry with exponential backoff
      const delay = Math.min(
        this.config.retryDelay * Math.pow(2, this.connectionRetryCount - 1),
        30000 // Max 30 seconds
      )
      
      console.log(`Retrying WebSocket connection in ${delay}ms (attempt ${this.connectionRetryCount})`)
      
      this.reconnectTimeout = setTimeout(() => {
        this.connectWebSocket()
      }, delay)
      
      throw error
    }
  }

  /**
   * Set up event handlers for a WebSocket connection
   * @param ws WebSocket connection
   * @param index Connection index for identification
   */
  private setupWebSocketHandlers(ws: WebSocket, index: number): void {
    ws.on("open", () => {
      console.log(`WebSocket connection ${index} established`)
      this.emit("ws_open", { index })
    })
    
    ws.on("message", (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage
        this.lastMessageTime = Date.now()
        this.handleWebSocketMessage(message, index)
      } catch (error) {
        console.error(`Failed to parse WebSocket message on connection ${index}:`, error)
      }
    })
    
    ws.on("error", (error) => {
      console.error(`WebSocket connection ${index} error:`, error)
      this.emit("ws_error", { index, error })
    })
    
    ws.on("close", (code, reason) => {
      console.log(`WebSocket connection ${index} closed: ${code} - ${reason}`)
      this.emit("ws_close", { index, code, reason })
      
      // If this was the active connection, switch to the other one if available
      if (index === this.activeWsIndex && this.wsConnections.length > 1) {
        this.activeWsIndex = (this.activeWsIndex + 1) % this.wsConnections.length
        console.log(`Switched to WebSocket connection ${this.activeWsIndex}`)
      }
      
      // Attempt to reconnect this specific connection
      setTimeout(() => {
        if (this.wsConnections[index]?.readyState === WebSocket.CLOSED) {
          console.log(`Reconnecting WebSocket connection ${index}`)
          const newWs = new WebSocket(this.config.wsEndpoint)
          this.setupWebSocketHandlers(newWs, index)
          this.wsConnections[index] = newWs
        }
      }, 5000)
    })
  }

  /**
   * Close all WebSocket connections
   */
  private closeWebSocketConnections(): void {
    for (const ws of this.wsConnections) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = undefined
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = undefined
    }
  }

  /**
   * Start ping interval to keep WebSocket connection alive
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }
    
    this.pingInterval = setInterval(() => {
      // Check if we haven't received a message in a while
      const now = Date.now()
      if (now - this.lastMessageTime > 30000) {
        console.log("No WebSocket messages received in 30 seconds, reconnecting...")
        this.connectWebSocket().catch(console.error)
        return
      }
      
      // Send ping to active connection
      const activeWs = this.getActiveWebSocket()
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.ping()
      }
    }, 15000)
  }

  /**
   * Get the currently active WebSocket connection
   * @returns Active WebSocket connection or undefined if none available
   */
  private getActiveWebSocket(): WebSocket | undefined {
    // If the active connection is not open, try to find an open one
    if (
      !this.wsConnections[this.activeWsIndex] ||
      this.wsConnections[this.activeWsIndex].readyState !== WebSocket.OPEN
    ) {
      const openIndex = this.wsConnections.findIndex(
        (ws) => ws && ws.readyState === WebSocket.OPEN
      )
      
      if (openIndex >= 0) {
        this.activeWsIndex = openIndex
      } else {
        return undefined
      }
    }
    
    return this.wsConnections[this.activeWsIndex]
  }

  /**
   * Handle incoming WebSocket messages
   * @param message WebSocket message
   * @param connectionIndex Index of the connection that received the message
   */
  private handleWebSocketMessage(message: WebSocketMessage, connectionIndex: number): void {
    // Process different message types
    switch (message.type) {
      case "orderbook":
        this.emit("orderbook", message.data as OrderBookData)
        break
      case "market":
        this.emit("market", message.data as MarketData)
        break
      case "trade":
        this.emit("trade", message.data)
        break
      case "order":
        this.emit("order", message.data as Order)
        break
      case "position":
        this.emit("position", message.data as Position)
        break
      case "error":
        console.error("WebSocket error message:", message.data)
        this.emit("error", message.data)
        break
      default:
        // Forward other messages as is
        this.emit(message.type, message.data)
    }
  }

  /**
   * Subscribe to a WebSocket channel
   * @param channel Channel name
   * @param symbol Trading symbol (optional)
   */
  public async subscribe(channel: string, symbol?: string): Promise<void> {
    const subscriptionKey = symbol ? `${channel}:${symbol}` : channel
    
    // Add to subscriptions set
    this.subscriptions.add(subscriptionKey)
    
    const activeWs = this.getActiveWebSocket()
    if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
      console.log("WebSocket not connected, will subscribe when connected")
      return
    }
    
    const subscribeMessage = {
      op: "subscribe",
      channel,
      ...(symbol && { symbol })
    }
    
    activeWs.send(JSON.stringify(subscribeMessage))
  }

  /**
   * Unsubscribe from a WebSocket channel
   * @param channel Channel name
   * @param symbol Trading symbol (optional)
   */
  public async unsubscribe(channel: string, symbol?: string): Promise<void> {
    const subscriptionKey = symbol ? `${channel}:${symbol}` : channel
    
    // Remove from subscriptions set
    this.subscriptions.delete(subscriptionKey)
    
    const activeWs = this.getActiveWebSocket()
    if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
      return
    }
    
    const unsubscribeMessage = {
      op: "unsubscribe",
      channel,
      ...(symbol && { symbol })
    }
    
    activeWs.send(JSON.stringify(unsubscribeMessage))
  }

  /**
   * Resubscribe to all previously subscribed channels
   */
  private resubscribeToChannels(): void {
    for (const subscription of this.subscriptions) {
      const [channel, symbol] = subscription.split(":")
      this.subscribe(channel, symbol)
    }
  }

  /**
   * Wait for rate limit to allow a new request
   */
  private async waitForRateLimit(): Promise<void> {
    // Implement token bucket algorithm for rate limiting
    // This is a simplified version
    return new Promise<void>((resolve) => {
      this.requestQueue.push(async () => {
        resolve()
        return Promise.resolve()
      })
      
      if (!this.processingQueue) {
        this.processRequestQueue()
      }
    })
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processRequestQueue(): Promise<void> {
    if (this.processingQueue) {
      return
    }
    
    this.processingQueue = true
    
    const timeWindow = this.config.rateLimit.timeWindow
    const maxRequests = this.config.rateLimit.maxRequests
    const requestInterval = timeWindow / maxRequests
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        await request()
      }
      
      if (this.requestQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, requestInterval))
      }
    }
    
    this.processingQueue = false
  }

  /**
   * Make a REST API request with automatic retries
   * @param method HTTP method
   * @param endpoint API endpoint
   * @param data Request data
   * @param config Additional Axios config
   * @returns API response
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    let retries = 0
    
    while (retries <= this.config.maxRetries) {
      try {
        const response = await this.restClient.request<T>({
          method,
          url: endpoint,
          data,
          ...config
        })
        
        return response.data
      } catch (error: any) {
        retries++
        
        // Check if we should retry
        if (
          retries <= this.config.maxRetries &&
          (error.response?.status >= 500 || error.code === "ECONNABORTED")
        ) {
          const delay = this.config.retryDelay * Math.pow(2, retries - 1)
          console.log(`Retrying API request to ${endpoint} in ${delay}ms (attempt ${retries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          console.error(`API request to ${endpoint} failed:`, error)
          throw error
        }
      }
    }
    
    throw new Error(`Max retries exceeded for ${endpoint}`)
  }

  /**
   * Get exchange information
   * @returns Exchange information
   */
  public async getExchangeInfo(): Promise<any> {
    return this.makeRequest<any>("GET", "/api/v1/exchangeInfo")
  }

  /**
   * Get order book for a symbol
   * @param symbol Trading symbol
   * @param limit Depth limit
   * @returns Order book data
   */
  public async getOrderBook(symbol: string, limit = 100): Promise<OrderBookData> {
    return this.makeRequest<OrderBookData>("GET", `/api/v1/depth`, undefined, {
      params: { symbol, limit }
    })
  }

  /**
   * Get market data for a symbol
   * @param symbol Trading symbol
   * @returns Market data
   */
  public async getMarketData(symbol: string): Promise<MarketData> {
    return this.makeRequest<MarketData>("GET", `/api/v1/ticker/24hr`, undefined, {
      params: { symbol }
    })
  }

  /**
   * Place a new order
   * @param order Order details
   * @returns Order response
   */
  public async placeOrder(order: Partial<Order>): Promise<Order> {
    return this.makeRequest<Order>("POST", "/api/v1/order", order)
  }

  /**
   * Cancel an order
   * @param symbol Trading symbol
   * @param orderId Order ID
   * @returns Cancel response
   */
  public async cancelOrder(symbol: string, orderId: string): Promise<any> {
    return this.makeRequest<any>("DELETE", "/api/v1/order", undefined, {
      params: { symbol, orderId }
    })
  }

  /**
   * Get open orders
   * @param symbol Trading symbol (optional)
   * @returns List of open orders
   */
  public async getOpenOrders(symbol?: string): Promise<Order[]> {
    return this.makeRequest<Order[]>("GET", "/api/v1/openOrders", undefined, {
      params: symbol ? { symbol } : undefined
    })
  }

  /**
   * Get account positions
   * @returns List of positions
   */
  public async getPositions(): Promise<Position[]> {
    return this.makeRequest<Position[]>("GET", "/api/v1/positions")
  }

  /**
   * Get account balance
   * @returns Account balance
   */
  public async getAccountBalance(): Promise<any> {
    return this.makeRequest<any>("GET", "/api/v1/account")
  }

  /**
   * Close the API connection
   */
  public close(): void {
    this.closeWebSocketConnections()
  }
}

/**
 * Create a default API configuration
 * @returns Default API configuration
 */
export function createDefaultApiConfig(): ApiConfig {
  return {
    wsEndpoint: "wss://api.hyperliquid.xyz/ws",
    restEndpoint: "https://api.hyperliquid.xyz",
    maxRetries: 3,
    retryDelay: 1000,
    rateLimit: {
      maxRequests: 10,
      timeWindow: 1000 // 1 second
    }
  }
}

/**
 * Create a HyperliquidAPI instance with default configuration
 * @returns HyperliquidAPI instance
 */
export function createHyperliquidAPI(): HyperliquidAPI {
  const config = createDefaultApiConfig()
  return new HyperliquidAPI(config)
}
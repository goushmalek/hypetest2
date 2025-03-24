import { EventEmitter } from "events"
import crypto from "crypto"
import {
  SecurityConfig,
  Order,
  Position
} from "../types"
import { HyperliquidAPI } from "../services/api"
import { WalletManager } from "../config/wallet"

/**
 * SecurityManager implements comprehensive security measures for the Hyperliquid DEX bot.
 * It handles multi-signature protocols, transaction value thresholds, and anomaly detection.
 */
export class SecurityManager extends EventEmitter {
  private config: SecurityConfig
  private api: HyperliquidAPI
  private walletManager: WalletManager
  private isRunning = false
  private monitorInterval?: NodeJS.Timeout
  private pendingTransactions: Map<string, {
    id: string,
    type: string,
    data: any,
    value: number,
    timestamp: number,
    signatures: Map<string, string>,
    status: "pending" | "approved" | "rejected" | "executed" | "expired"
  }> = new Map() // transactionId -> transaction
  private transactionHistory: Array<{
    id: string,
    type: string,
    data: any,
    value: number,
    timestamp: number,
    status: string,
    securityLevel: "low" | "medium" | "high"
  }> = []
  private anomalyDetection: {
    orderSizeHistory: number[],
    orderFrequencyHistory: Array<{ timestamp: number }>,
    positionSizeHistory: Map<string, number[]>, // symbol -> size history
    lastAlertTime: number
  } = {
    orderSizeHistory: [],
    orderFrequencyHistory: [],
    positionSizeHistory: new Map(),
    lastAlertTime: 0
  }
  private auditLog: Array<{
    timestamp: number,
    action: string,
    details: any,
    hash: string
  }> = []

  /**
   * Creates a new SecurityManager instance
   * @param config Security configuration
   * @param api HyperliquidAPI instance
   * @param walletManager WalletManager instance
   */
  constructor(
    config: SecurityConfig,
    api: HyperliquidAPI,
    walletManager: WalletManager
  ) {
    super()
    this.config = config
    this.api = api
    this.walletManager = walletManager
    
    // Set up API event listeners
    this.setupEventListeners()
  }

  /**
   * Set up event listeners for API events
   */
  private setupEventListeners(): void {
    // Order updates
    this.api.on("order", (order: Order) => {
      this.monitorOrderActivity(order)
    })
    
    // Position updates
    this.api.on("position", (position: Position) => {
      this.monitorPositionActivity(position)
    })
  }

  /**
   * Start the security manager
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("Security manager already running")
      return true
    }
    
    try {
      console.log("Starting security manager...")
      
      // Start security monitoring
      this.startMonitoring()
      
      this.isRunning = true
      console.log("Security manager started successfully")
      
      return true
    } catch (error) {
      console.error("Failed to start security manager:", error)
      return false
    }
  }

  /**
   * Stop the security manager
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning) {
      console.log("Security manager not running")
      return true
    }
    
    try {
      console.log("Stopping security manager...")
      
      // Stop monitoring
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval)
        this.monitorInterval = undefined
      }
      
      this.isRunning = false
      console.log("Security manager stopped successfully")
      
      return true
    } catch (error) {
      console.error("Failed to stop security manager:", error)
      return false
    }
  }

  /**
   * Start security monitoring
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
    }
    
    // Monitor security every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.monitorSecurity()
    }, 5000)
  }

  /**
   * Monitor overall security
   */
  private monitorSecurity(): void {
    if (!this.isRunning) {
      return
    }
    
    try {
      // Check for expired pending transactions
      this.checkExpiredTransactions()
      
      // Run anomaly detection if enabled
      if (this.config.anomalyDetection.enable) {
        this.detectAnomalies()
      }
    } catch (error) {
      console.error("Error in security monitoring:", error)
    }
  }

  /**
   * Monitor order activity for security
   * @param order Order
   */
  private monitorOrderActivity(order: Order): void {
    // Skip if not running
    if (!this.isRunning) {
      return
    }
    
    // Record order size for anomaly detection
    if (order.status === "filled" || order.status === "partiallyFilled") {
      this.anomalyDetection.orderSizeHistory.push(order.size)
      
      // Keep only the last 100 orders
      if (this.anomalyDetection.orderSizeHistory.length > 100) {
        this.anomalyDetection.orderSizeHistory.shift()
      }
    }
    
    // Record order timestamp for frequency analysis
    this.anomalyDetection.orderFrequencyHistory.push({
      timestamp: Date.now()
    })
    
    // Keep only orders from the last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    this.anomalyDetection.orderFrequencyHistory = this.anomalyDetection.orderFrequencyHistory.filter(
      entry => entry.timestamp >= oneHourAgo
    )
    
    // Log to audit trail
    this.logToAudit("order_activity", {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      size: order.size,
      price: order.price,
      status: order.status
    })
  }

  /**
   * Monitor position activity for security
   * @param position Position
   */
  private monitorPositionActivity(position: Position): void {
    // Skip if not running
    if (!this.isRunning) {
      return
    }
    
    const symbol = position.symbol
    
    // Record position size for anomaly detection
    if (!this.anomalyDetection.positionSizeHistory.has(symbol)) {
      this.anomalyDetection.positionSizeHistory.set(symbol, [])
    }
    
    const history = this.anomalyDetection.positionSizeHistory.get(symbol)!
    history.push(Math.abs(position.size))
    
    // Keep only the last 100 position sizes
    if (history.length > 100) {
      history.shift()
    }
    
    // Log to audit trail
    this.logToAudit("position_update", {
      symbol: position.symbol,
      size: position.size,
      entryPrice: position.entryPrice,
      markPrice: position.markPrice,
      liquidationPrice: position.liquidationPrice,
      unrealizedPnl: position.unrealizedPnl,
      leverage: position.leverage
    })
  }

  /**
   * Check for expired pending transactions
   */
  private checkExpiredTransactions(): void {
    const now = Date.now()
    const expirationTime = 24 * 60 * 60 * 1000 // 24 hours
    
    for (const [id, transaction] of this.pendingTransactions.entries()) {
      if (
        transaction.status === "pending" &&
        now - transaction.timestamp > expirationTime
      ) {
        // Mark as expired
        transaction.status = "expired"
        
        console.log(`Transaction ${id} has expired`)
        
        // Log to audit trail
        this.logToAudit("transaction_expired", {
          transactionId: id,
          type: transaction.type,
          value: transaction.value,
          age: (now - transaction.timestamp) / (60 * 60 * 1000) // in hours
        })
        
        // Emit event
        this.emit("transaction_expired", {
          id,
          type: transaction.type,
          data: transaction.data,
          value: transaction.value,
          timestamp: transaction.timestamp
        })
      }
    }
  }

  /**
   * Detect anomalies in trading activity
   */
  private detectAnomalies(): void {
    // Skip if not enough data
    if (
      this.anomalyDetection.orderSizeHistory.length < 10 ||
      this.anomalyDetection.orderFrequencyHistory.length < 10
    ) {
      return
    }
    
    const now = Date.now()
    
    // Don't alert more than once per 10 minutes
    if (now - this.anomalyDetection.lastAlertTime < 10 * 60 * 1000) {
      return
    }
    
    // Check for anomalies in order size
    const orderSizeAnomaly = this.detectOrderSizeAnomaly()
    
    // Check for anomalies in order frequency
    const orderFrequencyAnomaly = this.detectOrderFrequencyAnomaly()
    
    // Check for anomalies in position size
    const positionSizeAnomaly = this.detectPositionSizeAnomaly()
    
    // If any anomaly is detected, trigger an alert
    if (orderSizeAnomaly || orderFrequencyAnomaly || positionSizeAnomaly) {
      this.anomalyDetection.lastAlertTime = now
      
      const anomalyDetails = {
        orderSize: orderSizeAnomaly,
        orderFrequency: orderFrequencyAnomaly,
        positionSize: positionSizeAnomaly,
        timestamp: now
      }
      
      console.log("Anomaly detected:", anomalyDetails)
      
      // Log to audit trail
      this.logToAudit("anomaly_detected", anomalyDetails)
      
      // Emit event
      this.emit("anomaly_detected", anomalyDetails)
    }
  }

  /**
   * Detect anomalies in order size
   * @returns Anomaly details or null if none detected
   */
  private detectOrderSizeAnomaly(): any | null {
    const orderSizes = this.anomalyDetection.orderSizeHistory
    
    // Calculate mean and standard deviation
    const mean = orderSizes.reduce((sum, size) => sum + size, 0) / orderSizes.length
    const squaredDiffs = orderSizes.map(size => Math.pow(size - mean, 2))
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length
    const stdDev = Math.sqrt(variance)
    
    // Get the most recent order size
    const latestSize = orderSizes[orderSizes.length - 1]
    
    // Calculate z-score
    const zScore = (latestSize - mean) / stdDev
    
    // Determine threshold based on sensitivity level
    let threshold = 3.0 // Default (medium)
    
    if (this.config.anomalyDetection.sensitivityLevel === "low") {
      threshold = 4.0
    } else if (this.config.anomalyDetection.sensitivityLevel === "high") {
      threshold = 2.0
    }
    
    // Check if z-score exceeds threshold
    if (Math.abs(zScore) > threshold) {
      return {
        type: "order_size",
        value: latestSize,
        mean,
        stdDev,
        zScore,
        threshold
      }
    }
    
    return null
  }

  /**
   * Detect anomalies in order frequency
   * @returns Anomaly details or null if none detected
   */
  private detectOrderFrequencyAnomaly(): any | null {
    const orderHistory = this.anomalyDetection.orderFrequencyHistory
    
    // Count orders in the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const recentOrders = orderHistory.filter(entry => entry.timestamp >= fiveMinutesAgo)
    const recentCount = recentOrders.length
    
    // Calculate average orders per 5 minutes over the last hour
    const intervals = 12 // 12 5-minute intervals in an hour
    const countsPerInterval = []
    
    for (let i = 0; i < intervals; i++) {
      const intervalStart = Date.now() - (i + 1) * 5 * 60 * 1000
      const intervalEnd = Date.now() - i * 5 * 60 * 1000
      
      const intervalOrders = orderHistory.filter(
        entry => entry.timestamp >= intervalStart && entry.timestamp < intervalEnd
      )
      
      countsPerInterval.push(intervalOrders.length)
    }
    
    // Calculate mean and standard deviation of order counts
    const mean = countsPerInterval.reduce((sum, count) => sum + count, 0) / countsPerInterval.length
    const squaredDiffs = countsPerInterval.map(count => Math.pow(count - mean, 2))
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length
    const stdDev = Math.sqrt(variance)
    
    // Calculate z-score
    const zScore = (recentCount - mean) / (stdDev || 1) // Avoid division by zero
    
    // Determine threshold based on sensitivity level
    let threshold = 3.0 // Default (medium)
    
    if (this.config.anomalyDetection.sensitivityLevel === "low") {
      threshold = 4.0
    } else if (this.config.anomalyDetection.sensitivityLevel === "high") {
      threshold = 2.0
    }
    
    // Check if z-score exceeds threshold
    if (zScore > threshold) {
      return {
        type: "order_frequency",
        value: recentCount,
        mean,
        stdDev,
        zScore,
        threshold
      }
    }
    
    return null
  }

  /**
   * Detect anomalies in position size
   * @returns Anomaly details or null if none detected
   */
  private detectPositionSizeAnomaly(): any | null {
    // Check each symbol
    for (const [symbol, history] of this.anomalyDetection.positionSizeHistory.entries()) {
      // Skip if not enough data
      if (history.length < 10) {
        continue
      }
      
      // Calculate mean and standard deviation
      const mean = history.reduce((sum, size) => sum + size, 0) / history.length
      const squaredDiffs = history.map(size => Math.pow(size - mean, 2))
      const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length
      const stdDev = Math.sqrt(variance)
      
      // Get the most recent position size
      const latestSize = history[history.length - 1]
      
      // Calculate z-score
      const zScore = (latestSize - mean) / (stdDev || 1) // Avoid division by zero
      
      // Determine threshold based on sensitivity level
      let threshold = 3.0 // Default (medium)
      
      if (this.config.anomalyDetection.sensitivityLevel === "low") {
        threshold = 4.0
      } else if (this.config.anomalyDetection.sensitivityLevel === "high") {
        threshold = 2.0
      }
      
      // Check if z-score exceeds threshold
      if (Math.abs(zScore) > threshold) {
        return {
          type: "position_size",
          symbol,
          value: latestSize,
          mean,
          stdDev,
          zScore,
          threshold
        }
      }
    }
    
    return null
  }

  /**
   * Secure a transaction based on its value
   * @param type Transaction type
   * @param data Transaction data
   * @param value Transaction value
   * @returns Transaction ID
   */
  public async secureTransaction(
    type: string,
    data: any,
    value: number
  ): Promise<string> {
    // Generate transaction ID
    const id = crypto.randomUUID()
    
    // Determine security level based on value
    const securityLevel = this.getSecurityLevel(value)
    
    console.log(`Securing transaction ${id} with ${securityLevel} security level`)
    
    // Log to audit trail
    this.logToAudit("transaction_created", {
      transactionId: id,
      type,
      value,
      securityLevel
    })
    
    // For low security transactions, approve automatically
    if (securityLevel === "low") {
      return await this.executeTransaction(id, type, data, value)
    }
    
    // For medium and high security transactions, require multi-sig if enabled
    if (this.config.multiSig.enable && securityLevel !== "low") {
      // Create pending transaction
      this.pendingTransactions.set(id, {
        id,
        type,
        data,
        value,
        timestamp: Date.now(),
        signatures: new Map(),
        status: "pending"
      })
      
      // Add initial signature from the bot
      await this.signTransaction(id, this.walletManager.getAddress())
      
      // Emit event for external signatures
      this.emit("transaction_pending", {
        id,
        type,
        data,
        value,
        securityLevel,
        requiredSignatures: this.config.multiSig.requiredSignatures
      })
      
      return id
    } else {
      // If multi-sig is disabled, execute immediately
      return await this.executeTransaction(id, type, data, value)
    }
  }

  /**
   * Get security level based on transaction value
   * @param value Transaction value
   * @returns Security level
   */
  private getSecurityLevel(value: number): "low" | "medium" | "high" {
    if (value <= this.config.transactionLimits.tier1.maxAmount) {
      return this.config.transactionLimits.tier1.securityLevel
    } else if (value <= this.config.transactionLimits.tier2.maxAmount) {
      return this.config.transactionLimits.tier2.securityLevel
    } else {
      return this.config.transactionLimits.tier3.securityLevel
    }
  }

  /**
   * Sign a pending transaction
   * @param transactionId Transaction ID
   * @param signerAddress Signer address
   * @returns True if transaction is now ready to execute
   */
  public async signTransaction(
    transactionId: string,
    signerAddress: string
  ): Promise<boolean> {
    // Get pending transaction
    const transaction = this.pendingTransactions.get(transactionId)
    
    if (!transaction || transaction.status !== "pending") {
      throw new Error(`Transaction ${transactionId} not found or not pending`)
    }
    
    // Check if signer is authorized
    if (
      !this.config.multiSig.authorizedAddresses.includes(signerAddress) &&
      signerAddress !== this.walletManager.getAddress()
    ) {
      throw new Error(`Signer ${signerAddress} not authorized`)
    }
    
    // Generate signature (in a real implementation, this would use a cryptographic signature)
    const signature = crypto
      .createHash("sha256")
      .update(`${transactionId}:${signerAddress}:${Date.now()}`)
      .digest("hex")
    
    // Add signature
    transaction.signatures.set(signerAddress, signature)
    
    console.log(`Transaction ${transactionId} signed by ${signerAddress}`)
    
    // Log to audit trail
    this.logToAudit("transaction_signed", {
      transactionId,
      signer: signerAddress,
      signatureCount: transaction.signatures.size,
      requiredSignatures: this.config.multiSig.requiredSignatures
    })
    
    // Check if we have enough signatures
    const isReady = transaction.signatures.size >= this.config.multiSig.requiredSignatures
    
    if (isReady) {
      console.log(`Transaction ${transactionId} has enough signatures, executing...`)
      
      // Update status
      transaction.status = "approved"
      
      // Execute transaction
      await this.executeTransaction(
        transactionId,
        transaction.type,
        transaction.data,
        transaction.value
      )
    }
    
    return isReady
  }

  /**
   * Execute a transaction
   * @param id Transaction ID
   * @param type Transaction type
   * @param data Transaction data
   * @param value Transaction value
   * @returns Transaction ID
   */
  private async executeTransaction(
    id: string,
    type: string,
    data: any,
    value: number
  ): Promise<string> {
    try {
      console.log(`Executing transaction ${id} of type ${type}`)
      
      // Update pending transaction status if it exists
      const pendingTransaction = this.pendingTransactions.get(id)
      if (pendingTransaction) {
        pendingTransaction.status = "executed"
      }
      
      // Execute transaction based on type
      // In a real implementation, this would handle different transaction types
      // such as orders, withdrawals, etc.
      
      // For this example, we'll just log the execution
      console.log(`Transaction ${id} executed successfully`)
      
      // Log to audit trail
      this.logToAudit("transaction_executed", {
        transactionId: id,
        type,
        value,
        data
      })
      
      // Add to transaction history
      this.transactionHistory.push({
        id,
        type,
        data,
        value,
        timestamp: Date.now(),
        status: "executed",
        securityLevel: this.getSecurityLevel(value)
      })
      
      // Keep only the last 1000 transactions
      if (this.transactionHistory.length > 1000) {
        this.transactionHistory.shift()
      }
      
      // Emit event
      this.emit("transaction_executed", {
        id,
        type,
        data,
        value,
        timestamp: Date.now()
      })
      
      return id
    } catch (error) {
      console.error(`Failed to execute transaction ${id}:`, error)
      
      // Update pending transaction status if it exists
      const pendingTransaction = this.pendingTransactions.get(id)
      if (pendingTransaction) {
        pendingTransaction.status = "rejected"
      }
      
      // Log to audit trail
      this.logToAudit("transaction_failed", {
        transactionId: id,
        type,
        value,
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Add to transaction history
      this.transactionHistory.push({
        id,
        type,
        data,
        value,
        timestamp: Date.now(),
        status: "failed",
        securityLevel: this.getSecurityLevel(value)
      })
      
      // Emit event
      this.emit("transaction_failed", {
        id,
        type,
        data,
        value,
        timestamp: Date.now(),
        error
      })
      
      throw error
    }
  }

  /**
   * Log an action to the audit trail
   * @param action Action type
   * @param details Action details
   */
  private logToAudit(action: string, details: any): void {
    const timestamp = Date.now()
    
    // Create a hash of the previous entry and the current entry
    // to create a tamper-evident chain
    const previousHash = this.auditLog.length > 0
      ? this.auditLog[this.auditLog.length - 1].hash
      : "0000000000000000000000000000000000000000000000000000000000000000"
    
    const dataString = JSON.stringify({
      timestamp,
      action,
      details,
      previousHash
    })
    
    const hash = crypto
      .createHash("sha256")
      .update(dataString)
      .digest("hex")
    
    // Add to audit log
    this.auditLog.push({
      timestamp,
      action,
      details,
      hash
    })
    
    // Keep audit log at a reasonable size
    if (this.auditLog.length > 10000) {
      // In a real implementation, you would archive old entries
      // rather than discarding them
      this.auditLog.shift()
    }
  }

  /**
   * Verify the integrity of the audit log
   * @returns True if audit log is intact
   */
  public verifyAuditLog(): boolean {
    if (this.auditLog.length === 0) {
      return true
    }
    
    for (let i = 1; i < this.auditLog.length; i++) {
      const currentEntry = this.auditLog[i]
      const previousEntry = this.auditLog[i - 1]
      
      // Verify that the previous hash matches
      if (currentEntry.details.previousHash !== previousEntry.hash) {
        console.error(`Audit log integrity violation at entry ${i}`)
        return false
      }
      
      // Verify the hash of the previous entry
      const dataString = JSON.stringify({
        timestamp: previousEntry.timestamp,
        action: previousEntry.action,
        details: previousEntry.details,
        previousHash: i > 1 ? this.auditLog[i - 2].hash : "0000000000000000000000000000000000000000000000000000000000000000"
      })
      
      const calculatedHash = crypto
        .createHash("sha256")
        .update(dataString)
        .digest("hex")
      
      if (calculatedHash !== previousEntry.hash) {
        console.error(`Audit log hash mismatch at entry ${i - 1}`)
        return false
      }
    }
    
    return true
  }

  /**
   * Get pending transactions
   * @returns Array of pending transactions
   */
  public getPendingTransactions(): any[] {
    return Array.from(this.pendingTransactions.values())
      .filter(tx => tx.status === "pending")
      .map(tx => ({
        id: tx.id,
        type: tx.type,
        value: tx.value,
        timestamp: tx.timestamp,
        signatureCount: tx.signatures.size,
        requiredSignatures: this.config.multiSig.requiredSignatures,
        status: tx.status
      }))
  }

  /**
   * Get transaction history
   * @param limit Maximum number of transactions to return
   * @returns Array of transactions
   */
  public getTransactionHistory(limit = 100): any[] {
    // Sort by timestamp (newest first)
    const sorted = [...this.transactionHistory].sort((a, b) => b.timestamp - a.timestamp)
    
    // Apply limit
    return sorted.slice(0, limit).map(tx => ({
      id: tx.id,
      type: tx.type,
      value: tx.value,
      timestamp: tx.timestamp,
      status: tx.status,
      securityLevel: tx.securityLevel
    }))
  }

  /**
   * Get audit log entries
   * @param limit Maximum number of entries to return
   * @returns Array of audit log entries
   */
  public getAuditLog(limit = 100): any[] {
    // Sort by timestamp (newest first)
    const sorted = [...this.auditLog].sort((a, b) => b.timestamp - a.timestamp)
    
    // Apply limit
    return sorted.slice(0, limit).map(entry => ({
      timestamp: entry.timestamp,
      action: entry.action,
      details: entry.details
    }))
  }

  /**
   * Get the current state of the security manager
   * @returns Security manager state
   */
  public getState(): any {
    return {
      isRunning: this.isRunning,
      pendingTransactionCount: Array.from(this.pendingTransactions.values())
        .filter(tx => tx.status === "pending").length,
      transactionHistoryCount: this.transactionHistory.length,
      auditLogCount: this.auditLog.length,
      auditLogIntegrity: this.verifyAuditLog(),
      multiSigEnabled: this.config.multiSig.enable,
      anomalyDetectionEnabled: this.config.anomalyDetection.enable,
      lastAnomalyAlertTime: this.anomalyDetection.lastAlertTime > 0
        ? new Date(this.anomalyDetection.lastAlertTime).toISOString()
        : null
    }
  }
}

/**
 * Create a default security configuration
 * @param walletAddress Wallet address
 * @returns Default security configuration
 */
export function createDefaultSecurityConfig(walletAddress: string): SecurityConfig {
  return {
    multiSig: {
      enable: true,
      requiredSignatures: 2,
      authorizedAddresses: [
        walletAddress,
        "0x0000000000000000000000000000000000000000" // Placeholder for additional authorized address
      ]
    },
    transactionLimits: {
      tier1: {
        maxAmount: 1000, // $1,000
        securityLevel: "low"
      },
      tier2: {
        maxAmount: 10000, // $10,000
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
  }
}

/**
 * Create a SecurityManager instance with default configuration
 * @param api HyperliquidAPI instance
 * @param walletManager WalletManager instance
 * @returns SecurityManager instance
 */
export function createSecurityManager(
  api: HyperliquidAPI,
  walletManager: WalletManager
): SecurityManager {
  const config = createDefaultSecurityConfig(walletManager.getAddress())
  return new SecurityManager(config, api, walletManager)
}
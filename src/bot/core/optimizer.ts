import { EventEmitter } from "events"
import {
  OptimizationConfig,
  BotConfig,
  MarketData,
  PerformanceMetrics
} from "../types"
import { HyperliquidAPI } from "../services/api"
import { PerformanceAnalytics } from "./analytics"

/**
 * Optimizer implements self-optimization capabilities for the Hyperliquid DEX bot.
 * It uses genetic algorithms, A/B testing, and market regime detection to
 * continuously improve the bot's performance.
 */
export class Optimizer extends EventEmitter {
  private config: OptimizationConfig
  private api: HyperliquidAPI
  private analytics: PerformanceAnalytics
  private botConfig: BotConfig
  private isRunning = false
  private optimizationInterval?: NodeJS.Timeout
  private abTestVariants: Map<string, BotConfig> = new Map() // variant -> config
  private variantPerformance: Map<string, PerformanceMetrics> = new Map() // variant -> metrics
  private marketRegimes: Map<string, {
    regime: "momentum" | "mean-reversion" | "ranging",
    confidence: number,
    lastUpdate: number
  }> = new Map() // symbol -> market regime
  private marketData: Map<string, MarketData[]> = new Map() // symbol -> historical market data
  private bestParameters: Map<string, any> = new Map() // parameter -> value
  private optimizationHistory: Array<{
    timestamp: number,
    parameters: Map<string, any>,
    performance: PerformanceMetrics
  }> = []
  private lastOptimizationTime = 0

  /**
   * Creates a new Optimizer instance
   * @param config Optimization configuration
   * @param api HyperliquidAPI instance
   * @param analytics PerformanceAnalytics instance
   * @param botConfig Bot configuration
   */
  constructor(
    config: OptimizationConfig,
    api: HyperliquidAPI,
    analytics: PerformanceAnalytics,
    botConfig: BotConfig
  ) {
    super()
    this.config = config
    this.api = api
    this.analytics = analytics
    this.botConfig = botConfig
    
    // Set up API event listeners
    this.setupEventListeners()
  }

  /**
   * Set up event listeners for API events
   */
  private setupEventListeners(): void {
    // Market data updates
    this.api.on("market", (data: MarketData) => {
      this.updateMarketData(data)
      this.updateMarketRegime(data.symbol)
    })
    
    // Performance metrics updates
    this.analytics.on("overall_metrics_update", (metrics: PerformanceMetrics) => {
      this.updateVariantPerformance("default", metrics)
    })
  }

  /**
   * Start the optimizer
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("Optimizer already running")
      return true
    }
    
    try {
      console.log("Starting optimizer...")
      
      // Initialize best parameters with current values
      this.initializeBestParameters()
      
      // Create A/B test variants if enabled
      if (this.config.abTesting.enable) {
        this.createAbTestVariants()
      }
      
      // Start optimization interval
      this.startOptimizationInterval()
      
      this.isRunning = true
      console.log("Optimizer started successfully")
      
      return true
    } catch (error) {
      console.error("Failed to start optimizer:", error)
      return false
    }
  }

  /**
   * Stop the optimizer
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning) {
      console.log("Optimizer not running")
      return true
    }
    
    try {
      console.log("Stopping optimizer...")
      
      // Stop optimization interval
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval)
        this.optimizationInterval = undefined
      }
      
      this.isRunning = false
      console.log("Optimizer stopped successfully")
      
      return true
    } catch (error) {
      console.error("Failed to stop optimizer:", error)
      return false
    }
  }

  /**
   * Initialize best parameters with current configuration values
   */
  private initializeBestParameters(): void {
    // Extract parameters to optimize from configuration
    this.extractParametersFromConfig(this.botConfig)
  }

  /**
   * Extract parameters to optimize from configuration
   * @param config Bot configuration
   * @param prefix Parameter prefix for nested parameters
   */
  private extractParametersFromConfig(config: any, prefix = ""): void {
    for (const key in config) {
      const paramName = prefix ? `${prefix}.${key}` : key
      
      // Check if this parameter is in the optimization ranges
      if (
        this.config.parameterRanges[paramName] &&
        typeof config[key] === "number"
      ) {
        this.bestParameters.set(paramName, config[key])
      }
      
      // Recursively extract nested parameters
      if (
        typeof config[key] === "object" &&
        config[key] !== null &&
        !Array.isArray(config[key])
      ) {
        this.extractParametersFromConfig(config[key], paramName)
      }
    }
  }

  /**
   * Start the optimization interval
   */
  private startOptimizationInterval(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval)
    }
    
    // Convert optimization interval from hours to milliseconds
    const intervalMs = this.config.optimizationInterval * 60 * 60 * 1000
    
    this.optimizationInterval = setInterval(() => {
      this.runOptimization()
    }, intervalMs)
  }

  /**
   * Run optimization process
   */
  private async runOptimization(): Promise<void> {
    if (!this.isRunning || !this.config.enable) {
      return
    }
    
    try {
      console.log("Running optimization...")
      
      // Update market regimes for all symbols
      for (const symbol of this.marketData.keys()) {
        this.updateMarketRegime(symbol)
      }
      
      // Run genetic algorithm optimization
      await this.runGeneticAlgorithm()
      
      // Evaluate A/B test variants if enabled
      if (this.config.abTesting.enable) {
        this.evaluateAbTestVariants()
      }
      
      // Apply optimized parameters
      this.applyOptimizedParameters()
      
      // Record optimization history
      this.recordOptimizationHistory()
      
      this.lastOptimizationTime = Date.now()
      console.log("Optimization completed successfully")
    } catch (error) {
      console.error("Failed to run optimization:", error)
    }
  }

  /**
   * Update market data history
   * @param data Market data
   */
  private updateMarketData(data: MarketData): void {
    const symbol = data.symbol
    const history = this.marketData.get(symbol) || []
    
    // Add current data to history
    history.push({ ...data })
    
    // Keep only the last 1000 data points
    if (history.length > 1000) {
      history.shift()
    }
    
    this.marketData.set(symbol, history)
  }

  /**
   * Update market regime for a symbol
   * @param symbol Trading symbol
   */
  private updateMarketRegime(symbol: string): void {
    const history = this.marketData.get(symbol)
    
    if (!history || history.length < 100) {
      return
    }
    
    // Calculate indicators for regime detection
    const prices = history.map(data => data.lastPrice)
    
    // Calculate short-term and long-term moving averages
    const shortTermMA = this.calculateSMA(prices, 20)
    const longTermMA = this.calculateSMA(prices, 100)
    
    // Calculate RSI
    const rsi = this.calculateRSI(prices, 14)
    
    // Calculate volatility
    const volatility = this.calculateVolatility(prices, 20)
    
    // Determine market regime
    let regime: "momentum" | "mean-reversion" | "ranging"
    let confidence = 0
    
    if (shortTermMA > longTermMA && rsi > 60) {
      // Bullish momentum
      regime = "momentum"
      confidence = 0.7 + (rsi - 60) / 100
    } else if (shortTermMA < longTermMA && rsi < 40) {
      // Bearish momentum
      regime = "momentum"
      confidence = 0.7 + (40 - rsi) / 100
    } else if (Math.abs(shortTermMA - longTermMA) / longTermMA < 0.01 && volatility < 0.01) {
      // Ranging market
      regime = "ranging"
      confidence = 0.6 + (0.01 - volatility) * 10
    } else {
      // Mean-reversion
      regime = "mean-reversion"
      confidence = 0.5 + Math.abs(50 - rsi) / 100
    }
    
    // Cap confidence at 0.95
    confidence = Math.min(confidence, 0.95)
    
    // Update market regime
    this.marketRegimes.set(symbol, {
      regime,
      confidence,
      lastUpdate: Date.now()
    })
    
    this.emit("market_regime_update", {
      symbol,
      regime,
      confidence
    })
  }

  /**
   * Calculate Simple Moving Average
   * @param prices Price array
   * @param period Period
   * @returns SMA value
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1]
    }
    
    const slice = prices.slice(prices.length - period)
    const sum = slice.reduce((total, price) => total + price, 0)
    return sum / period
  }

  /**
   * Calculate Relative Strength Index
   * @param prices Price array
   * @param period Period
   * @returns RSI value
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) {
      return 50
    }
    
    // Calculate price changes
    const changes = []
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1])
    }
    
    // Get the last 'period' changes
    const recentChanges = changes.slice(changes.length - period)
    
    // Calculate average gains and losses
    let gains = 0
    let losses = 0
    
    for (const change of recentChanges) {
      if (change > 0) {
        gains += change
      } else {
        losses -= change
      }
    }
    
    const avgGain = gains / period
    const avgLoss = losses / period
    
    // Calculate RS and RSI
    if (avgLoss === 0) {
      return 100
    }
    
    const rs = avgGain / avgLoss
    const rsi = 100 - (100 / (1 + rs))
    
    return rsi
  }

  /**
   * Calculate price volatility
   * @param prices Price array
   * @param period Period
   * @returns Volatility as a decimal
   */
  private calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) {
      return 0
    }
    
    const slice = prices.slice(prices.length - period)
    
    // Calculate returns
    const returns = []
    for (let i = 1; i < slice.length; i++) {
      returns.push((slice[i] - slice[i - 1]) / slice[i - 1])
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
    const squaredDiffs = returns.map(value => Math.pow(value - mean, 2))
    const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / squaredDiffs.length
    
    return Math.sqrt(variance)
  }

  /**
   * Create A/B test variants
   */
  private createAbTestVariants(): void {
    console.log(`Creating ${this.config.abTesting.variants} A/B test variants...`)
    
    // Clear existing variants
    this.abTestVariants.clear()
    this.variantPerformance.clear()
    
    // Add default variant
    this.abTestVariants.set("default", this.botConfig)
    this.variantPerformance.set("default", this.analytics.getOverallMetrics())
    
    // Create new variants
    for (let i = 1; i <= this.config.abTesting.variants; i++) {
      const variantName = `variant-${i}`
      const variantConfig = this.createVariantConfig()
      
      this.abTestVariants.set(variantName, variantConfig)
      this.variantPerformance.set(variantName, this.analytics.getOverallMetrics())
      
      console.log(`Created A/B test variant: ${variantName}`)
    }
  }

  /**
   * Create a variant configuration with random parameter variations
   * @returns Variant configuration
   */
  private createVariantConfig(): BotConfig {
    // Clone the current bot configuration
    const variantConfig = JSON.parse(JSON.stringify(this.botConfig))
    
    // Modify a random subset of parameters
    const parameterNames = Array.from(this.bestParameters.keys())
    const numParamsToModify = Math.max(1, Math.floor(parameterNames.length * 0.3)) // Modify 30% of parameters
    
    // Shuffle parameter names
    const shuffledParams = this.shuffleArray([...parameterNames])
    const paramsToModify = shuffledParams.slice(0, numParamsToModify)
    
    for (const paramName of paramsToModify) {
      const range = this.config.parameterRanges[paramName]
      
      if (range) {
        // Generate a random value within the parameter range
        const randomValue = range.min + Math.random() * (range.max - range.min)
        const roundedValue = Math.round(randomValue / range.step) * range.step
        
        // Update the parameter in the variant config
        this.setNestedProperty(variantConfig, paramName, roundedValue)
      }
    }
    
    return variantConfig
  }

  /**
   * Set a nested property in an object
   * @param obj Object to modify
   * @param path Property path (e.g., "marketMaking.spread.baseTiers.tier1")
   * @param value Value to set
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const parts = path.split(".")
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) {
        current[part] = {}
      }
      current = current[part]
    }
    
    current[parts[parts.length - 1]] = value
  }

  /**
   * Get a nested property from an object
   * @param obj Object to get property from
   * @param path Property path (e.g., "marketMaking.spread.baseTiers.tier1")
   * @returns Property value or undefined if not found
   */
  private getNestedProperty(obj: any, path: string): any {
    const parts = path.split(".")
    let current = obj
    
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined
      }
      current = current[part]
    }
    
    return current
  }

  /**
   * Shuffle an array (Fisher-Yates algorithm)
   * @param array Array to shuffle
   * @returns Shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array]
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    
    return result
  }

  /**
   * Update performance metrics for a variant
   * @param variantName Variant name
   * @param metrics Performance metrics
   */
  private updateVariantPerformance(variantName: string, metrics: PerformanceMetrics): void {
    this.variantPerformance.set(variantName, { ...metrics })
  }

  /**
   * Evaluate A/B test variants
   */
  private evaluateAbTestVariants(): void {
    if (!this.config.abTesting.enable) {
      return
    }
    
    console.log("Evaluating A/B test variants...")
    
    // Find the best performing variant
    let bestVariant = "default"
    let bestPerformance = -Infinity
    
    for (const [variantName, metrics] of this.variantPerformance.entries()) {
      // Use PnL as the primary performance metric
      const performance = metrics.pnl.total
      
      if (performance > bestPerformance) {
        bestPerformance = performance
        bestVariant = variantName
      }
    }
    
    console.log(`Best performing variant: ${bestVariant}`)
    
    // If a variant outperforms the default, update the best parameters
    if (bestVariant !== "default") {
      const bestConfig = this.abTestVariants.get(bestVariant)
      
      if (bestConfig) {
        // Update best parameters from the winning variant
        for (const paramName of this.bestParameters.keys()) {
          const variantValue = this.getNestedProperty(bestConfig, paramName)
          
          if (variantValue !== undefined) {
            this.bestParameters.set(paramName, variantValue)
          }
        }
        
        console.log("Updated best parameters from winning variant")
      }
    }
    
    // Create new variants for the next test period
    this.createAbTestVariants()
  }

  /**
   * Run genetic algorithm optimization
   */
  private async runGeneticAlgorithm(): Promise<void> {
    console.log("Running genetic algorithm optimization...")
    
    // Create initial population
    const populationSize = this.config.geneticAlgorithm.populationSize
    const generations = this.config.geneticAlgorithm.generations
    
    let population = this.createInitialPopulation(populationSize)
    
    // Evaluate initial population
    let evaluatedPopulation = await this.evaluatePopulation(population)
    
    // Run generations
    for (let gen = 0; gen < generations; gen++) {
      console.log(`Genetic algorithm generation ${gen + 1}/${generations}`)
      
      // Select parents
      const parents = this.selectParents(evaluatedPopulation)
      
      // Create offspring through crossover and mutation
      const offspring = this.createOffspring(parents)
      
      // Evaluate offspring
      const evaluatedOffspring = await this.evaluatePopulation(offspring)
      
      // Select survivors for next generation
      evaluatedPopulation = this.selectSurvivors(evaluatedPopulation, evaluatedOffspring)
    }
    
    // Update best parameters from the best individual
    const bestIndividual = evaluatedPopulation[0].individual
    
    for (const [paramName, value] of bestIndividual.entries()) {
      this.bestParameters.set(paramName, value)
    }
    
    console.log("Genetic algorithm optimization completed")
  }

  /**
   * Create initial population for genetic algorithm
   * @param size Population size
   * @returns Initial population
   */
  private createInitialPopulation(size: number): Map<string, number>[] {
    const population: Map<string, number>[] = []
    
    // Add current best parameters as first individual
    population.push(new Map(this.bestParameters))
    
    // Generate random individuals for the rest of the population
    for (let i = 1; i < size; i++) {
      const individual = new Map<string, number>()
      
      for (const [paramName, currentValue] of this.bestParameters.entries()) {
        const range = this.config.parameterRanges[paramName]
        
        if (range) {
          // Generate a random value within the parameter range
          const randomValue = range.min + Math.random() * (range.max - range.min)
          const roundedValue = Math.round(randomValue / range.step) * range.step
          
          individual.set(paramName, roundedValue)
        } else {
          // Use current value if no range is defined
          individual.set(paramName, currentValue)
        }
      }
      
      population.push(individual)
    }
    
    return population
  }

  /**
   * Evaluate population fitness
   * @param population Population to evaluate
   * @returns Evaluated population with fitness scores
   */
  private async evaluatePopulation(
    population: Map<string, number>[]
  ): Promise<Array<{ individual: Map<string, number>, fitness: number }>> {
    const evaluatedPopulation: Array<{ individual: Map<string, number>, fitness: number }> = []
    
    // In a real implementation, you would run simulations or backtests
    // to evaluate each individual's performance. For this example,
    // we'll use a simplified fitness function.
    
    for (const individual of population) {
      const fitness = this.calculateFitness(individual)
      evaluatedPopulation.push({ individual, fitness })
    }
    
    // Sort by fitness (descending)
    evaluatedPopulation.sort((a, b) => b.fitness - a.fitness)
    
    return evaluatedPopulation
  }

  /**
   * Calculate fitness for an individual
   * @param individual Individual to evaluate
   * @returns Fitness score
   */
  private calculateFitness(individual: Map<string, number>): number {
    // In a real implementation, this would run a simulation or backtest
    // using the individual's parameters and return a fitness score based
    // on performance metrics like PnL, Sharpe ratio, etc.
    
    // For this example, we'll use a simplified approach that favors
    // parameters closer to the current best parameters, with some
    // randomness to allow exploration.
    
    let fitness = 0
    
    for (const [paramName, value] of individual.entries()) {
      const bestValue = this.bestParameters.get(paramName) || 0
      const range = this.config.parameterRanges[paramName]
      
      if (range) {
        // Calculate normalized distance from best value
        const paramRange = range.max - range.min
        const distance = Math.abs(value - bestValue) / paramRange
        
        // Convert to a fitness component (closer is better)
        const paramFitness = 1 - distance
        
        // Add to total fitness with some randomness
        fitness += paramFitness * (0.8 + 0.4 * Math.random())
      }
    }
    
    // Normalize fitness
    fitness /= individual.size
    
    return fitness
  }

  /**
   * Select parents for reproduction
   * @param population Evaluated population
   * @returns Selected parents
   */
  private selectParents(
    population: Array<{ individual: Map<string, number>, fitness: number }>
  ): Map<string, number>[] {
    const parents: Map<string, number>[] = []
    const numParents = Math.floor(population.length / 2)
    
    // Tournament selection
    for (let i = 0; i < numParents; i++) {
      // Select two random individuals
      const idx1 = Math.floor(Math.random() * population.length)
      let idx2 = Math.floor(Math.random() * population.length)
      
      // Ensure idx2 is different from idx1
      while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * population.length)
      }
      
      // Select the one with higher fitness
      const winner = population[idx1].fitness > population[idx2].fitness
        ? population[idx1].individual
        : population[idx2].individual
      
      parents.push(new Map(winner))
    }
    
    return parents
  }

  /**
   * Create offspring through crossover and mutation
   * @param parents Parent individuals
   * @returns Offspring individuals
   */
  private createOffspring(parents: Map<string, number>[]): Map<string, number>[] {
    const offspring: Map<string, number>[] = []
    const numOffspring = parents.length
    
    for (let i = 0; i < numOffspring; i++) {
      // Select two random parents
      const parentIdx1 = Math.floor(Math.random() * parents.length)
      let parentIdx2 = Math.floor(Math.random() * parents.length)
      
      // Ensure parent2 is different from parent1
      while (parentIdx2 === parentIdx1) {
        parentIdx2 = Math.floor(Math.random() * parents.length)
      }
      
      const parent1 = parents[parentIdx1]
      const parent2 = parents[parentIdx2]
      
      // Create child through crossover
      const child = this.crossover(parent1, parent2)
      
      // Apply mutation
      this.mutate(child)
      
      offspring.push(child)
    }
    
    return offspring
  }

  /**
   * Perform crossover between two parents
   * @param parent1 First parent
   * @param parent2 Second parent
   * @returns Child individual
   */
  private crossover(
    parent1: Map<string, number>,
    parent2: Map<string, number>
  ): Map<string, number> {
    const child = new Map<string, number>()
    const crossoverRate = this.config.geneticAlgorithm.crossoverRate
    
    for (const paramName of parent1.keys()) {
      // Decide which parent to inherit from
      if (Math.random() < crossoverRate) {
        // Uniform crossover
        const value = Math.random() < 0.5
          ? parent1.get(paramName)!
          : parent2.get(paramName)!
        
        child.set(paramName, value)
      } else {
        // Blend crossover (interpolation)
        const value1 = parent1.get(paramName)!
        const value2 = parent2.get(paramName)!
        const alpha = Math.random()
        const blendedValue = value1 * alpha + value2 * (1 - alpha)
        
        // Round to step size if needed
        const range = this.config.parameterRanges[paramName]
        if (range) {
          const roundedValue = Math.round(blendedValue / range.step) * range.step
          child.set(paramName, roundedValue)
        } else {
          child.set(paramName, blendedValue)
        }
      }
    }
    
    return child
  }

  /**
   * Apply mutation to an individual
   * @param individual Individual to mutate
   */
  private mutate(individual: Map<string, number>): void {
    const mutationRate = this.config.geneticAlgorithm.mutationRate
    
    for (const [paramName, value] of individual.entries()) {
      // Decide whether to mutate this parameter
      if (Math.random() < mutationRate) {
        const range = this.config.parameterRanges[paramName]
        
        if (range) {
          // Generate a random value within the parameter range
          const randomValue = range.min + Math.random() * (range.max - range.min)
          const roundedValue = Math.round(randomValue / range.step) * range.step
          
          individual.set(paramName, roundedValue)
        }
      }
    }
  }

  /**
   * Select survivors for the next generation
   * @param currentPopulation Current population
   * @param offspring Offspring population
   * @returns Selected survivors
   */
  private selectSurvivors(
    currentPopulation: Array<{ individual: Map<string, number>, fitness: number }>,
    offspring: Array<{ individual: Map<string, number>, fitness: number }>
  ): Array<{ individual: Map<string, number>, fitness: number }> {
    // Combine current population and offspring
    const combined = [...currentPopulation, ...offspring]
    
    // Sort by fitness (descending)
    combined.sort((a, b) => b.fitness - a.fitness)
    
    // Select top individuals
    return combined.slice(0, currentPopulation.length)
  }

  /**
   * Apply optimized parameters to the bot configuration
   */
  private applyOptimizedParameters(): void {
    console.log("Applying optimized parameters...")
    
    // Create a copy of the current bot configuration
    const newConfig = JSON.parse(JSON.stringify(this.botConfig))
    
    // Apply best parameters
    for (const [paramName, value] of this.bestParameters.entries()) {
      this.setNestedProperty(newConfig, paramName, value)
    }
    
    // Update bot configuration
    this.botConfig = newConfig
    
    // Emit configuration update event
    this.emit("config_update", { config: newConfig })
    
    console.log("Optimized parameters applied successfully")
  }

  /**
   * Record optimization history
   */
  private recordOptimizationHistory(): void {
    const entry = {
      timestamp: Date.now(),
      parameters: new Map(this.bestParameters),
      performance: this.analytics.getOverallMetrics()
    }
    
    this.optimizationHistory.push(entry)
    
    // Keep only the last 100 entries
    if (this.optimizationHistory.length > 100) {
      this.optimizationHistory.shift()
    }
  }

  /**
   * Get the current market regime for a symbol
   * @param symbol Trading symbol
   * @returns Market regime information or undefined if not available
   */
  public getMarketRegime(symbol: string): {
    regime: "momentum" | "mean-reversion" | "ranging",
    confidence: number,
    lastUpdate: number
  } | undefined {
    return this.marketRegimes.get(symbol)
  }

  /**
   * Get the best parameters
   * @returns Map of best parameters
   */
  public getBestParameters(): Map<string, number> {
    return new Map(this.bestParameters)
  }

  /**
   * Get optimization history
   * @returns Optimization history
   */
  public getOptimizationHistory(): any[] {
    return this.optimizationHistory.map(entry => ({
      timestamp: entry.timestamp,
      parameters: Object.fromEntries(entry.parameters),
      performance: entry.performance
    }))
  }

  /**
   * Get the current state of the optimizer
   * @returns Optimizer state
   */
  public getState(): any {
    return {
      isRunning: this.isRunning,
      lastOptimizationTime: this.lastOptimizationTime > 0
        ? new Date(this.lastOptimizationTime).toISOString()
        : null,
      bestParameters: Object.fromEntries(this.bestParameters),
      marketRegimes: Object.fromEntries(
        Array.from(this.marketRegimes.entries()).map(([symbol, data]) => [
          symbol,
          {
            regime: data.regime,
            confidence: data.confidence,
            lastUpdate: new Date(data.lastUpdate).toISOString()
          }
        ])
      ),
      abTestVariants: this.config.abTesting.enable
        ? Array.from(this.abTestVariants.keys())
        : [],
      optimizationHistoryLength: this.optimizationHistory.length
    }
  }
}

/**
 * Create a default optimization configuration
 * @returns Default optimization configuration
 */
export function createDefaultOptimizationConfig(): OptimizationConfig {
  return {
    enable: true,
    optimizationInterval: 24, // 24 hours
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
      testDuration: 24 // 24 hours
    }
  }
}

/**
 * Create an Optimizer instance with default configuration
 * @param api HyperliquidAPI instance
 * @param analytics PerformanceAnalytics instance
 * @param botConfig Bot configuration
 * @returns Optimizer instance
 */
export function createOptimizer(
  api: HyperliquidAPI,
  analytics: PerformanceAnalytics,
  botConfig: BotConfig
): Optimizer {
  const config = createDefaultOptimizationConfig()
  return new Optimizer(config, api, analytics, botConfig)
}
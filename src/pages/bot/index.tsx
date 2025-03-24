import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/router"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/contexts/WalletContext"
import { HyperliquidBot, createBot } from "@/bot"
import Layout from "@/components/Layout"
import { ArrowUpDown, Activity, AlertTriangle, BarChart3, Cog, Play, Power, RefreshCw, Shield, Wallet } from "lucide-react"

// Define bot instance at module level to persist between renders
let botInstance: HyperliquidBot | null = null

export default function BotDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const { address, isConnected, connect } = useWallet()
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [encryptionKey, setEncryptionKey] = useState("")
  const [botStatus, setBotStatus] = useState<any>({})
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({})
  const [logs, setLogs] = useState<Array<{timestamp: number, level: string, message: string}>>([])
  const [alerts, setAlerts] = useState<Array<{timestamp: number, type: string, message: string}>>([])
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isLoading, setIsLoading] = useState(false)
  
  // Initialize bot when wallet is connected
  useEffect(() => {
    if (isConnected && address && !botInstance) {
      botInstance = createBot(address)
      
      // Set up event listeners
      botInstance.on("bot_started", () => {
        setIsRunning(true)
        addLog("info", "Bot started successfully")
      })
      
      botInstance.on("bot_stopped", () => {
        setIsRunning(false)
        addLog("info", "Bot stopped")
      })
      
      botInstance.on("risk_limit_exceeded", (data) => {
        addAlert("risk", `Risk limit exceeded: ${data.limit}`)
      })
      
      botInstance.on("circuit_breaker_triggered", (data) => {
        addAlert("circuit_breaker", `Circuit breaker triggered for ${data.symbol}`)
      })
      
      botInstance.on("security_anomaly_detected", (data) => {
        addAlert("security", `Security anomaly detected: ${data.type}`)
      })
      
      botInstance.on("transaction_pending", (data) => {
        addAlert("transaction", `Transaction pending approval: ${data.type} (${data.value})`)
      })
      
      botInstance.on("config_updated", () => {
        addLog("info", "Bot configuration updated")
        refreshBotStatus()
      })
      
      botInstance.on("connection_error", (data) => {
        addAlert("connection", `Connection error: ${data.type}`)
      })
    }
  }, [isConnected, address])
  
  // Refresh bot status periodically
  useEffect(() => {
    if (botInstance && isInitialized) {
      const interval = setInterval(() => {
        refreshBotStatus()
      }, 5000)
      
      return () => clearInterval(interval)
    }
  }, [botInstance, isInitialized])
  
  // Add log entry
  const addLog = useCallback((level: string, message: string) => {
    setLogs(prev => [
      { timestamp: Date.now(), level, message },
      ...prev.slice(0, 99) // Keep only the last 100 logs
    ])
  }, [])
  
  // Add alert
  const addAlert = useCallback((type: string, message: string) => {
    setAlerts(prev => [
      { timestamp: Date.now(), type, message },
      ...prev.slice(0, 19) // Keep only the last 20 alerts
    ])
    
    toast({
      title: "Bot Alert",
      description: message,
      variant: "destructive"
    })
  }, [toast])
  
  // Refresh bot status
  const refreshBotStatus = useCallback(() => {
    if (botInstance) {
      const status = botInstance.getStatus()
      setBotStatus(status)
      
      const metrics = botInstance.getPerformanceMetrics()
      setPerformanceMetrics(metrics)
    }
  }, [])
  
  // Initialize bot
  const handleInitialize = async () => {
    if (!botInstance) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive"
      })
      return
    }
    
    if (!encryptionKey) {
      toast({
        title: "Error",
        description: "Encryption key is required",
        variant: "destructive"
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      const success = await botInstance.initialize(encryptionKey)
      
      if (success) {
        setIsInitialized(true)
        refreshBotStatus()
        addLog("info", "Bot initialized successfully")
        
        toast({
          title: "Success",
          description: "Bot initialized successfully"
        })
      } else {
        addLog("error", "Failed to initialize bot")
        
        toast({
          title: "Error",
          description: "Failed to initialize bot",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Initialization error:", error)
      addLog("error", `Initialization error: ${error instanceof Error ? error.message : String(error)}`)
      
      toast({
        title: "Error",
        description: "An error occurred during initialization",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Start bot
  const handleStart = async () => {
    if (!botInstance || !isInitialized) {
      toast({
        title: "Error",
        description: "Bot not initialized",
        variant: "destructive"
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      const success = await botInstance.start()
      
      if (success) {
        setIsRunning(true)
        refreshBotStatus()
        
        toast({
          title: "Success",
          description: "Bot started successfully"
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to start bot",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Start error:", error)
      addLog("error", `Start error: ${error instanceof Error ? error.message : String(error)}`)
      
      toast({
        title: "Error",
        description: "An error occurred while starting the bot",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Stop bot
  const handleStop = async () => {
    if (!botInstance || !isRunning) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const success = await botInstance.stop()
      
      if (success) {
        setIsRunning(false)
        refreshBotStatus()
        
        toast({
          title: "Success",
          description: "Bot stopped successfully"
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to stop bot",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Stop error:", error)
      addLog("error", `Stop error: ${error instanceof Error ? error.message : String(error)}`)
      
      toast({
        title: "Error",
        description: "An error occurred while stopping the bot",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value)
  }
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100)
  }
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }
  
  // Render wallet connection section
  const renderWalletSection = () => {
    if (!isConnected) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to start using the Hyperliquid DEX market-making bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connect} className="w-full">
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      )
    }
    
    if (!isInitialized) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Initialize Bot</CardTitle>
            <CardDescription>
              Initialize the bot with your encryption key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                value={address}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="encryption-key">Encryption Key</Label>
              <Input
                id="encryption-key"
                type="password"
                placeholder="Enter your encryption key"
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleInitialize}
              disabled={!encryptionKey || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Initialize Bot
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot Control</CardTitle>
          <CardDescription>
            Control the Hyperliquid DEX market-making bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${isRunning ? "bg-green-500" : "bg-red-500"}`} />
              <span>Status: {isRunning ? "Running" : "Stopped"}</span>
            </div>
            <Button
              variant={isRunning ? "destructive" : "default"}
              size="sm"
              onClick={isRunning ? handleStop : handleStart}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isRunning ? (
                <Power className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {botStatus.startTime && (
            <div className="text-sm text-muted-foreground">
              Started: {new Date(botStatus.startTime).toLocaleString()}
            </div>
          )}
          
          {botStatus.uptime && (
            <div className="text-sm text-muted-foreground">
              Uptime: {formatUptime(botStatus.uptime)}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
  
  // Format uptime
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
  }
  
  // Render dashboard tab
  const renderDashboard = () => {
    if (!isInitialized) {
      return null
    }
    
    const pnl = performanceMetrics?.pnlSummary || { realized: 0, unrealized: 0, total: 0 }
    const tradeSummary = performanceMetrics?.tradeSummary || { totalTrades: 0, winRate: 0, profitFactor: 0 }
    const riskSummary = performanceMetrics?.riskSummary || { currentExposure: 0, maxExposure: 0 }
    
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(pnl.total)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Realized:</span>{" "}
                {formatCurrency(pnl.realized)}
              </div>
              <div>
                <span className="text-muted-foreground">Unrealized:</span>{" "}
                {formatCurrency(pnl.unrealized)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Trading Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tradeSummary.totalTrades} Trades
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Win Rate:</span>{" "}
                {formatPercentage(tradeSummary.winRate)}
              </div>
              <div>
                <span className="text-muted-foreground">Profit Factor:</span>{" "}
                {tradeSummary.profitFactor.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Risk Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(riskSummary.currentExposure)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Max Exposure:</span>{" "}
                {formatCurrency(riskSummary.maxExposure)}
              </div>
              <div>
                <span className="text-muted-foreground">Utilization:</span>{" "}
                {riskSummary.maxExposure > 0
                  ? formatPercentage(riskSummary.currentExposure / riskSummary.maxExposure * 100)
                  : "0%"}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No alerts to display
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert, index) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(alert.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Render performance tab
  const renderPerformance = () => {
    if (!isInitialized) {
      return null
    }
    
    const bySymbol = performanceMetrics?.bySymbol || {}
    const executionQuality = performanceMetrics?.executionQuality || { spreadCaptureEfficiency: 0, averageSlippage: 0 }
    
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance by Symbol</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(bySymbol).length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No performance data available
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(bySymbol).map(([symbol, metrics]: [string, any]) => (
                  <div key={symbol} className="space-y-2">
                    <div className="font-medium">{symbol}</div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">P&L</div>
                        <div className={`text-sm font-medium ${metrics.pnl.total >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatCurrency(metrics.pnl.total)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Trades</div>
                        <div className="text-sm font-medium">{metrics.trades.count}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Win Rate</div>
                        <div className="text-sm font-medium">{formatPercentage(metrics.trades.winRate)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Exposure</div>
                        <div className="text-sm font-medium">{formatCurrency(metrics.exposure.current)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Execution Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Spread Capture Efficiency</div>
                <div className="text-2xl font-bold">
                  {formatPercentage(executionQuality.spreadCaptureEfficiency)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Average Slippage</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(executionQuality.averageSlippage)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Render settings tab
  const renderSettings = () => {
    if (!isInitialized) {
      return null
    }
    
    const config = botInstance?.getConfig() || {}
    
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Market Making Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="mm-enabled">Enabled</Label>
              <Switch
                id="mm-enabled"
                checked={config.marketMaking?.enabled}
                disabled={true} // Disabled for demo
              />
            </div>
            
            <div className="space-y-2">
              <Label>Trading Pairs</Label>
              <div className="text-sm">
                {config.marketMaking?.pairs?.join(", ") || "None"}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Spread Configuration</Label>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tier 1:</span>{" "}
                  {config.marketMaking?.spread?.baseTiers?.tier1}%
                </div>
                <div>
                  <span className="text-muted-foreground">Tier 2:</span>{" "}
                  {config.marketMaking?.spread?.baseTiers?.tier2}%
                </div>
                <div>
                  <span className="text-muted-foreground">Tier 3:</span>{" "}
                  {config.marketMaking?.spread?.baseTiers?.tier3}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Risk Management Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sl-enabled">Stop Loss</Label>
              <Switch
                id="sl-enabled"
                checked={config.risk?.stopLoss?.enable}
                disabled={true} // Disabled for demo
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="tp-enabled">Take Profit</Label>
              <Switch
                id="tp-enabled"
                checked={config.risk?.takeProfit?.enable}
                disabled={true} // Disabled for demo
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="cb-enabled">Circuit Breakers</Label>
              <Switch
                id="cb-enabled"
                checked={config.risk?.circuitBreakers?.enable}
                disabled={true} // Disabled for demo
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Optimization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="opt-enabled">Enabled</Label>
              <Switch
                id="opt-enabled"
                checked={config.optimization?.enable}
                disabled={true} // Disabled for demo
              />
            </div>
            
            <div className="space-y-2">
              <Label>Optimization Interval</Label>
              <div className="text-sm">
                {config.optimization?.optimizationInterval} hours
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="ab-enabled">A/B Testing</Label>
              <Switch
                id="ab-enabled"
                checked={config.optimization?.abTesting?.enable}
                disabled={true} // Disabled for demo
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Render logs tab
  const renderLogs = () => {
    if (!isInitialized) {
      return null
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No logs to display
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <div className={`px-1.5 py-0.5 rounded text-xs ${
                    log.level === "error" ? "bg-red-100 text-red-800" :
                    log.level === "warn" ? "bg-amber-100 text-amber-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>
                    {log.level.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div>{log.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hyperliquid DEX Bot</h1>
            <p className="text-muted-foreground">
              Autonomous market-making bot for Hyperliquid DEX
            </p>
          </div>
          
          {isInitialized && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshBotStatus}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            {renderWalletSection()}
          </div>
          
          <div className="md:col-span-2">
            {isInitialized && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="dashboard">
                    <Activity className="mr-2 h-4 w-4" />
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="performance">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Performance
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Cog className="mr-2 h-4 w-4" />
                    Settings
                  </TabsTrigger>
                  <TabsTrigger value="logs">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Logs
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard">
                  {renderDashboard()}
                </TabsContent>
                <TabsContent value="performance">
                  {renderPerformance()}
                </TabsContent>
                <TabsContent value="settings">
                  {renderSettings()}
                </TabsContent>
                <TabsContent value="logs">
                  {renderLogs()}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
import { useWallet } from "@/contexts/WalletContext"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Wallet, LogOut, ChevronDown, ExternalLink } from "lucide-react"

export const WalletConnectButton = () => {
  const { account, connectWallet, disconnectWallet, isConnecting, chainId } = useWallet()
  const [isOpen, setIsOpen] = useState(false)

  // Format address for display (0x1234...5678)
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  // Handle wallet connection
  const handleConnect = async () => {
    await connectWallet()
  }

  // Handle wallet disconnection
  const handleDisconnect = () => {
    disconnectWallet()
    setIsOpen(false)
  }

  // If not connected, show connect button
  if (!account) {
    return (
      <Button 
        onClick={handleConnect} 
        disabled={isConnecting}
        className="flex items-center gap-2"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  // If connected, show wallet info and options
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          <span>{formatAddress(account)}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="flex flex-col">
          <div className="border-b p-4">
            <p className="text-sm font-medium">Connected as</p>
            <p className="text-xs text-muted-foreground break-all mt-1">{account}</p>
          </div>
          <div className="p-4 border-b">
            <p className="text-sm font-medium">Network</p>
            <p className="text-xs text-muted-foreground mt-1">
              {chainId === 1337 ? "Hyperliquid Mainnet" : "Unknown Network"}
            </p>
          </div>
          <div className="p-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              onClick={() => {
                window.open(`https://explorer.hyperliquid.xyz/address/${account}`, "_blank")
                setIsOpen(false)
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Explorer
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm text-destructive hover:text-destructive"
              onClick={handleDisconnect}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
import { useState, useEffect } from "react"
import { Layout } from "@/components/Layout"
import { NFTGrid } from "@/components/NFTGrid"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/router"
import { Wallet, Copy, ExternalLink } from "lucide-react"

export default function ProfilePage() {
  const { account, connectWallet } = useWallet()
  const { toast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("collected")
  
  // Redirect to login if not connected
  useEffect(() => {
    if (!account && typeof window !== "undefined") {
      // We'll show a connect wallet UI instead of redirecting
    }
  }, [account, router])
  
  // Format address for display (0x1234...5678)
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }
  
  // Copy address to clipboard
  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account)
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }
  
  // If not connected, show connect wallet UI
  if (!account) {
    return (
      <Layout title="My Profile">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted rounded-full p-6 mb-6">
            <Wallet className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Connect your wallet to view your profile, NFTs, and manage your collection.
          </p>
          <Button onClick={connectWallet}>Connect Wallet</Button>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="My Profile">
      <div className="space-y-8">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="bg-muted rounded-full p-6">
            <Wallet className="h-12 w-12 text-muted-foreground" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-2xl font-bold">My Wallet</h2>
              <div className="flex items-center justify-center md:justify-start gap-1">
                <span className="text-muted-foreground">{formatAddress(account)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={copyAddress}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(`https://explorer.hyperliquid.xyz/address/${account}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
              <Button onClick={() => router.push("/create")}>Create NFT</Button>
              <Button variant="outline" onClick={() => router.push("/settings")}>
                Edit Profile
              </Button>
            </div>
          </div>
        </div>
        
        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="collected">Collected</TabsTrigger>
            <TabsTrigger value="created">Created</TabsTrigger>
            <TabsTrigger value="listed">Listed</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="collected" className="mt-6">
            <NFTGrid
              ownerAddress={account}
              filterOptions={{}}
            />
          </TabsContent>
          
          <TabsContent value="created" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium">No Created NFTs</h3>
              <p className="text-muted-foreground mt-2 mb-6">
                You haven't created any NFTs yet.
              </p>
              <Button onClick={() => router.push("/create")}>Create NFT</Button>
            </div>
          </TabsContent>
          
          <TabsContent value="listed" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium">No Listed NFTs</h3>
              <p className="text-muted-foreground mt-2">
                You don't have any NFTs listed for sale.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="activity" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium">No Recent Activity</h3>
              <p className="text-muted-foreground mt-2">
                Your recent activity will appear here.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
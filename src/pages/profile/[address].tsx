import { useState } from "react"
import { GetServerSideProps } from "next"
import { Layout } from "@/components/Layout"
import { NFTGrid } from "@/components/NFTGrid"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nftService } from "@/services/nftService"
import { NFT } from "@/types/nft"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/router"
import { User, Copy, ExternalLink } from "lucide-react"

interface ProfilePageProps {
  address: string
  nfts: NFT[]
}

export default function UserProfilePage({ address, nfts }: ProfilePageProps) {
  const { account } = useWallet()
  const { toast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("collected")
  
  // Check if this is the current user's profile
  const isOwnProfile = account && account.toLowerCase() === address.toLowerCase()
  
  // Format address for display (0x1234...5678)
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }
  
  // Copy address to clipboard
  const copyAddress = () => {
    navigator.clipboard.writeText(address)
    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
    })
  }
  
  return (
    <Layout title={isOwnProfile ? "My Profile" : "User Profile"}>
      <div className="space-y-8">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="bg-muted rounded-full p-6">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-2xl font-bold">
                {isOwnProfile ? "My Wallet" : "User Wallet"}
              </h2>
              <div className="flex items-center justify-center md:justify-start gap-1">
                <span className="text-muted-foreground">{formatAddress(address)}</span>
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
                  onClick={() => window.open(`https://explorer.hyperliquid.xyz/address/${address}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {isOwnProfile && (
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                <Button onClick={() => router.push("/create")}>Create NFT</Button>
                <Button variant="outline" onClick={() => router.push("/settings")}>
                  Edit Profile
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="collected">Collected</TabsTrigger>
            <TabsTrigger value="created">Created</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="collected" className="mt-6">
            <NFTGrid
              initialNFTs={nfts}
              ownerAddress={address}
              filterOptions={{}}
            />
          </TabsContent>
          
          <TabsContent value="created" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium">No Created NFTs</h3>
              <p className="text-muted-foreground mt-2">
                This user hasn't created any NFTs yet.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="activity" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium">No Recent Activity</h3>
              <p className="text-muted-foreground mt-2">
                This user's recent activity will appear here.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { address } = context.params as { address: string }
  
  try {
    // Validate address format
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        notFound: true
      }
    }
    
    // Fetch user's NFTs
    const nftsResponse = await nftService.getNFTsByOwner(address, 1, 12)
    
    return {
      props: {
        address,
        nfts: nftsResponse.nfts
      }
    }
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return {
      notFound: true
    }
  }
}
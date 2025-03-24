import { useState } from "react"
import { GetServerSideProps } from "next"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { nftService } from "@/services/nftService"
import { NFT } from "@/types/nft"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/router"
import Image from "next/image"
import Link from "next/link"
import { 
  Tag, 
  Clock, 
  Share2, 
  Heart, 
  ShoppingCart, 
  ExternalLink, 
  ArrowLeft,
  Loader2,
  History
} from "lucide-react"

interface NFTDetailPageProps {
  nft: NFT
}

export default function NFTDetailPage({ nft }: NFTDetailPageProps) {
  const router = useRouter()
  const { account, signer } = useWallet()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  
  // Check if the current user is the owner
  const isOwner = account && account.toLowerCase() === nft.owner.toLowerCase()
  
  // Format address for display (0x1234...5678)
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }
  
  // Handle NFT purchase
  const handleBuy = async () => {
    if (!account || !signer) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to purchase this NFT",
        variant: "destructive",
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      const result = await nftService.buyNFT(nft.id, signer)
      
      if (result.success) {
        toast({
          title: "Purchase successful",
          description: `You have successfully purchased ${nft.name}`,
        })
        
        // Refresh the page to update the NFT data
        router.reload()
      } else {
        toast({
          title: "Purchase failed",
          description: result.message || "Failed to purchase NFT",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Purchase failed",
        description: "An error occurred while purchasing the NFT",
        variant: "destructive",
      })
      console.error("Buy NFT error:", error)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <Layout>
      <div className="mb-6">
        <Button
          variant="ghost"
          className="flex items-center gap-1"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* NFT Image */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-xl overflow-hidden border">
            <Image
              src={nft.image.startsWith("http") ? nft.image : `/api/placeholder?type=nft`}
              alt={nft.name}
              fill
              className="object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = "/api/placeholder?type=nft"
              }}
            />
          </div>
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                toast({
                  title: "Link copied",
                  description: "NFT link copied to clipboard",
                })
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            
            <Button variant="outline" size="sm">
              <Heart className="h-4 w-4 mr-2" />
              Favorite
            </Button>
          </div>
        </div>
        
        {/* NFT Details */}
        <div className="space-y-6">
          <div>
            <Link
              href={`/collection/${nft.collection.id}`}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              {nft.collection.name}
            </Link>
            <h1 className="text-3xl font-bold mt-1">{nft.name}</h1>
            
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">Owned by</span>
                <Link
                  href={`/profile/${nft.owner}`}
                  className="font-medium hover:text-primary"
                >
                  {formatAddress(nft.owner)}
                </Link>
              </div>
            </div>
          </div>
          
          {/* Price and Buy section */}
          {nft.isListed ? (
            <div className="bg-card rounded-lg p-4 border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-muted-foreground">Current price</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Tag className="h-5 w-5" />
                    <p className="text-2xl font-bold">{nft.price} HYPE</p>
                  </div>
                </div>
                
                {!isOwner && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        disabled={isLoading}
                        className="flex items-center gap-2"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Buy Now
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Purchase</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Item:</span>
                          <span>{nft.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Price:</span>
                          <span>{nft.price} HYPE</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Marketplace Fee (2.5%):</span>
                          <span>{(parseFloat(nft.price) * 0.025).toFixed(4)} HYPE</span>
                        </div>
                        <div className="flex justify-between items-center font-bold">
                          <span>Total:</span>
                          <span>{(parseFloat(nft.price) * 1.025).toFixed(4)} HYPE</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          <p>Marketplace fees go to: 0xE68c93e73D6841a0640E8ACc528494287366f084</p>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                          <DialogTrigger asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogTrigger>
                          <Button
                            onClick={handleBuy}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              "Approve Transaction"
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg p-4 border">
              <p className="text-center text-muted-foreground">This NFT is not currently for sale</p>
            </div>
          )}
          
          {/* Tabs for details, properties, etc. */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium">Description</h3>
                <p className="text-muted-foreground mt-1">{nft.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium">Creator</h3>
                  <Link
                    href={`/profile/${nft.creator}`}
                    className="text-sm text-muted-foreground hover:text-primary mt-1 flex items-center"
                  >
                    {formatAddress(nft.creator)}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </div>
                
                <div>
                  <h3 className="font-medium">Token ID</h3>
                  <p className="text-sm text-muted-foreground mt-1">{nft.tokenId}</p>
                </div>
                
                <div>
                  <h3 className="font-medium">Blockchain</h3>
                  <p className="text-sm text-muted-foreground mt-1">Hyperliquid</p>
                </div>
                
                <div>
                  <h3 className="font-medium">Created</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(nft.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="properties" className="mt-4">
              {nft.attributes && nft.attributes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {nft.attributes.map((attr, index) => (
                    <div key={index} className="bg-secondary rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">{attr.trait_type}</p>
                      <p className="font-medium truncate mt-1">{attr.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No properties found for this NFT</p>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border-b">
                  <div className="bg-secondary rounded-full p-2">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Minted</p>
                    <div className="flex flex-wrap gap-1 text-sm text-muted-foreground">
                      <span>by</span>
                      <Link href={`/profile/${nft.creator}`} className="hover:text-primary">
                        {formatAddress(nft.creator)}
                      </Link>
                      <span>on {new Date(nft.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                {/* More history items would go here in a real implementation */}
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Owner actions */}
          {isOwner && (
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-3">Owner Actions</h3>
              <div className="flex flex-wrap gap-3">
                {nft.isListed ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Cancel Listing</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Listing</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p>Are you sure you want to cancel the listing for this NFT?</p>
                        <div className="flex justify-end gap-3">
                          <Button variant="outline">Cancel</Button>
                          <Button variant="destructive">Confirm</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button onClick={() => router.push(`/nft/${nft.id}/sell`)}>
                    List for Sale
                  </Button>
                )}
                
                <Button variant="outline" onClick={() => router.push(`/nft/${nft.id}/transfer`)}>
                  Transfer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string }
  
  try {
    // Fetch NFT data
    const nft = await nftService.getNFTById(id)
    
    if (!nft) {
      return {
        notFound: true
      }
    }
    
    return {
      props: {
        nft
      }
    }
  } catch (error) {
    console.error("Error fetching NFT:", error)
    return {
      notFound: true
    }
  }
}
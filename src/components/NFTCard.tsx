import { NFT } from "@/types/nft"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/contexts/WalletContext"
import { nftService } from "@/services/nftService"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/router"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { Tag, Heart, ShoppingCart } from "lucide-react"

interface NFTCardProps {
  nft: NFT
  onRefresh?: () => void
}

export const NFTCard = ({ nft, onRefresh }: NFTCardProps) => {
  const { account, signer } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Handle NFT purchase
  const handleBuy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
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
        
        if (onRefresh) {
          onRefresh()
        }
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

  // Navigate to NFT detail page
  const handleClick = () => {
    router.push(`/nft/${nft.id}`)
  }

  // Check if the current user is the owner
  const isOwner = account && account.toLowerCase() === nft.owner.toLowerCase()

  return (
    <Card 
      className="overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={handleClick}
    >
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={nft.image.startsWith("http") ? nft.image : `/api/placeholder?type=nft`}
          alt={nft.name}
          fill
          className="object-cover transition-transform hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/api/placeholder?type=nft"
          }}
        />
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{nft.collection.name}</p>
            <h3 className="font-medium truncate">{nft.name}</h3>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Heart className="h-4 w-4" />
            <span className="text-xs">{Math.floor(Math.random() * 100)}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        {nft.isListed ? (
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-medium flex items-center">
              <Tag className="h-3 w-3 mr-1" />
              {nft.price} HYPE
            </p>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Not for sale</div>
        )}
        
        {nft.isListed && !isOwner ? (
          <Button 
            size="sm" 
            onClick={handleBuy}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <ShoppingCart className="h-4 w-4" />
            {isLoading ? "Processing..." : "Buy Now"}
          </Button>
        ) : isOwner ? (
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/nft/${nft.id}/edit`)
            }}
          >
            Manage
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}

// Skeleton loader for NFT cards
export const NFTCardSkeleton = () => {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square overflow-hidden">
        <Skeleton className="h-full w-full" />
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-8" />
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-20" />
      </CardFooter>
    </Card>
  )
}
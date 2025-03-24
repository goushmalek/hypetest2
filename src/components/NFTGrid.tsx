import { NFT, NFTFilterOptions } from "@/types/nft"
import { NFTCard, NFTCardSkeleton } from "@/components/NFTCard"
import { useEffect, useState } from "react"
import { nftService } from "@/services/nftService"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface NFTGridProps {
  initialNFTs?: NFT[]
  filterOptions?: NFTFilterOptions
  collectionId?: string
  ownerAddress?: string
  showLoadMore?: boolean
  columns?: number
}

export const NFTGrid = ({
  initialNFTs,
  filterOptions = {},
  collectionId,
  ownerAddress,
  showLoadMore = true,
  columns = 4
}: NFTGridProps) => {
  const [nfts, setNfts] = useState<NFT[]>(initialNFTs || [])
  const [isLoading, setIsLoading] = useState(!initialNFTs)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const { toast } = useToast()
  
  const limit = 12
  
  // Fetch NFTs based on props
  const fetchNFTs = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      
      let response
      
      if (collectionId) {
        // Fetch NFTs by collection
        response = await nftService.getNFTsByCollection(collectionId, pageNum, limit)
      } else if (ownerAddress) {
        // Fetch NFTs by owner
        response = await nftService.getNFTsByOwner(ownerAddress, pageNum, limit)
      } else {
        // Fetch NFTs with filters
        response = await nftService.getNFTs({
          ...filterOptions,
          page: pageNum,
          limit
        })
      }
      
      if (append) {
        setNfts(prev => [...prev, ...response.nfts])
      } else {
        setNfts(response.nfts)
      }
      
      setHasMore(response.nfts.length === limit && response.total > pageNum * limit)
    } catch (error) {
      console.error("Error fetching NFTs:", error)
      toast({
        title: "Error",
        description: "Failed to load NFTs. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }
  
  // Load more NFTs
  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchNFTs(nextPage, true)
  }
  
  // Refresh NFTs
  const handleRefresh = () => {
    setPage(1)
    fetchNFTs(1, false)
  }
  
  // Fetch NFTs on mount and when filter options change
  useEffect(() => {
    setPage(1)
    fetchNFTs(1, false)
  }, [filterOptions, collectionId, ownerAddress])
  
  // Determine grid columns class based on props
  const getGridClass = () => {
    switch (columns) {
      case 1:
        return "grid-cols-1"
      case 2:
        return "grid-cols-1 sm:grid-cols-2"
      case 3:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      case 5:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      case 6:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      case 4:
      default:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    }
  }
  
  // Show skeleton loaders while loading
  if (isLoading) {
    return (
      <div className={`grid ${getGridClass()} gap-4`}>
        {Array(8).fill(0).map((_, index) => (
          <NFTCardSkeleton key={index} />
        ))}
      </div>
    )
  }
  
  // Show message if no NFTs found
  if (nfts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-medium">No NFTs Found</h3>
        <p className="text-muted-foreground mt-2">
          {collectionId ? "This collection doesn't have any NFTs yet." :
           ownerAddress ? "This wallet doesn't own any NFTs yet." :
           "No NFTs match your search criteria."}
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className={`grid ${getGridClass()} gap-4`}>
        {nfts.map(nft => (
          <NFTCard key={nft.id} nft={nft} onRefresh={handleRefresh} />
        ))}
      </div>
      
      {showLoadMore && hasMore && (
        <div className="flex justify-center mt-8">
          <Button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            className="min-w-[150px]"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
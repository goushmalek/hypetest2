import { useState } from "react"
import { GetServerSideProps } from "next"
import { Layout } from "@/components/Layout"
import { NFTGrid } from "@/components/NFTGrid"
import { NFTFilters } from "@/components/NFTFilters"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nftService } from "@/services/nftService"
import { Collection, NFT, NFTFilterOptions } from "@/types/nft"
import { useRouter } from "next/router"
import Image from "next/image"
import { Share2, Users, Tag, BarChart3, Clock } from "lucide-react"

interface CollectionDetailPageProps {
  collection: Collection
  nfts: NFT[]
}

export default function CollectionDetailPage({ collection, nfts }: CollectionDetailPageProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<NFTFilterOptions>({})
  const [activeTab, setActiveTab] = useState("items")
  
  // Handle filter changes
  const handleFilterChange = (newFilters: NFTFilterOptions) => {
    setFilters(newFilters)
  }
  
  // Format large numbers with commas
  const formatNumber = (num: number | string | undefined) => {
    if (!num) return "0"
    return Number(num).toLocaleString()
  }
  
  return (
    <Layout>
      {/* Banner */}
      <div className="relative h-48 md:h-64 w-full overflow-hidden -mx-4 px-4">
        <div className="absolute inset-0">
          <Image
            src={collection.banner || "/api/placeholder?type=collection&width=1200&height=300"}
            alt={`${collection.name} banner`}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/api/placeholder?type=collection&width=1200&height=300"
            }}
          />
        </div>
      </div>
      
      {/* Collection info */}
      <div className="relative -mt-16 mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Collection image */}
          <div className="h-32 w-32 rounded-xl overflow-hidden border-4 border-background shadow-md">
            <Image
              src={collection.image || "/api/placeholder?type=collection&width=128&height=128"}
              alt={collection.name}
              width={128}
              height={128}
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = "/api/placeholder?type=collection&width=128&height=128"
              }}
            />
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{collection.name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Users className="h-4 w-4" />
                  <span>{formatNumber(collection.itemCount)} items</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
            
            <p className="text-muted-foreground">{collection.description}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-sm">Floor Price</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Tag className="h-4 w-4" />
                  <p className="font-medium">{collection.floorPrice || "0"} HYPE</p>
                </div>
              </div>
              
              <div className="bg-card rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-sm">Volume</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <BarChart3 className="h-4 w-4" />
                  <p className="font-medium">{collection.totalVolume || "0"} HYPE</p>
                </div>
              </div>
              
              <div className="bg-card rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-sm">Items</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Users className="h-4 w-4" />
                  <p className="font-medium">{formatNumber(collection.itemCount)}</p>
                </div>
              </div>
              
              <div className="bg-card rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-sm">Created</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Clock className="h-4 w-4" />
                  <p className="font-medium">
                    {new Date(collection.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs and content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="items" className="mt-6">
          <div className="space-y-6">
            <NFTFilters
              onFilterChange={handleFilterChange}
              initialFilters={filters}
            />
            
            <NFTGrid
              initialNFTs={nfts}
              collectionId={collection.id}
              filterOptions={filters}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="activity" className="mt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-medium">Activity Coming Soon</h3>
            <p className="text-muted-foreground mt-2">
              We're working on adding activity tracking for this collection.
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="analytics" className="mt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-medium">Analytics Coming Soon</h3>
            <p className="text-muted-foreground mt-2">
              We're working on adding detailed analytics for this collection.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string }
  
  try {
    // Fetch collection data
    const collection = await nftService.getCollectionById(id)
    
    if (!collection) {
      return {
        notFound: true
      }
    }
    
    // Fetch collection NFTs
    const nftsResponse = await nftService.getNFTsByCollection(id, 1, 12)
    
    return {
      props: {
        collection,
        nfts: nftsResponse.nfts
      }
    }
  } catch (error) {
    console.error("Error fetching collection:", error)
    return {
      notFound: true
    }
  }
}
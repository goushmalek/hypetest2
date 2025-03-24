import { Layout } from "@/components/Layout"
import { NFTGrid } from "@/components/NFTGrid"
import { CollectionCard, CollectionCardSkeleton } from "@/components/CollectionCard"
import { Button } from "@/components/ui/button"
import { nftService } from "@/services/nftService"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Home() {
  const router = useRouter()
  
  // Fetch featured NFTs
  const { data: featuredNFTs, isLoading: isLoadingNFTs } = useQuery({
    queryKey: ["featuredNFTs"],
    queryFn: async () => {
      const response = await nftService.getNFTs({
        sortBy: "recently_listed",
        limit: 8
      })
      return response.nfts
    }
  })
  
  // Fetch featured collections
  const { data: featuredCollections, isLoading: isLoadingCollections } = useQuery({
    queryKey: ["featuredCollections"],
    queryFn: async () => {
      const response = await nftService.getCollections(1, 4)
      return response.collections
    }
  })
  
  return (
    <Layout showSearch>
      {/* Hero section */}
      <section className="py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Discover, collect, and sell NFTs on Hyperliquid
            </h1>
            <p className="text-xl text-muted-foreground">
              HyperNFT is the premier marketplace for NFTs on the Hyperliquid blockchain.
              Buy, sell, and discover exclusive digital assets.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => router.push("/explore")}>
                Explore
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/create")}>
                Create
              </Button>
            </div>
          </div>
          
          <div className="relative aspect-square rounded-xl overflow-hidden border shadow-xl">
            {featuredNFTs && featuredNFTs.length > 0 ? (
              <div className="grid grid-cols-2 grid-rows-2 h-full">
                {featuredNFTs.slice(0, 4).map((nft, index) => (
                  <div key={nft.id} className="relative overflow-hidden">
                    <img
                      src={nft.image.startsWith("http") ? nft.image : `/api/placeholder?type=nft`}
                      alt={nft.name}
                      className="object-cover w-full h-full transition-transform hover:scale-110"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/api/placeholder?type=nft"
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted w-full h-full flex items-center justify-center">
                <p className="text-muted-foreground">Loading featured NFTs...</p>
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Featured collections section */}
      <section className="py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Featured Collections</h2>
          <Link href="/collections" className="flex items-center text-sm font-medium">
            View all collections
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoadingCollections
            ? Array(4).fill(0).map((_, index) => <CollectionCardSkeleton key={index} />)
            : featuredCollections?.map(collection => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
        </div>
      </section>
      
      {/* Recently listed NFTs section */}
      <section className="py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Recently Listed</h2>
          <Link href="/explore" className="flex items-center text-sm font-medium">
            Explore more
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        
        <NFTGrid
          initialNFTs={featuredNFTs}
          filterOptions={{ sortBy: "recently_listed" }}
          showLoadMore={false}
        />
      </section>
      
      {/* CTA section */}
      <section className="py-12 md:py-20">
        <div className="bg-secondary rounded-xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Create and sell your NFTs</h2>
            <p className="text-lg text-muted-foreground">
              Join the community of creators on Hyperliquid. Mint your digital assets, 
              list them for sale, and earn from your creativity.
            </p>
            <Button size="lg" onClick={() => router.push("/create")}>
              Start Creating
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  )
}

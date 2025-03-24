import { useState, useEffect } from "react"
import { Layout } from "@/components/Layout"
import { CollectionCard, CollectionCardSkeleton } from "@/components/CollectionCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { nftService } from "@/services/nftService"
import { Collection } from "@/types/nft"
import { Search, Loader2, Plus } from "lucide-react"
import { useRouter } from "next/router"

export default function CollectionsPage() {
  const router = useRouter()
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("volume")
  
  const limit = 12
  
  // Fetch collections
  const fetchCollections = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      
      const response = await nftService.getCollections(pageNum, limit)
      
      // Filter by search query if provided
      let filteredCollections = response.collections
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase()
        filteredCollections = filteredCollections.filter(
          collection => collection.name.toLowerCase().includes(query) || 
                        collection.description.toLowerCase().includes(query)
        )
      }
      
      // Sort collections
      filteredCollections.sort((a, b) => {
        switch (sortBy) {
          case "volume":
            return parseFloat(b.totalVolume || "0") - parseFloat(a.totalVolume || "0")
          case "floor":
            return parseFloat(b.floorPrice || "0") - parseFloat(a.floorPrice || "0")
          case "items":
            return (b.itemCount || 0) - (a.itemCount || 0)
          case "recent":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          default:
            return 0
        }
      })
      
      if (append) {
        setCollections(prev => [...prev, ...filteredCollections])
      } else {
        setCollections(filteredCollections)
      }
      
      setHasMore(filteredCollections.length === limit)
    } catch (error) {
      console.error("Error fetching collections:", error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }
  
  // Load more collections
  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchCollections(nextPage, true)
  }
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Fetch collections when search query or sort changes
  useEffect(() => {
    setPage(1)
    fetchCollections(1, false)
  }, [debouncedSearchQuery, sortBy])
  
  return (
    <Layout title="Collections" showSearch>
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 sticky top-16 pt-4 pb-2 bg-background z-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search collections"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="floor">Floor Price</SelectItem>
                <SelectItem value="items">Items</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={() => router.push("/collections/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Collection
            </Button>
          </div>
        </div>
        
        {/* Collections grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, index) => (
              <CollectionCardSkeleton key={index} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-medium">No Collections Found</h3>
            <p className="text-muted-foreground mt-2">
              {debouncedSearchQuery
                ? `No collections match "${debouncedSearchQuery}"`
                : "There are no collections available at the moment."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {collections.map(collection => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
            
            {hasMore && (
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
        )}
      </div>
    </Layout>
  )
}
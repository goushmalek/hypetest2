import { useState, useEffect } from "react"
import { Layout } from "@/components/Layout"
import { NFTGrid } from "@/components/NFTGrid"
import { NFTFilters } from "@/components/NFTFilters"
import { Input } from "@/components/ui/input"
import { NFTFilterOptions } from "@/types/nft"
import { useRouter } from "next/router"
import { Search as SearchIcon } from "lucide-react"

export default function SearchPage() {
  const router = useRouter()
  const { q } = router.query
  const [searchQuery, setSearchQuery] = useState<string>((q as string) || "")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(searchQuery)
  const [filters, setFilters] = useState<NFTFilterOptions>({})
  
  // Update search query when URL query changes
  useEffect(() => {
    if (q) {
      setSearchQuery(q as string)
      setDebouncedSearchQuery(q as string)
    }
  }, [q])
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      
      // Update URL query parameter
      if (searchQuery) {
        router.push({
          pathname: "/search",
          query: { q: searchQuery },
        }, undefined, { shallow: true })
      } else {
        router.push("/search", undefined, { shallow: true })
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [searchQuery, router])
  
  // Update filters when search query changes
  useEffect(() => {
    if (debouncedSearchQuery) {
      setFilters(prev => ({
        ...prev,
        searchQuery: debouncedSearchQuery
      }))
    } else {
      setFilters(prev => {
        const newFilters = { ...prev }
        delete newFilters.searchQuery
        return newFilters
      })
    }
  }, [debouncedSearchQuery])
  
  // Handle filter changes
  const handleFilterChange = (newFilters: NFTFilterOptions) => {
    // Preserve search query
    if (debouncedSearchQuery) {
      newFilters.searchQuery = debouncedSearchQuery
    }
    
    setFilters(newFilters)
  }
  
  return (
    <Layout title="Search NFTs" showSearch={false}>
      <div className="space-y-6">
        {/* Search bar */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search NFTs, collections, or creators"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
        
        {/* Filters */}
        <NFTFilters
          onFilterChange={handleFilterChange}
          initialFilters={filters}
          className="sticky top-16 pt-4 pb-2 bg-background z-10"
        />
        
        {/* Results */}
        <div>
          {debouncedSearchQuery ? (
            <h2 className="text-xl font-medium mb-6">
              Search results for "{debouncedSearchQuery}"
            </h2>
          ) : (
            <h2 className="text-xl font-medium mb-6">
              Browse all NFTs
            </h2>
          )}
          
          <NFTGrid filterOptions={filters} />
        </div>
      </div>
    </Layout>
  )
}
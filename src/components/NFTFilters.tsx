import { useState, useEffect } from "react"
import { NFTFilterOptions } from "@/types/nft"
import { nftService } from "@/services/nftService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Search, Filter, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface NFTFiltersProps {
  onFilterChange: (filters: NFTFilterOptions) => void
  initialFilters?: NFTFilterOptions
  className?: string
}

export const NFTFilters = ({
  onFilterChange,
  initialFilters = {},
  className
}: NFTFiltersProps) => {
  const [filters, setFilters] = useState<NFTFilterOptions>(initialFilters)
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false)
  const [isPriceOpen, setIsPriceOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery || "")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)
  const [showOnlyListed, setShowOnlyListed] = useState(false)
  
  // Fetch collections for filter
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await nftService.getCollections(1, 100)
        setCollections(response.collections.map(c => ({ id: c.id, name: c.name })))
      } catch (error) {
        console.error("Error fetching collections:", error)
      }
    }
    
    fetchCollections()
  }, [])
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Update filters when inputs change
  useEffect(() => {
    const newFilters: NFTFilterOptions = { ...filters }
    
    if (debouncedSearchQuery) {
      newFilters.searchQuery = debouncedSearchQuery
    } else {
      delete newFilters.searchQuery
    }
    
    onFilterChange(newFilters)
  }, [debouncedSearchQuery, filters])
  
  // Handle collection selection
  const handleCollectionChange = (collectionId: string) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      
      if (!newFilters.collections) {
        newFilters.collections = [collectionId]
      } else if (newFilters.collections.includes(collectionId)) {
        newFilters.collections = newFilters.collections.filter(id => id !== collectionId)
        if (newFilters.collections.length === 0) {
          delete newFilters.collections
        }
      } else {
        newFilters.collections = [...newFilters.collections, collectionId]
      }
      
      return newFilters
    })
  }
  
  // Handle price range change
  const handlePriceChange = (type: "min" | "max", value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      
      if (!newFilters.priceRange) {
        newFilters.priceRange = {}
      }
      
      if (value === "") {
        delete newFilters.priceRange[type]
        if (Object.keys(newFilters.priceRange).length === 0) {
          delete newFilters.priceRange
        }
      } else {
        newFilters.priceRange[type] = value
      }
      
      return newFilters
    })
  }
  
  // Handle sort change
  const handleSortChange = (value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      
      if (value === "default") {
        delete newFilters.sortBy
      } else {
        newFilters.sortBy = value as any
      }
      
      return newFilters
    })
  }
  
  // Handle listed only toggle
  const handleListedOnlyChange = (checked: boolean) => {
    setShowOnlyListed(checked)
    // This would typically be implemented in the backend
    // For now, we'll just log it
    console.log("Show only listed NFTs:", checked)
  }
  
  // Reset all filters
  const handleReset = () => {
    setFilters({})
    setSearchQuery("")
    setShowOnlyListed(false)
  }
  
  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    
    if (filters.collections && filters.collections.length > 0) count++
    if (filters.priceRange) count++
    if (filters.sortBy) count++
    if (showOnlyListed) count++
    
    return count
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search NFTs, collections, or creators"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Filter controls */}
      <div className="flex flex-wrap gap-2">
        {/* Sort dropdown */}
        <Select
          value={filters.sortBy || "default"}
          onValueChange={handleSortChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="recently_listed">Recently Listed</SelectItem>
            <SelectItem value="recently_created">Recently Created</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Collections filter */}
        <Collapsible
          open={isCollectionsOpen}
          onOpenChange={setIsCollectionsOpen}
          className="w-[200px] border rounded-md"
        >
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Collections
                {filters.collections && filters.collections.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground w-5 h-5 text-xs flex items-center justify-center">
                    {filters.collections.length}
                  </span>
                )}
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isCollectionsOpen ? "rotate-180" : "")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-2 space-y-2">
            {collections.map(collection => (
              <div key={collection.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`collection-${collection.id}`}
                  checked={filters.collections?.includes(collection.id) || false}
                  onChange={() => handleCollectionChange(collection.id)}
                  className="rounded"
                />
                <Label htmlFor={`collection-${collection.id}`} className="text-sm cursor-pointer">
                  {collection.name}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
        
        {/* Price range filter */}
        <Collapsible
          open={isPriceOpen}
          onOpenChange={setIsPriceOpen}
          className="w-[200px] border rounded-md"
        >
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Price Range
                {filters.priceRange && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground w-5 h-5 text-xs flex items-center justify-center">
                    1
                  </span>
                )}
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isPriceOpen ? "rotate-180" : "")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="min-price" className="text-xs">Min</Label>
                <Input
                  id="min-price"
                  type="number"
                  placeholder="0"
                  value={filters.priceRange?.min || ""}
                  onChange={e => handlePriceChange("min", e.target.value)}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="max-price" className="text-xs">Max</Label>
                <Input
                  id="max-price"
                  type="number"
                  placeholder="∞"
                  value={filters.priceRange?.max || ""}
                  onChange={e => handlePriceChange("max", e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Listed only toggle */}
        <div className="flex items-center space-x-2 border rounded-md p-2">
          <Switch
            id="listed-only"
            checked={showOnlyListed}
            onCheckedChange={handleListedOnlyChange}
          />
          <Label htmlFor="listed-only" className="text-sm">Listed only</Label>
        </div>
        
        {/* Reset filters */}
        {getActiveFilterCount() > 0 && (
          <Button variant="ghost" onClick={handleReset} className="gap-1">
            <X className="h-4 w-4" />
            Reset filters
          </Button>
        )}
      </div>
    </div>
  )
}
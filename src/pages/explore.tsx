import { useState } from "react"
import { Layout } from "@/components/Layout"
import { NFTGrid } from "@/components/NFTGrid"
import { NFTFilters } from "@/components/NFTFilters"
import { NFTFilterOptions } from "@/types/nft"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ExplorePage() {
  const [filters, setFilters] = useState<NFTFilterOptions>({})
  const [activeTab, setActiveTab] = useState("all")
  
  // Handle filter changes
  const handleFilterChange = (newFilters: NFTFilterOptions) => {
    setFilters(newFilters)
  }
  
  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    
    // Update filters based on tab
    const newFilters: NFTFilterOptions = { ...filters }
    
    // Remove any existing collection filters when changing tabs
    if (newFilters.collections) {
      delete newFilters.collections
    }
    
    // Add collection filter based on tab
    if (value !== "all") {
      newFilters.collections = [value]
    }
    
    setFilters(newFilters)
  }
  
  return (
    <Layout title="Explore NFTs" showSearch>
      <div className="space-y-6">
        {/* Filters */}
        <NFTFilters
          onFilterChange={handleFilterChange}
          initialFilters={filters}
          className="sticky top-16 pt-4 pb-2 bg-background z-10"
        />
        
        {/* Collection tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All NFTs</TabsTrigger>
            <TabsTrigger value="1">Hyperliquid Punks</TabsTrigger>
            <TabsTrigger value="2">Hyperliquid Apes</TabsTrigger>
            <TabsTrigger value="3">Hyperliquid Art</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-6">
            <NFTGrid filterOptions={filters} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
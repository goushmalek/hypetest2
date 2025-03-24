import { ethers } from "ethers"
import { 
  NFT, 
  Collection, 
  NFTFilterOptions, 
  NFTsResponse, 
  CollectionsResponse, 
  TransactionResponse,
  NFTListingInput,
  NFTMintInput
} from "@/types/nft"

// Marketplace fee recipient address
const MARKETPLACE_FEE_RECIPIENT = "0xE68c93e73D6841a0640E8ACc528494287366f084";
const MARKETPLACE_FEE_PERCENTAGE = 2.5; // 2.5% fee

// Add a default collection to get started
const MOCK_COLLECTIONS: Collection[] = [
  {
    id: "default-collection",
    name: "HyperNFT Starter Collection",
    description: "This is a starter collection to showcase how collections work. Create your own collection to get started!",
    image: "/api/placeholder?type=collection&width=200&height=200",
    banner: "/api/placeholder?type=collection&width=1200&height=300",
    owner: "0xE68c93e73D6841a0640E8ACc528494287366f084", // Marketplace owner
    floorPrice: "0.5",
    totalVolume: "10",
    itemCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// Generate mock NFTs
const generateMockNFTs = (count: number): NFT[] => {
  const nfts: NFT[] = []
  
  // If there are no collections, return an empty array
  if (MOCK_COLLECTIONS.length === 0) {
    return nfts
  }
  
  const collections = MOCK_COLLECTIONS
  
  for (let i = 0; i < count; i++) {
    const collectionIndex = i % collections.length
    const collection = collections[collectionIndex]
    
    nfts.push({
      id: `${i + 1}`,
      tokenId: `${i + 1}`,
      name: `${collection.name} #${i + 1}`,
      description: `A unique ${collection.name} NFT on the Hyperliquid blockchain.`,
      image: `/nfts/${collection.id}_${i % 10}.png`,
      collection,
      owner: "0x1234567890123456789012345678901234567890",
      creator: "0x1234567890123456789012345678901234567890",
      price: (Math.random() * 2 + 0.1).toFixed(2),
      currency: "HYPE",
      isListed: Math.random() > 0.3,
      attributes: [
        { trait_type: "Background", value: ["Blue", "Red", "Green", "Yellow", "Purple"][Math.floor(Math.random() * 5)] },
        { trait_type: "Eyes", value: ["Big", "Small", "Round", "Sleepy", "Angry"][Math.floor(Math.random() * 5)] },
        { trait_type: "Mouth", value: ["Smile", "Frown", "Open", "Closed", "Surprised"][Math.floor(Math.random() * 5)] },
        { trait_type: "Rarity", value: Math.floor(Math.random() * 100) }
      ],
      createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 1000000000).toISOString()
    })
  }
  
  return nfts
}

const MOCK_NFTS = generateMockNFTs(100)

// In a real implementation, these functions would interact with the Hyperliquid blockchain
export const nftService = {
  // Get NFTs with filtering options
  getNFTs: async (options: NFTFilterOptions = {}): Promise<NFTsResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    let filteredNFTs = [...MOCK_NFTS]
    
    // Apply collection filter
    if (options.collections && options.collections.length > 0) {
      filteredNFTs = filteredNFTs.filter(nft => 
        options.collections?.includes(nft.collection.id)
      )
    }
    
    // Apply price range filter
    if (options.priceRange) {
      if (options.priceRange.min) {
        filteredNFTs = filteredNFTs.filter(nft => 
          nft.price && parseFloat(nft.price) >= parseFloat(options.priceRange?.min || "0")
        )
      }
      if (options.priceRange.max) {
        filteredNFTs = filteredNFTs.filter(nft => 
          nft.price && parseFloat(nft.price) <= parseFloat(options.priceRange?.max || "999999")
        )
      }
    }
    
    // Apply attributes filter
    if (options.attributes && Object.keys(options.attributes).length > 0) {
      filteredNFTs = filteredNFTs.filter(nft => {
        if (!nft.attributes) return false
        
        return Object.entries(options.attributes || {}).every(([traitType, values]) => {
          const attribute = nft.attributes?.find(attr => attr.trait_type === traitType)
          return attribute && values.includes(String(attribute.value))
        })
      })
    }
    
    // Apply search query
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase()
      filteredNFTs = filteredNFTs.filter(nft => 
        nft.name.toLowerCase().includes(query) || 
        nft.description.toLowerCase().includes(query) ||
        nft.collection.name.toLowerCase().includes(query)
      )
    }
    
    // Apply sorting
    if (options.sortBy) {
      switch (options.sortBy) {
        case "price_asc":
          filteredNFTs.sort((a, b) => 
            parseFloat(a.price || "0") - parseFloat(b.price || "0")
          )
          break
        case "price_desc":
          filteredNFTs.sort((a, b) => 
            parseFloat(b.price || "0") - parseFloat(a.price || "0")
          )
          break
        case "recently_listed":
          filteredNFTs.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          break
        case "recently_created":
          filteredNFTs.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          break
      }
    }
    
    // Apply pagination
    const page = options.page || 1
    const limit = options.limit || 20
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedNFTs = filteredNFTs.slice(start, end)
    
    return {
      nfts: paginatedNFTs,
      total: filteredNFTs.length,
      page,
      limit
    }
  },
  
  // Get a single NFT by ID
  getNFTById: async (id: string): Promise<NFT | null> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const nft = MOCK_NFTS.find(nft => nft.id === id)
    return nft || null
  },
  
  // Get collections with pagination
  getCollections: async (page = 1, limit = 20): Promise<CollectionsResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedCollections = MOCK_COLLECTIONS.slice(start, end)
    
    return {
      collections: paginatedCollections,
      total: MOCK_COLLECTIONS.length,
      page,
      limit
    }
  },
  
  // Get a single collection by ID
  getCollectionById: async (id: string): Promise<Collection | null> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const collection = MOCK_COLLECTIONS.find(collection => collection.id === id)
    return collection || null
  },
  
  // Get NFTs by collection ID
  getNFTsByCollection: async (collectionId: string, page = 1, limit = 20): Promise<NFTsResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400))
    
    const filteredNFTs = MOCK_NFTS.filter(nft => nft.collection.id === collectionId)
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedNFTs = filteredNFTs.slice(start, end)
    
    return {
      nfts: paginatedNFTs,
      total: filteredNFTs.length,
      page,
      limit
    }
  },
  
  // Get NFTs owned by a specific address
  getNFTsByOwner: async (ownerAddress: string, page = 1, limit = 20): Promise<NFTsResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400))
    
    const filteredNFTs = MOCK_NFTS.filter(nft => nft.owner.toLowerCase() === ownerAddress.toLowerCase())
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedNFTs = filteredNFTs.slice(start, end)
    
    return {
      nfts: paginatedNFTs,
      total: filteredNFTs.length,
      page,
      limit
    }
  },
  
  // List an NFT for sale
  listNFT: async (listingInput: NFTListingInput, signer: ethers.Signer): Promise<TransactionResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In a real implementation, this would create a transaction on the blockchain
    return {
      hash: `0x${Math.random().toString(16).substring(2)}`,
      success: true
    }
  },
  
  // Buy an NFT
  buyNFT: async (nftId: string, signer: ethers.Signer): Promise<TransactionResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In a real implementation, this would create a transaction on the blockchain
    return {
      hash: `0x${Math.random().toString(16).substring(2)}`,
      success: true
    }
  },
  
  // Cancel an NFT listing
  cancelListing: async (nftId: string, signer: ethers.Signer): Promise<TransactionResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // In a real implementation, this would create a transaction on the blockchain
    return {
      hash: `0x${Math.random().toString(16).substring(2)}`,
      success: true
    }
  },
  
  // Mint a new NFT
  mintNFT: async (mintInput: NFTMintInput, signer: ethers.Signer): Promise<TransactionResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // In a real implementation, this would create a transaction on the blockchain
    return {
      hash: `0x${Math.random().toString(16).substring(2)}`,
      success: true
    }
  },
  
  // Create a new collection
  createCollection: async (collectionInput: {
    name: string;
    description: string;
    image: File;
    banner?: File;
  }, signer: ethers.Signer): Promise<{collection: Collection; success: boolean}> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200))
    
    // Generate a unique ID
    const id = `${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;
    
    // Get the owner address from the signer
    const address = await signer.getAddress();
    
    // Create a new collection
    const newCollection: Collection = {
      id,
      name: collectionInput.name,
      description: collectionInput.description,
      image: `/api/placeholder?type=collection&width=200&height=200`,
      banner: collectionInput.banner ? `/api/placeholder?type=collection&width=1200&height=300` : undefined,
      owner: address,
      floorPrice: "0",
      totalVolume: "0",
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add the collection to the mock collections
    MOCK_COLLECTIONS.push(newCollection);
    
    // In a real implementation, this would create a transaction on the blockchain
    return {
      collection: newCollection,
      success: true
    }
  }
}
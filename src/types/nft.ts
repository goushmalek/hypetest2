export interface NFT {
  id: string
  tokenId: string
  name: string
  description: string
  image: string
  collection: Collection
  owner: string
  creator: string
  price?: string
  currency?: string
  isListed: boolean
  attributes?: Attribute[]
  createdAt: string
  updatedAt: string
}

export interface Collection {
  id: string
  name: string
  description: string
  image: string
  banner?: string
  owner: string
  floorPrice?: string
  totalVolume?: string
  itemCount?: number
  createdAt: string
  updatedAt: string
}

export interface Attribute {
  trait_type: string
  value: string | number
}

export interface NFTListingInput {
  tokenId: string
  price: string
  currency: string
}

export interface NFTMintInput {
  name: string
  description: string
  image: File
  collection: string
  attributes?: Attribute[]
}

export interface NFTFilterOptions {
  collections?: string[]
  priceRange?: {
    min?: string
    max?: string
  }
  attributes?: {
    [key: string]: string[]
  }
  sortBy?: "price_asc" | "price_desc" | "recently_listed" | "recently_created"
  searchQuery?: string
  page?: number
  limit?: number
}

export interface NFTsResponse {
  nfts: NFT[]
  total: number
  page: number
  limit: number
}

export interface CollectionsResponse {
  collections: Collection[]
  total: number
  page: number
  limit: number
}

export interface TransactionResponse {
  hash: string
  success: boolean
  message?: string
}
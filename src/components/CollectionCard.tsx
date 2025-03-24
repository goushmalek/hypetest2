import { Collection } from "@/types/nft"
import { Card, CardContent } from "@/components/ui/card"
import { useRouter } from "next/router"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Tag } from "lucide-react"

interface CollectionCardProps {
  collection: Collection
}

export const CollectionCard = ({ collection }: CollectionCardProps) => {
  const router = useRouter()

  // Navigate to collection detail page
  const handleClick = () => {
    router.push(`/collection/${collection.id}`)
  }

  return (
    <Card 
      className="overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={handleClick}
    >
      <div className="relative h-32 overflow-hidden">
        <Image
          src={collection.banner || "/api/placeholder?type=collection&width=800&height=200"}
          alt={`${collection.name} banner`}
          fill
          className="object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/api/placeholder?type=collection&width=800&height=200"
          }}
        />
      </div>
      
      <CardContent className="p-4 pt-12 relative">
        <div className="absolute -top-10 left-4 h-20 w-20 rounded-xl overflow-hidden border-4 border-background">
          <Image
            src={collection.image || "/api/placeholder?type=collection&width=200&height=200"}
            alt={collection.name}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/api/placeholder?type=collection&width=200&height=200"
            }}
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-medium truncate">{collection.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{collection.description}</p>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{collection.itemCount || 0} items</span>
            </div>
            
            {collection.floorPrice && (
              <div className="flex items-center gap-1 text-sm">
                <Tag className="h-4 w-4" />
                <span>Floor: {collection.floorPrice} ETH</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton loader for collection cards
export const CollectionCardSkeleton = () => {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-32 overflow-hidden">
        <Skeleton className="h-full w-full" />
      </div>
      
      <CardContent className="p-4 pt-12 relative">
        <div className="absolute -top-10 left-4 h-20 w-20 rounded-xl overflow-hidden border-4 border-background">
          <Skeleton className="h-full w-full" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
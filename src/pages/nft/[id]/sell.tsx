import { useState } from "react"
import { GetServerSideProps } from "next"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { nftService } from "@/services/nftService"
import { NFT } from "@/types/nft"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/router"
import Image from "next/image"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

// Form validation schema
const formSchema = z.object({
  price: z.string()
    .min(1, "Price is required")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Price must be a positive number"
    ),
  currency: z.string().min(1, "Currency is required"),
})

type FormValues = z.infer<typeof formSchema>

interface SellNFTPageProps {
  nft: NFT
}

export default function SellNFTPage({ nft }: SellNFTPageProps) {
  const { account, signer } = useWallet()
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      price: "",
      currency: "HYPE",
    },
  })
  
  // Check if the current user is the owner
  const isOwner = account && account.toLowerCase() === nft.owner.toLowerCase()
  
  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    if (!account || !signer) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to list this NFT",
        variant: "destructive",
      })
      return
    }
    
    if (!isOwner) {
      toast({
        title: "Not authorized",
        description: "You are not the owner of this NFT",
        variant: "destructive",
      })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const result = await nftService.listNFT(
        {
          tokenId: nft.tokenId,
          price: values.price,
          currency: values.currency,
        },
        signer
      )
      
      if (result.success) {
        toast({
          title: "NFT listed",
          description: `Your NFT has been listed for ${values.price} ${values.currency}`,
        })
        
        // Redirect to the NFT detail page
        router.push(`/nft/${nft.id}`)
      } else {
        toast({
          title: "Listing failed",
          description: result.message || "Failed to list NFT",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Listing failed",
        description: "An error occurred while listing the NFT",
        variant: "destructive",
      })
      console.error("List NFT error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // If wallet is not connected or user is not the owner, show error message
  if (!account || !isOwner) {
    return (
      <Layout title="Sell NFT">
        <div className="mb-6">
          <Button
            variant="ghost"
            className="flex items-center gap-1"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {!account ? "Wallet not connected" : "Not authorized"}
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {!account
              ? "Please connect your wallet to list this NFT for sale."
              : "You are not the owner of this NFT and cannot list it for sale."}
          </p>
          <Button onClick={() => router.push(`/nft/${nft.id}`)}>
            Return to NFT
          </Button>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="Sell NFT">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="flex items-center gap-1"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* NFT Preview */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-xl overflow-hidden border">
              <Image
                src={nft.image.startsWith("http") ? nft.image : `/api/placeholder?type=nft`}
                alt={nft.name}
                fill
                className="object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "/api/placeholder?type=nft"
                }}
              />
            </div>
            
            <div>
              <h2 className="text-xl font-bold">{nft.name}</h2>
              <p className="text-sm text-muted-foreground">{nft.collection.name}</p>
            </div>
          </div>
          
          {/* Listing Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6">List for Sale</h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          min="0"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Set a price for your NFT
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Currency */}
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HYPE">HYPE</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the currency for your listing
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Fees information */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Fees</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Fee</span>
                      <span>2.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creator Royalty</span>
                      <span>5.0%</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      <p>Marketplace fees go to: 0xE68c93e73D6841a0640E8ACc528494287366f084</p>
                    </div>
                  </div>
                </div>
                
                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Listing...
                    </>
                  ) : (
                    "Complete Listing"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string }
  
  try {
    // Fetch NFT data
    const nft = await nftService.getNFTById(id)
    
    if (!nft) {
      return {
        notFound: true
      }
    }
    
    return {
      props: {
        nft
      }
    }
  } catch (error) {
    console.error("Error fetching NFT:", error)
    return {
      notFound: true
    }
  }
}
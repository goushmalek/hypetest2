import { useState } from "react"
import { GetServerSideProps } from "next"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { nftService } from "@/services/nftService"
import { NFT } from "@/types/nft"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/router"
import Image from "next/image"
import { ArrowLeft, Loader2, AlertCircle, Send } from "lucide-react"
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
import { ethers } from "ethers"

// Form validation schema
const formSchema = z.object({
  recipient: z.string()
    .min(1, "Recipient address is required")
    .refine(
      (val) => ethers.utils.isAddress(val),
      "Invalid Ethereum address"
    ),
})

type FormValues = z.infer<typeof formSchema>

interface TransferNFTPageProps {
  nft: NFT
}

export default function TransferNFTPage({ nft }: TransferNFTPageProps) {
  const { account, signer } = useWallet()
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
    },
  })
  
  // Check if the current user is the owner
  const isOwner = account && account.toLowerCase() === nft.owner.toLowerCase()
  
  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    if (!account || !signer) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to transfer this NFT",
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
    
    // Check if recipient is the same as sender
    if (values.recipient.toLowerCase() === account.toLowerCase()) {
      toast({
        title: "Invalid recipient",
        description: "You cannot transfer an NFT to yourself",
        variant: "destructive",
      })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // In a real implementation, we would call a transfer function on the NFT contract
      // For this demo, we'll just simulate the transfer
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast({
        title: "NFT transferred",
        description: `Your NFT has been transferred to ${values.recipient}`,
      })
      
      // Redirect to the profile page
      router.push("/profile")
    } catch (error) {
      toast({
        title: "Transfer failed",
        description: "An error occurred while transferring the NFT",
        variant: "destructive",
      })
      console.error("Transfer NFT error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // If wallet is not connected or user is not the owner, show error message
  if (!account || !isOwner) {
    return (
      <Layout title="Transfer NFT">
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
              ? "Please connect your wallet to transfer this NFT."
              : "You are not the owner of this NFT and cannot transfer it."}
          </p>
          <Button onClick={() => router.push(`/nft/${nft.id}`)}>
            Return to NFT
          </Button>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="Transfer NFT">
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
          
          {/* Transfer Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Transfer NFT</h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Recipient Address */}
                <FormField
                  control={form.control}
                  name="recipient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0x..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the Ethereum address of the recipient
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Warning */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2 text-amber-500">Warning</h3>
                  <p className="text-sm text-muted-foreground">
                    This action is irreversible. Please double-check the recipient address
                    before confirming the transfer.
                  </p>
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
                      Transferring...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Transfer NFT
                    </>
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
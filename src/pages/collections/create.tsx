import { useState } from "react"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { nftService } from "@/services/nftService"
import { useRouter } from "next/router"
import { Upload, Loader2, AlertCircle } from "lucide-react"
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
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(1000, "Description is too long"),
});

type FormValues = z.infer<typeof formSchema>

export default function CreateCollectionPage() {
  const { account, signer } = useWallet()
  const { toast } = useToast()
  const router = useRouter()
  const [collectionImage, setCollectionImage] = useState<File | null>(null)
  const [collectionImagePreview, setCollectionImagePreview] = useState<string | null>(null)
  const [collectionBanner, setCollectionBanner] = useState<File | null>(null)
  const [collectionBannerPreview, setCollectionBannerPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  })
  
  // Handle collection image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      
      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive",
        })
        return
      }
      
      // Check file type
      if (!selectedFile.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        })
        return
      }
      
      setCollectionImage(selectedFile)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setCollectionImagePreview(event.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }
  
  // Handle collection banner selection
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      
      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive",
        })
        return
      }
      
      // Check file type
      if (!selectedFile.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        })
        return
      }
      
      setCollectionBanner(selectedFile)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setCollectionBannerPreview(event.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }
  
  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    if (!account || !signer) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a collection",
        variant: "destructive",
      })
      return
    }
    
    if (!collectionImage) {
      toast({
        title: "Image required",
        description: "Please upload an image for your collection",
        variant: "destructive",
      })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Create collection
      const result = await nftService.createCollection(
        {
          name: values.name,
          description: values.description,
          image: collectionImage,
          banner: collectionBanner || undefined,
        },
        signer
      )
      
      if (result.success) {
        toast({
          title: "Collection created",
          description: "Your collection has been successfully created",
        })
        
        // Redirect to the collection detail page
        router.push(`/collection/${result.collection.id}`)
      } else {
        toast({
          title: "Creation failed",
          description: "Failed to create collection",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Creation failed",
        description: "An error occurred while creating the collection",
        variant: "destructive",
      })
      console.error("Create collection error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // If wallet is not connected, show connect wallet message
  if (!account) {
    return (
      <Layout title="Create Collection">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Wallet not connected</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Please connect your wallet to create a collection.
          </p>
          <Button onClick={() => router.push("/")}>Go to Homepage</Button>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="Create Collection">
      <div className="max-w-3xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Collection Banner */}
            <div className="space-y-2">
              <Label htmlFor="banner">Collection Banner (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {collectionBannerPreview ? (
                  <div className="space-y-4">
                    <div className="relative h-48 w-full rounded-lg overflow-hidden">
                      <img
                        src={collectionBannerPreview}
                        alt="Collection banner preview"
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCollectionBanner(null)
                        setCollectionBannerPreview(null)
                      }}
                    >
                      Remove Banner
                    </Button>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="flex flex-col items-center">
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-lg font-medium mb-1">Upload Banner</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Recommended size: 1400 x 350 pixels
                      </p>
                      <Button type="button" variant="outline" asChild>
                        <label htmlFor="banner-upload" className="cursor-pointer">
                          Choose File
                          <input
                            id="banner-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBannerChange}
                          />
                        </label>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Collection Image */}
            <div className="space-y-2">
              <Label htmlFor="image">Collection Image</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {collectionImagePreview ? (
                  <div className="space-y-4">
                    <div className="relative aspect-square max-w-xs mx-auto rounded-lg overflow-hidden">
                      <img
                        src={collectionImagePreview}
                        alt="Collection image preview"
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCollectionImage(null)
                        setCollectionImagePreview(null)
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="flex flex-col items-center">
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-lg font-medium mb-1">Upload Image</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        This will be the main image for your collection
                      </p>
                      <Button type="button" variant="outline" asChild>
                        <label htmlFor="image-upload" className="cursor-pointer">
                          Choose File
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </label>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Collection Name" {...field} />
                  </FormControl>
                  <FormDescription>
                    Give your collection a descriptive name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your collection..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Add details about your collection to help collectors understand its value
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Collection"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </Layout>
  )
}
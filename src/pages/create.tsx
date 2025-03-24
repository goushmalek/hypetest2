import { useState } from "react"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { nftService } from "@/services/nftService"
import { useRouter } from "next/router"
import { useQuery } from "@tanstack/react-query"
import { Collection } from "@/types/nft"
import { 
  Upload, 
  Plus, 
  Trash2, 
  Loader2,
  AlertCircle
} from "lucide-react"
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
  collection: z.string().min(1, "Collection is required"),
  attributes: z.array(
    z.object({
      trait_type: z.string().min(1, "Trait type is required"),
      value: z.string().min(1, "Value is required"),
    })
  ).optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function CreatePage() {
  const { account, signer } = useWallet()
  const { toast } = useToast()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [attributes, setAttributes] = useState<{ trait_type: string; value: string }[]>([])
  
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      collection: "",
      attributes: [],
    },
  })
  
  // Fetch collections for dropdown
  const { data: collections, isLoading: isLoadingCollections } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const response = await nftService.getCollections(1, 100)
      return response.collections
    },
    enabled: !!account, // Only fetch if wallet is connected
  })
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
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
      
      setFile(selectedFile)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }
  
  // Add attribute field
  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: "", value: "" }])
  }
  
  // Remove attribute field
  const removeAttribute = (index: number) => {
    const newAttributes = [...attributes]
    newAttributes.splice(index, 1)
    setAttributes(newAttributes)
  }
  
  // Update attribute field
  const updateAttribute = (index: number, field: "trait_type" | "value", value: string) => {
    const newAttributes = [...attributes]
    newAttributes[index][field] = value
    setAttributes(newAttributes)
  }
  
  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    if (!account || !signer) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create an NFT",
        variant: "destructive",
      })
      return
    }
    
    if (!file) {
      toast({
        title: "Image required",
        description: "Please upload an image for your NFT",
        variant: "destructive",
      })
      return
    }
    
    setIsUploading(true)
    
    try {
      // In a real implementation, we would upload the file to IPFS or another storage solution
      // For this demo, we'll just simulate the upload
      
      // Create NFT with form values and file
      const result = await nftService.mintNFT(
        {
          name: values.name,
          description: values.description,
          collection: values.collection,
          image: file,
          attributes: attributes.length > 0 ? attributes : undefined,
        },
        signer
      )
      
      if (result.success) {
        toast({
          title: "NFT created",
          description: "Your NFT has been successfully created",
        })
        
        // Redirect to the NFT detail page
        // In a real implementation, we would get the NFT ID from the result
        router.push("/profile")
      } else {
        toast({
          title: "Creation failed",
          description: result.message || "Failed to create NFT",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Creation failed",
        description: "An error occurred while creating the NFT",
        variant: "destructive",
      })
      console.error("Create NFT error:", error)
    } finally {
      setIsUploading(false)
    }
  }
  
  // If wallet is not connected, show connect wallet message
  if (!account) {
    return (
      <Layout title="Create NFT">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Wallet not connected</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Please connect your wallet to create an NFT.
          </p>
          <Button onClick={() => router.push("/")}>Go to Homepage</Button>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="Create NFT">
      <div className="max-w-3xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Image upload */}
            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {filePreview ? (
                  <div className="space-y-4">
                    <div className="relative aspect-square max-w-xs mx-auto rounded-lg overflow-hidden">
                      <img
                        src={filePreview}
                        alt="NFT preview"
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFile(null)
                        setFilePreview(null)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="flex flex-col items-center">
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-lg font-medium mb-1">Upload Image</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        PNG, JPG, GIF, WEBP up to 10MB
                      </p>
                      <Button type="button" variant="outline" asChild>
                        <label htmlFor="image-upload" className="cursor-pointer">
                          Choose File
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
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
                    <Input placeholder="NFT Name" {...field} />
                  </FormControl>
                  <FormDescription>
                    Give your NFT a descriptive name
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
                      placeholder="Describe your NFT..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Add details about your NFT to help collectors understand its value
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Collection */}
            <FormField
              control={form.control}
              name="collection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoadingCollections}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a collection" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {collections?.map((collection: Collection) => (
                        <SelectItem key={collection.id} value={collection.id}>
                          {collection.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="flex justify-between">
                    <span>Choose which collection this NFT belongs to</span>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => router.push("/collections/create")}
                    >
                      Create Collection
                    </Button>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Properties/Attributes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Properties</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Property
                </Button>
              </div>
              
              {attributes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add properties to your NFT to increase its uniqueness
                </p>
              ) : (
                <div className="space-y-3">
                  {attributes.map((attr, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Label htmlFor={`trait-type-${index}`} className="text-xs">
                          Type
                        </Label>
                        <Input
                          id={`trait-type-${index}`}
                          value={attr.trait_type}
                          onChange={(e) => updateAttribute(index, "trait_type", e.target.value)}
                          placeholder="E.g. Color"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`trait-value-${index}`} className="text-xs">
                          Value
                        </Label>
                        <Input
                          id={`trait-value-${index}`}
                          value={attr.value}
                          onChange={(e) => updateAttribute(index, "value", e.target.value)}
                          placeholder="E.g. Blue"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-5"
                        onClick={() => removeAttribute(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Submit button */}
            <Button
              type="submit"
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create NFT"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </Layout>
  )
}
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/router"
import { AlertCircle } from "lucide-react"

export default function NotFoundPage() {
  const router = useRouter()
  
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-6" />
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-xl text-muted-foreground max-w-md mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button size="lg" onClick={() => router.push("/")}>
            Go to Homepage
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </Layout>
  )
}
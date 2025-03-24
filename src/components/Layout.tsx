import { ReactNode, useState } from "react"
import { WalletConnectButton } from "@/components/WalletConnectButton"
import { useRouter } from "next/router"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  Home, 
  Grid, 
  Users, 
  User, 
  Plus, 
  Search, 
  Menu, 
  X,
  Moon,
  Sun
} from "lucide-react"

interface LayoutProps {
  children: ReactNode
  title?: string
  showSearch?: boolean
}

export const Layout = ({ children, title, showSearch = false }: LayoutProps) => {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark")
    } else {
      document.documentElement.classList.add("dark")
    }
    setIsDarkMode(!isDarkMode)
  }
  
  // Navigation items
  const navItems = [
    { href: "/", label: "Home", icon: <Home className="h-5 w-5" /> },
    { href: "/explore", label: "Explore", icon: <Grid className="h-5 w-5" /> },
    { href: "/collections", label: "Collections", icon: <Users className="h-5 w-5" /> },
    { href: "/profile", label: "My NFTs", icon: <User className="h-5 w-5" /> },
    { href: "/create", label: "Create", icon: <Plus className="h-5 w-5" /> },
  ]
  
  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === "/") {
      return router.pathname === "/"
    }
    return router.pathname.startsWith(href)
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo and mobile menu button */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            
            <Link href="/" className="flex items-center gap-2">
              <span className="font-bold text-xl">HyperNFT</span>
            </Link>
          </div>
          
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/80 hover:text-secondary-foreground"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          
          {/* Search button (mobile) */}
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => router.push("/search")}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
          
          {/* Right side controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="hidden md:flex"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            
            <WalletConnectButton />
          </div>
        </div>
      </header>
      
      {/* Mobile navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-30 bg-background md:hidden">
          <nav className="container flex flex-col gap-1 p-4">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-md text-base font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/80 hover:text-secondary-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={toggleDarkMode}
                className="flex items-center gap-2 w-full justify-start p-3"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
              </Button>
            </div>
          </nav>
        </div>
      )}
      
      {/* Main content */}
      <main className="flex-1">
        {title && (
          <div className="container px-4 py-6 md:py-8">
            <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          </div>
        )}
        <div className="container px-4 pb-12">{children}</div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-6 bg-background">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">HyperNFT</span>
              <span className="text-sm text-muted-foreground">© 2025</span>
            </div>
            
            <div className="flex gap-6">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
                About
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground">
                Help
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
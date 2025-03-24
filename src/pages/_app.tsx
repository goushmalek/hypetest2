import "@/styles/globals.css"
import type { AppProps } from "next/app"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WalletProvider } from "@/contexts/WalletContext"
import { useEffect } from "react"

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  // Add dark mode class if user prefers dark mode
  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark")
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <Component {...pageProps} />
        <Toaster />
      </WalletProvider>
    </QueryClientProvider>
  )
}

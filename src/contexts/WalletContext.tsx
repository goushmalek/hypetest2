import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { ethers } from "ethers"

type WalletContextType = {
  account: string | null
  provider: ethers.providers.Web3Provider | null
  signer: ethers.Signer | null
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  isConnecting: boolean
  chainId: number | null
  switchNetwork: (chainId: number) => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

type WalletProviderProps = {
  children: ReactNode
}

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)

  // Hyperliquid mainnet chain ID
  const HYPERLIQUID_CHAIN_ID = 1337 // This is a placeholder, replace with actual Hyperliquid chain ID

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask or another Ethereum wallet")
      return
    }

    setIsConnecting(true)

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum)
      const web3Signer = web3Provider.getSigner()
      const network = await web3Provider.getNetwork()
      
      setAccount(accounts[0])
      setProvider(web3Provider)
      setSigner(web3Signer)
      setChainId(network.chainId)
      
      // Check if we're on the correct network
      if (network.chainId !== HYPERLIQUID_CHAIN_ID) {
        try {
          await switchNetwork(HYPERLIQUID_CHAIN_ID)
        } catch (error) {
          console.error("Failed to switch network:", error)
        }
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setProvider(null)
    setSigner(null)
    setChainId(null)
  }

  const switchNetwork = async (targetChainId: number) => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${HYPERLIQUID_CHAIN_ID.toString(16)}`,
                chainName: "Hyperliquid Mainnet",
                nativeCurrency: {
                  name: "HYPE",
                  symbol: "HYPE",
                  decimals: 18,
                },
                rpcUrls: ["https://hyperliquid-rpc-url.com"], // Replace with actual RPC URL
                blockExplorerUrls: ["https://explorer.hyperliquid.xyz"], // Replace with actual explorer URL
              },
            ],
          })
        } catch (addError) {
          console.error("Failed to add network:", addError)
        }
      }
    }
  }

  useEffect(() => {
    // Check if user has already connected their wallet
    const checkConnection = async () => {
      if (typeof window.ethereum !== "undefined") {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (accounts.length > 0) {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum)
            const web3Signer = web3Provider.getSigner()
            const network = await web3Provider.getNetwork()
            
            setAccount(accounts[0])
            setProvider(web3Provider)
            setSigner(web3Signer)
            setChainId(network.chainId)
          }
        } catch (error) {
          console.error("Failed to check wallet connection:", error)
        }
      }
    }

    checkConnection()

    // Set up event listeners for account and chain changes
    if (typeof window.ethereum !== "undefined") {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet()
        } else {
          setAccount(accounts[0])
        }
      })

      window.ethereum.on("chainChanged", (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16)
        setChainId(newChainId)
      })
    }

    // Clean up event listeners
    return () => {
      if (typeof window.ethereum !== "undefined") {
        window.ethereum.removeAllListeners("accountsChanged")
        window.ethereum.removeAllListeners("chainChanged")
      }
    }
  }, [])

  const value = {
    account,
    provider,
    signer,
    connectWallet,
    disconnectWallet,
    isConnecting,
    chainId,
    switchNetwork,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

// Add Ethereum to the Window interface
declare global {
  interface Window {
    ethereum: any
  }
}
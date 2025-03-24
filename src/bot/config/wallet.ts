import { WalletConfig } from "../types"
import crypto from "crypto"

/**
 * WalletManager handles secure wallet connections and credential management
 * for the Hyperliquid DEX market-making bot.
 */
export class WalletManager {
  private config: WalletConfig
  private encryptionKey?: Buffer
  private iv?: Buffer
  private decryptedCredentials?: string

  /**
   * Creates a new WalletManager instance
   * @param config Wallet configuration
   */
  constructor(config: WalletConfig) {
    this.config = config
  }

  /**
   * Initialize the wallet manager with encryption key
   * @param encryptionKey Key used for encrypting/decrypting credentials
   * @returns True if initialization was successful
   */
  public async initialize(encryptionKey: string): Promise<boolean> {
    try {
      // Generate a deterministic but secure key from the provided encryption key
      this.encryptionKey = crypto.pbkdf2Sync(
        encryptionKey,
        "hyperliquid-bot-salt",
        10000,
        32,
        "sha256"
      )
      
      // Generate IV for encryption/decryption
      this.iv = crypto.randomBytes(16)
      
      // If we have encrypted credentials, try to decrypt them
      if (this.config.encryptedCredentials) {
        await this.decryptCredentials()
      }
      
      return true
    } catch (error) {
      console.error("Failed to initialize wallet manager:", error)
      return false
    }
  }

  /**
   * Encrypt wallet credentials for secure storage
   * @param credentials Raw credentials to encrypt
   * @returns Encrypted credentials string
   */
  public async encryptCredentials(credentials: string): Promise<string> {
    if (!this.encryptionKey || !this.iv) {
      throw new Error("Wallet manager not initialized")
    }

    try {
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        this.iv
      )
      
      let encrypted = cipher.update(credentials, "utf8", "hex")
      encrypted += cipher.final("hex")
      
      // Get the auth tag for verification during decryption
      const authTag = cipher.getAuthTag().toString("hex")
      
      // Store the IV and auth tag with the encrypted data
      const result = `${this.iv.toString("hex")}:${authTag}:${encrypted}`
      
      // Update the config
      this.config.encryptedCredentials = result
      this.decryptedCredentials = credentials
      
      return result
    } catch (error) {
      console.error("Failed to encrypt credentials:", error)
      throw new Error("Encryption failed")
    }
  }

  /**
   * Decrypt stored wallet credentials
   * @returns Decrypted credentials
   */
  private async decryptCredentials(): Promise<string> {
    if (!this.encryptionKey || !this.config.encryptedCredentials) {
      throw new Error("Wallet manager not initialized or no credentials to decrypt")
    }

    try {
      // Split the stored data to get IV, auth tag, and encrypted data
      const [ivHex, authTagHex, encryptedHex] = this.config.encryptedCredentials.split(":")
      
      const iv = Buffer.from(ivHex, "hex")
      const authTag = Buffer.from(authTagHex, "hex")
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        iv
      )
      
      // Set auth tag for verification
      decipher.setAuthTag(authTag)
      
      // Decrypt
      let decrypted = decipher.update(encryptedHex, "hex", "utf8")
      decrypted += decipher.final("utf8")
      
      this.decryptedCredentials = decrypted
      return decrypted
    } catch (error) {
      console.error("Failed to decrypt credentials:", error)
      throw new Error("Decryption failed")
    }
  }

  /**
   * Get the wallet address
   * @returns Wallet address
   */
  public getAddress(): string {
    return this.config.address
  }

  /**
   * Get the decrypted credentials for signing transactions
   * @returns Decrypted credentials
   */
  public getCredentials(): string {
    if (!this.decryptedCredentials) {
      throw new Error("Credentials not available or not decrypted")
    }
    return this.decryptedCredentials
  }

  /**
   * Check if the wallet is properly configured and ready to use
   * @returns True if wallet is ready
   */
  public isReady(): boolean {
    return !!this.decryptedCredentials
  }

  /**
   * Sign a transaction using the wallet credentials
   * @param transaction Transaction data to sign
   * @returns Signed transaction
   */
  public async signTransaction(transaction: any): Promise<any> {
    if (!this.isReady()) {
      throw new Error("Wallet not ready")
    }

    try {
      // Implementation would depend on the specific wallet library being used
      // This is a placeholder for the actual signing logic
      console.log(`Signing transaction for ${this.config.address}`)
      
      // In a real implementation, we would use ethers.js or a similar library
      // to sign the transaction with the private key from decryptedCredentials
      
      return {
        ...transaction,
        signature: "0xsignature", // Placeholder
        signedBy: this.config.address
      }
    } catch (error) {
      console.error("Failed to sign transaction:", error)
      throw new Error("Transaction signing failed")
    }
  }

  /**
   * Create a secure connection to the wallet
   * @returns Connection object
   */
  public async connect(): Promise<any> {
    if (!this.isReady()) {
      throw new Error("Wallet not ready")
    }

    try {
      // Implementation would depend on the specific wallet connection method
      console.log(`Connecting to wallet ${this.config.address}`)
      
      // In a real implementation, we would establish a connection to the wallet
      // using the appropriate library and the decrypted credentials
      
      return {
        address: this.config.address,
        connected: true,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error("Failed to connect to wallet:", error)
      throw new Error("Wallet connection failed")
    }
  }
}

/**
 * Create a default wallet configuration for the specified address
 * @param address Wallet address
 * @returns Default wallet configuration
 */
export function createDefaultWalletConfig(address: string): WalletConfig {
  return {
    address
  }
}

/**
 * Create a wallet manager for the specified address
 * @param address Wallet address
 * @returns Wallet manager instance
 */
export function createWalletManager(address: string): WalletManager {
  const config = createDefaultWalletConfig(address)
  return new WalletManager(config)
}
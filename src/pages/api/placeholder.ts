import type { NextApiRequest, NextApiResponse } from "next"

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set SVG content type
  res.setHeader("Content-Type", "image/svg+xml")
  
  // Get size from query parameters or use defaults
  const width = parseInt(req.query.width as string) || 400
  const height = parseInt(req.query.height as string) || 400
  
  // Get type from query parameters (nft or collection)
  const type = req.query.type as string || "nft"
  
  // Generate SVG placeholder
  const svg = generatePlaceholderSVG(width, height, type)
  
  // Send SVG response
  res.status(200).send(svg)
}

function generatePlaceholderSVG(width: number, height: number, type: string): string {
  // Generate a gradient background with Hyperliquid colors
  const gradientId = `gradient-${Math.random().toString(36).substring(2, 9)}`
  
  // Text content based on type
  const text = type === "collection" ? "Collection" : "NFT"
  const fontSize = Math.max(width, height) / 15
  
  // Generate a unique pattern for each placeholder
  const patternId = `pattern-${Math.random().toString(36).substring(2, 9)}`
  const patternSize = Math.min(width, height) / 10
  const patternColor = type === "collection" ? "#6366f1" : "#8b5cf6"
  
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        
        <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(45)">
          <circle cx="${patternSize/2}" cy="${patternSize/2}" r="${patternSize/6}" fill="${patternColor}" opacity="0.2" />
        </pattern>
      </defs>
      
      <rect width="${width}" height="${height}" fill="url(#${gradientId})" />
      <rect width="${width}" height="${height}" fill="url(#${patternId})" />
      
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${fontSize}px"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        Hyperliquid ${text}
      </text>
      
      <text
        x="50%"
        y="${height/2 + fontSize * 1.2}"
        font-family="Arial, sans-serif"
        font-size="${fontSize/2}px"
        fill="#94a3b8"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        HyperNFT Marketplace
      </text>
    </svg>
  `
}
'use client'

// components/marketing/cards/CardQRCode.tsx
// Thin wrapper so both preview and PDF use the same QR settings

import { QRCodeSVG } from 'qrcode.react'

interface CardQRCodeProps {
  url: string
  size?: number
  /** dark = white bg with dark QR (for light card bg); light = inverse */
  variant?: 'dark' | 'light'
}

export function CardQRCode({ url, size = 64, variant = 'dark' }: CardQRCodeProps) {
  return (
    <QRCodeSVG
      value={url}
      size={size}
      bgColor={variant === 'dark' ? '#ffffff' : '#0f172a'}
      fgColor={variant === 'dark' ? '#0f172a' : '#ffffff'}
      level="M"
      includeMargin={false}
    />
  )
}

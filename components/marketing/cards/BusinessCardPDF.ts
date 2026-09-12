// components/marketing/cards/BusinessCardPDF.ts
//
// Client-side PDF generator using jsPDF.
// Produces a print-ready A4 sheet with 10 cards in the standard 2×5 layout.
//
// Card dimensions: 85.6mm × 54mm (ISO/IEC 7810 ID-1 — Australian standard)
// This matches the LI LABEL / Avery 8871 compatible 10-up card sheets.
//
// NOTE: Do NOT import this module at module level in a React component.
// Use dynamic import:
//   const { generateBusinessCardPDF } = await import('./BusinessCardPDF')
//
// This keeps jsPDF out of the initial bundle (it's ~250 KB).

import { CardData } from './types'

// ── Layout constants ──────────────────────────────────────────────────────────
// A4 = 210 × 297 mm
// Card = 85.6 × 54 mm
// 2 columns, 5 rows = 10 cards per sheet
// Margins calculated to centre the grid on the A4 sheet

const CARD_W = 85.6
const CARD_H = 54
const COLS = 2
const ROWS = 5
const SHEET_W = 210
const SHEET_H = 297

// Left margin = (210 - 2 × 85.6) / 2 = 19.4mm
const MARGIN_X = (SHEET_W - COLS * CARD_W) / 2   // ~19.4mm
// Top margin = (297 - 5 × 54) / 2 = 13.5mm
const MARGIN_Y = (SHEET_H - ROWS * CARD_H) / 2   // ~13.5mm

// ── Colours ───────────────────────────────────────────────────────────────────
const NAVY       = [15, 23, 42]    // slate-900
const SKY        = [14, 165, 233]  // sky-500
const WHITE      = [255, 255, 255]
const SLATE_400  = [148, 163, 184]
const SLATE_300  = [203, 213, 225]
const SLATE_600  = [71, 85, 105]
const BLACK      = [0, 0, 0]
const LIGHT_GREY = [241, 245, 249] // slate-100 — card back bg

// ── QR code helper ────────────────────────────────────────────────────────────
// QRCode.toDataURL is synchronous after the library is loaded.
// We use qrcode (npm) — the same package used by qrcode.react under the hood.

async function qrDataUrl(text: string, size = 180): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}

// ── Card coordinate helper ────────────────────────────────────────────────────
function cardOrigin(index: number): { x: number; y: number } {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return {
    x: MARGIN_X + col * CARD_W,
    y: MARGIN_Y + row * CARD_H,
  }
}

// ── Front side ────────────────────────────────────────────────────────────────
function drawFront(
  doc: any,
  x: number,
  y: number,
  data: CardData,
  qrImgData: string,
) {
  const W = CARD_W
  const H = CARD_H
  const right = x + W

  // Background
  doc.setFillColor(...NAVY)
  doc.rect(x, y, W, H, 'F')

  // Top accent bar (1mm tall)
  doc.setFillColor(...SKY)
  doc.rect(x, y, W, 1, 'F')

  // Left column: text content (x to x+52)
  const textX = x + 4

  // Brand label
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...SKY)
  doc.text('DRIVEBOOK', textX, y + 8)

  // Instructor name — split to two lines if needed, max 50mm wide
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  const name = data.instructorName || 'Instructor Name'
  const nameLines = doc.splitTextToSize(name, 50) as string[]
  const nameToPrint = nameLines.slice(0, 2)  // max 2 lines
  doc.text(nameToPrint, textX, y + 15)
  const nameBlockH = nameToPrint.length > 1 ? 10 : 5

  // Role
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE_400)
  doc.text('Driving Instructor', textX, y + 15 + nameBlockH)

  // Details block — positioned relative to name height
  const detailY = y + 15 + nameBlockH + 8
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE_300)

  // Phone — use "Ph:" prefix instead of emoji
  doc.text(`Ph:  ${data.phone || '04XX XXX XXX'}`, textX, detailY)

  // Suburbs — use location prefix text
  if (data.suburbs) {
    const suburbLines = doc.splitTextToSize(data.suburbs, 48) as string[]
    doc.setFontSize(7)
    doc.setTextColor(203, 213, 225)
    doc.text(suburbLines.slice(0, 2), textX, detailY + 6)
  }

  // Transmission + car label — use plain text
  const txLabel =
    data.transmission === 'BOTH' ? 'Auto & Manual' :
    data.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual'
  const carLine = data.carLabel ? `${data.carLabel}  |  ${txLabel}` : txLabel

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...SKY)
  doc.text(carLine, textX, detailY + 13)

  // Footer branding — shows instructor's actual domain
  if (data.showDriveBookFooter) {
    const footerText = data.footerDomain || 'drivebook.com.au'
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE_600)
    doc.text(footerText, textX, y + H - 3)
  }

  // Right column: QR code (from x+55 to x+W, centred)
  const qrX = x + 56
  const qrSize = 26   // mm — comfortable fit in right column
  const qrY = y + (H - qrSize) / 2

  // White background behind QR
  doc.setFillColor(...WHITE)
  doc.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 1.5, 1.5, 'F')

  // QR image
  doc.addImage(qrImgData, 'PNG', qrX, qrY, qrSize, qrSize)

  // "Scan to book" label
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE_400)
  doc.text('Scan to book', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' })
}

// ── Back side ─────────────────────────────────────────────────────────────────
function drawBack(doc: any, x: number, y: number, data: CardData) {
  const W = CARD_W
  const H = CARD_H

  // Background — light grey
  doc.setFillColor(...LIGHT_GREY)
  doc.rect(x, y, W, H, 'F')

  // Top accent bar
  doc.setFillColor(...SKY)
  doc.rect(x, y, W, 1, 'F')

  const padX = x + 5
  const padY = y + 7

  // Header
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...SKY)
  doc.text('DRIVEBOOK', padX, padY)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)  // slate-800
  doc.text('Your Driving Progress', padX, padY + 5)

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE_400)
  doc.text('Book next lesson online', x + W - 5, padY + 5, { align: 'right' })

  // Column headers
  const tableY = padY + 10
  const dateW = 20
  const focusW = W - 10 - dateW - 18  // remaining
  const signW = 18

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...SLATE_400)
  doc.text('DATE', padX, tableY)
  doc.text('FOCUS / SKILL', padX + dateW + 2, tableY)
  doc.text('SIGNED', padX + dateW + focusW + 4, tableY)

  // 6 rows
  const ROW_H = 6
  const LINE_COLOR = [203, 213, 225]  // slate-300

  for (let i = 0; i < 6; i++) {
    const rowY = tableY + 3 + i * ROW_H

    doc.setDrawColor(...LINE_COLOR)
    doc.setLineWidth(0.2)

    // Date cell line
    doc.line(padX, rowY + ROW_H, padX + dateW, rowY + ROW_H)

    // Focus cell line
    doc.line(padX + dateW + 2, rowY + ROW_H, padX + dateW + focusW, rowY + ROW_H)

    // Signed cell line
    doc.line(padX + dateW + focusW + 4, rowY + ROW_H, padX + dateW + focusW + signW, rowY + ROW_H)
  }

  // Footer
  if (data.showDriveBookFooter) {
    const footerText = data.footerDomain
      ? `${data.footerDomain} — Book 24/7 online`
      : 'drivebook.com.au — Book 24/7 online'
    
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE_400)
    doc.text(footerText, x + W / 2, y + H - 3, { align: 'center' })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type PDFOutput = 'download' | 'blob'

/**
 * Generate a print-ready business card PDF.
 *
 * @param data      CardData to render
 * @param output    'download' triggers browser save-as; 'blob' returns the Blob
 * @param quantity  Number of cards (10 per sheet — determines how many copies to fill)
 *
 * Layout: Page 1 = front side × 10, Page 2 = back side × 10
 * This matches duplex printing where you flip the long edge.
 */
export async function generateBusinessCardPDF(
  data: CardData,
  output: PDFOutput = 'download',
  quantity = 10,
): Promise<Blob | void> {
  // Dynamic import — keeps jsPDF out of the initial bundle
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Generate QR code once
  const qrImg = await qrDataUrl(data.bookingUrl || 'https://drivebook.com.au')

  // ── Page 1: front side × 10 ──────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const { x, y } = cardOrigin(i)
    drawFront(doc, x, y, data, qrImg)
  }

  // ── Page 2: back side × 10 ───────────────────────────────────────────────
  doc.addPage()
  // For double-sided printing (flip on long edge), the back columns are mirrored.
  // Col 0 on front → Col 1 on back (right to left).
  for (let i = 0; i < 10; i++) {
    const row = Math.floor(i / COLS)
    const col = (COLS - 1) - (i % COLS)   // mirror columns
    const x = MARGIN_X + col * CARD_W
    const y = MARGIN_Y + row * CARD_H
    drawBack(doc, x, y, data)
  }

  // ── Optional: crop marks ──────────────────────────────────────────────────
  // Light guides — 2mm outside each card corner
  doc.setPage(1)
  addCropMarks(doc)
  doc.setPage(2)
  addCropMarks(doc)

  // ── Output ────────────────────────────────────────────────────────────────
  const filename = `drivebook-cards-${data.instructorName.replace(/\s+/g, '-').toLowerCase()}.pdf`

  if (output === 'blob') {
    return doc.output('blob')
  }

  doc.save(filename)
}

// ── Crop marks ────────────────────────────────────────────────────────────────
function addCropMarks(doc: any) {
  const MARK_LEN = 2
  const GAP = 0.5

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.15)

  for (let row = 0; row <= ROWS; row++) {
    for (let col = 0; col <= COLS; col++) {
      const cx = MARGIN_X + col * CARD_W
      const cy = MARGIN_Y + row * CARD_H

      // Horizontal marks
      if (cx > 5) doc.line(cx - GAP - MARK_LEN, cy, cx - GAP, cy)
      if (cx < SHEET_W - 5) doc.line(cx + GAP, cy, cx + GAP + MARK_LEN, cy)

      // Vertical marks
      if (cy > 5) doc.line(cx, cy - GAP - MARK_LEN, cx, cy - GAP)
      if (cy < SHEET_H - 5) doc.line(cx, cy + GAP, cx, cy + GAP + MARK_LEN)
    }
  }
}

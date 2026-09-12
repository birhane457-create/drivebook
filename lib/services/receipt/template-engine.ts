/**
 * Receipt Template Engine - HTML Generation for Tax-Compliant Receipts
 * 
 * This module generates HTML email receipts from enriched document structures.
 * It handles all receipt types (TAX_INVOICE, RCTI, PAYMENT_RECEIPT, MIXED_DOCUMENT,
 * ADJUSTMENT_NOTE) with appropriate styling and formatting for email clients.
 * 
 * The template engine renders:
 * - Document headers with type-specific titles and styling
 * - Metadata tables with receipt details
 * - Supplier information (including RCTI formatting)
 * - Line items tables with GST summaries
 * - Wallet balance changes
 * - Payment details
 * - Cancellation policies
 * - Footer with links and account information
 * 
 * @module lib/services/receipt/template-engine
 */

import {
  EnrichedDocument,
  DocumentSection,
  EnrichedLineItem,
  DocumentType
} from './types';

/**
 * Receipt Template Engine - Generates HTML from enriched documents.
 * 
 * Uses inline CSS for email client compatibility.
 * Renders all receipt components with proper Australian timezone formatting.
 */
export class ReceiptTemplateEngine {
  /**
   * Generate complete HTML receipt from enriched document.
   * 
   * @param doc - Enriched document with all receipt data
   * @returns Complete HTML document ready for email delivery
   */
  generate(doc: EnrichedDocument): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${doc.receiptNumber}</title>
  ${this.renderStyles()}
</head>
<body>
  <div class="receipt-container">
    ${this.renderHeader(doc)}
    ${this.renderMetadata(doc)}
    ${this.renderSections(doc)}
    ${this.renderWalletBalance(doc)}
    ${this.renderPaymentDetails(doc)}
    ${this.renderCancellationPolicy(doc)}
    ${this.renderFooter(doc)}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Render embedded CSS styles for email compatibility.
   * Uses inline styles where possible, embedded CSS as fallback.
   */
  private renderStyles(): string {
    return `
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    background-color: #f3f4f6;
    padding: 20px;
  }
  
  .receipt-container {
    max-width: 650px;
    margin: 0 auto;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  /* Header Styles */
  .header {
    padding: 32px;
    color: white;
    text-align: center;
  }
  
  .header.blue-gradient {
    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  }
  
  .header.red-gradient {
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  }
  
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  
  .header .subtitle {
    font-size: 14px;
    opacity: 0.9;
  }
  
  /* Metadata Table */
  .metadata {
    padding: 24px 32px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .metadata table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .metadata td {
    padding: 6px 0;
    font-size: 14px;
  }
  
  .metadata td:first-child {
    color: #6b7280;
    width: 140px;
  }
  
  .metadata td:last-child {
    color: #1f2937;
    font-weight: 500;
  }
  
  /* Section Styles */
  .section {
    padding: 24px 32px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .section h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
  }
  
  .supplier-info {
    margin-bottom: 16px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    font-size: 14px;
  }
  
  .supplier-info p {
    margin: 4px 0;
  }
  
  .rcti-block {
    margin-bottom: 16px;
    padding: 16px;
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    border-radius: 6px;
    font-size: 14px;
  }
  
  .rcti-block .rcti-label {
    font-weight: 700;
    color: #92400e;
    margin-bottom: 8px;
  }
  
  .rcti-block p {
    margin: 4px 0;
  }
  
  /* Line Items Table */
  .line-items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  
  .line-items tr {
    border-bottom: 1px solid #e5e7eb;
  }
  
  .line-items tr:last-child {
    border-bottom: none;
  }
  
  .line-items td {
    padding: 12px 0;
    font-size: 14px;
  }
  
  .line-items td:first-child {
    color: #1f2937;
  }
  
  .line-items td.amount {
    text-align: right;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
  }
  
  /* GST Summary */
  .gst-summary {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;
  }
  
  .note {
    font-size: 13px;
    color: #6b7280;
    font-style: italic;
    margin-top: 12px;
  }
  
  /* Wallet Box */
  .wallet-box {
    padding: 24px 32px;
    background: #eff6ff;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .wallet-box h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1e40af;
    margin-bottom: 16px;
  }
  
  .wallet-box table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .wallet-box td {
    padding: 6px 0;
    font-size: 14px;
  }
  
  .wallet-box td:first-child {
    color: #1f2937;
  }
  
  .wallet-box td:last-child {
    text-align: right;
    font-weight: 600;
  }
  
  .wallet-box .credit {
    color: #059669;
  }
  
  .wallet-box .debit {
    color: #dc2626;
  }
  
  .wallet-box .balance {
    font-size: 16px;
    color: #1e40af;
  }
  
  /* Payment Details */
  .payment-details {
    padding: 24px 32px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .payment-details h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
  }
  
  .payment-details table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .payment-details td {
    padding: 6px 0;
    font-size: 14px;
  }
  
  .payment-details td:first-child {
    color: #6b7280;
  }
  
  .payment-details td:last-child {
    text-align: right;
    font-weight: 600;
    color: #1f2937;
  }
  
  .payment-details .total {
    font-size: 18px;
    color: #1e40af;
    padding-top: 8px;
    border-top: 2px solid #e5e7eb;
  }
  
  .payment-details .reference {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #6b7280;
  }
  
  /* Cancellation Policy */
  .policy {
    padding: 24px 32px;
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
  }
  
  .policy h3 {
    font-size: 16px;
    font-weight: 600;
    color: #92400e;
    margin-bottom: 12px;
  }
  
  .policy ul {
    list-style: none;
    padding: 0;
  }
  
  .policy li {
    padding: 6px 0;
    font-size: 14px;
    color: #78350f;
  }
  
  .policy li:before {
    content: "• ";
    font-weight: bold;
    margin-right: 8px;
  }
  
  /* Footer */
  .footer {
    padding: 24px 32px;
    background: #f9fafb;
    font-size: 13px;
    color: #6b7280;
    text-align: center;
  }
  
  .footer a {
    color: #2563eb;
    text-decoration: none;
  }
  
  .footer a:hover {
    text-decoration: underline;
  }
  
  .footer p {
    margin: 8px 0;
  }
  
  .footer .links {
    margin: 16px 0;
  }
  
  .footer .links a {
    margin: 0 12px;
  }
</style>
    `;
  }

  /**
   * Render receipt header with document type-specific title and styling.
   */
  private renderHeader(doc: EnrichedDocument): string {
    const titleMap: Record<DocumentType, string> = {
      [DocumentType.TAX_INVOICE]: 'Tax Receipt',
      [DocumentType.RCTI]: 'Tax Invoice (RCTI)',
      [DocumentType.PAYMENT_RECEIPT]: 'Payment Receipt',
      [DocumentType.MIXED_DOCUMENT]: 'Payment Receipt & Tax Invoice',
      [DocumentType.ADJUSTMENT_NOTE]: 'Booking Cancelled'
    };
    
    const title = titleMap[doc.context.documentType] || 'Receipt';
    const gradientClass = doc.context.documentType === DocumentType.ADJUSTMENT_NOTE 
      ? 'red-gradient' 
      : 'blue-gradient';
    
    return `
<div class="header ${gradientClass}">
  <h1>${this.escapeHtml(title)}</h1>
  <p class="subtitle">DriveBook Platform</p>
</div>
    `.trim();
  }

  /**
   * Render metadata table with receipt details and customer information.
   */
  private renderMetadata(doc: EnrichedDocument): string {
    const { context, receiptNumber } = doc;
    const formattedDate = this.formatAustralianDate(context.issuedDate);
    
    let rows = `
      <tr>
        <td>Receipt Number:</td>
        <td>${this.escapeHtml(receiptNumber)}</td>
      </tr>
      <tr>
        <td>Date:</td>
        <td>${this.escapeHtml(formattedDate)}</td>
      </tr>
      <tr>
        <td>Customer:</td>
        <td>${this.escapeHtml(context.customer.name)}</td>
      </tr>
      <tr>
        <td>Email:</td>
        <td>${this.escapeHtml(context.customer.email)}</td>
      </tr>
    `;
    
    // Add booking details if present
    if (context.booking) {
      const bookingDate = this.formatAustralianDate(context.booking.startTime);
      const duration = `{context.booking.duration} minutes`;
      
      rows += `
      <tr>
        <td>Booking Start:</td>
        <td>${this.escapeHtml(bookingDate)}</td>
      </tr>
      <tr>
        <td>Duration:</td>
        <td>${this.escapeHtml(duration)}</td>
      </tr>
      `;
    }
    
    return `
<div class="metadata">
  <table>
    ${rows}
  </table>
</div>
    `.trim();
  }

  /**
   * Render all document sections (supplier-grouped line items).
   */
  private renderSections(doc: EnrichedDocument): string {
    return doc.sections.map(section => this.renderSection(section)).join('\n');
  }

  /**
   * Render a single document section with supplier info, line items, and GST summary.
   */
  private renderSection(section: DocumentSection): string {
    return `
<div class="section">
  <h2>${this.escapeHtml(section.title)}</h2>
  ${this.renderSupplierInfo(section)}
  ${this.renderLineItemsTable(section.items)}
  ${this.renderGSTSummary(section)}
  ${section.note ? `<p class="note">${this.escapeHtml(section.note)}</p>` : ''}
</div>
    `.trim();
  }

  /**
   * Render supplier information with special RCTI formatting if applicable.
   */
  private renderSupplierInfo(section: DocumentSection): string {
    if (!section.supplier) {
      return '';
    }
    
    if (section.rcti) {
      // RCTI format with special styling
      return `
<div class="rcti-block">
  <p class="rcti-label">Recipient Created Tax Invoice (RCTI)</p>
  <p>Issued by DriveBook on behalf of:</p>
  <p><strong>Supplier:</strong> ${this.escapeHtml(section.supplier.name)}</p>
  ${section.supplier.abn ? `<p><strong>ABN:</strong> ${this.escapeHtml(section.supplier.abn)}</p>` : ''}
</div>
      `.trim();
    }
    
    // Standard supplier format
    return `
<div class="supplier-info">
  <p><strong>Supplier:</strong> ${this.escapeHtml(section.supplier.name)}</p>
  ${section.supplier.abn ? `<p><strong>ABN:</strong> ${this.escapeHtml(section.supplier.abn)}</p>` : ''}
</div>
    `.trim();
  }

  /**
   * Render line items table with descriptions and amounts.
   */
  private renderLineItemsTable(items: EnrichedLineItem[]): string {
    const rows = items.map(item => `
      <tr>
        <td>${this.escapeHtml(item.formattedDescription)}</td>
        <td class="amount">${this.formatCurrency(item.amount)}</td>
      </tr>
    `).join('');
    
    return `
<table class="line-items">
  ${rows}
</table>
    `.trim();
  }

  /**
   * Render GST summary for a section.
   */
  private renderGSTSummary(section: DocumentSection): string {
    if (!section.showGST) {
      return '';
    }
    
    const totalGST = section.items.reduce((sum, item) => sum + item.gst, 0);
    
    if (totalGST > 0) {
      return `<p class="gst-summary">GST included: ${this.formatCurrency(totalGST)} (Goods & Services Tax)</p>`;
    } else {
      return `<p class="gst-summary">This supplier is not GST-registered. No GST applies.</p>`;
    }
  }

  /**
   * Render wallet balance changes if wallet context exists.
   */
  private renderWalletBalance(doc: EnrichedDocument): string {
    if (!doc.context.wallet) {
      return '';
    }
    
    const wallet = doc.context.wallet;
    const rows: string[] = [];
    
    if (wallet.previousBalance !== undefined) {
      rows.push(`
        <tr>
          <td>Previous balance:</td>
          <td>${this.formatCurrency(wallet.previousBalance)}</td>
        </tr>
      `);
    }
    
    if (wallet.credited !== undefined && wallet.credited > 0) {
      rows.push(`
        <tr>
          <td>Credits added:</td>
          <td class="credit">+${this.formatCurrency(wallet.credited)}</td>
        </tr>
      `);
    }
    
    if (wallet.debited !== undefined && wallet.debited > 0) {
      rows.push(`
        <tr>
          <td>Lesson debit:</td>
          <td class="debit">-${this.formatCurrency(wallet.debited)}</td>
        </tr>
      `);
    }
    
    rows.push(`
      <tr>
        <td>New balance:</td>
        <td class="balance">${this.formatCurrency(wallet.newBalance)}</td>
      </tr>
    `);
    
    // Add approximate hours if hourly rate provided
    if (wallet.hourlyRate && wallet.hourlyRate > 0) {
      const hours = (wallet.newBalance / wallet.hourlyRate).toFixed(1);
      rows.push(`
        <tr>
          <td></td>
          <td style="font-size: 12px; color: #6b7280;">(approx. ${hours} hrs)</td>
        </tr>
      `);
    }
    
    return `
<div class="wallet-box">
  <h3>Wallet Balance</h3>
  <table>
    ${rows.join('')}
  </table>
</div>
    `.trim();
  }

  /**
   * Render payment details section.
   */
  private renderPaymentDetails(doc: EnrichedDocument): string {
    const { payment, wallet } = doc.context;
    const rows: string[] = [];
    
    // Check if this is a wallet-only payment ($0 card charge)
    const isWalletOnly = payment.total === 0 && wallet?.debited;
    
    if (isWalletOnly) {
      rows.push(`
        <tr>
          <td>Charged to card:</td>
          <td>$0.00</td>
        </tr>
        <tr>
          <td>Paid from wallet:</td>
          <td class="debit">${this.formatCurrency(wallet!.debited!)}</td>
        </tr>
      `);
    } else {
      rows.push(`
        <tr class="total">
          <td>Total charged:</td>
          <td>${this.formatCurrency(payment.total)}</td>
        </tr>
      `);
      
      if (payment.method) {
        rows.push(`
          <tr>
            <td>Payment method:</td>
            <td>${this.escapeHtml(payment.method)}</td>
          </tr>
        `);
      }
      
      if (payment.stripePaymentIntentId) {
        rows.push(`
          <tr>
            <td>Reference:</td>
            <td class="reference">${this.escapeHtml(payment.stripePaymentIntentId)}</td>
          </tr>
        `);
      }
    }
    
    return `
<div class="payment-details">
  <h3>Payment</h3>
  <table>
    ${rows.join('')}
  </table>
</div>
    `.trim();
  }

  /**
   * Render cancellation policy for booking receipts.
   * Uses 24-hour binary rule: full refund if cancelled 24+ hours before, no refund under 24 hours.
   */
  private renderCancellationPolicy(doc: EnrichedDocument): string {
    const { documentType, booking } = doc.context;
    
    // Show policy for MIXED_DOCUMENT or TAX_INVOICE with booking
    const shouldShow = documentType === DocumentType.MIXED_DOCUMENT ||
                      (documentType === DocumentType.TAX_INVOICE && booking);
    
    if (!shouldShow) {
      return '';
    }
    
    return `
<div class="policy">
  <h3>Cancellation Policy</h3>
  <ul>
    <li>24+ hours notice: full refund</li>
    <li>Under 24 hours: no refund</li>
  </ul>
</div>
    `.trim();
  }

  /**
   * Render footer with links and account information.
   */
  private renderFooter(doc: EnrichedDocument): string {
    const supportEmail = process.env.ADMIN_EMAIL || 'support@drivebook.com.au';
    const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';
    const { booking } = doc.context;
    
    const links: string[] = [];
    
    if (booking) {
      links.push(`<a href="${baseUrl}/bookings/${booking.id}">Manage booking</a>`);
    }
    
    links.push(`<a href="mailto:${supportEmail}">Contact support</a>`);
    links.push(`<a href="${baseUrl}/client-dashboard">View dashboard</a>`);
    links.push(`<a href="${baseUrl}/login">Login</a>`);
    
    return `
<div class="footer">
  <p class="links">
    ${links.join(' &nbsp;|&nbsp; ')}
  </p>
  <p>Questions? Email us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
  <p style="margin-top: 16px; font-size: 12px;">
    New to DriveBook? Your account was created automatically.<br>
    Login at <a href="${baseUrl}/login">${baseUrl}/login</a> using the email this receipt was sent to.
  </p>
</div>
    `.trim();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format a date in Australian timezone.
   */
  private formatAustralianDate(date: Date): string {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  /**
   * Format a number as Australian currency.
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Escape HTML to prevent XSS attacks.
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }
}

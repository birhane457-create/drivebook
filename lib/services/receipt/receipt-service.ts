/**
 * Receipt Service - Main Orchestrator for Receipt Generation and Email Delivery
 * 
 * This module provides the high-level service layer for generating and sending
 * tax-compliant receipts. It orchestrates the validation, building, rendering,
 * and email delivery pipeline.
 * 
 * @module lib/services/receipt/receipt-service
 */

import { ContextValidator } from './validator';
import { TaxDocumentBuilder } from './builder';
import { ReceiptTemplateEngine } from './template-engine';
import { TaxDocumentContext, DocumentType, ValidationError } from './types';
import { emailService } from '../email';
import type { DisplayIdentitySource } from '@/lib/branding/getDisplayIdentity';

/**
 * Receipt Service - Main orchestrator for receipt generation and delivery.
 * 
 * Provides two main methods:
 * 1. generateHTML - Validates, builds, and renders receipt HTML
 * 2. generateAndSend - Generates HTML and sends via email using EmailService
 * 
 * This class handles the complete receipt lifecycle from context validation
 * through email delivery, with full white-label support and error handling.
 */
export class ReceiptService {
  private validator: ContextValidator;
  private builder: TaxDocumentBuilder;
  private templateEngine: ReceiptTemplateEngine;

  constructor() {
    this.validator = new ContextValidator();
    this.builder = new TaxDocumentBuilder();
    this.templateEngine = new ReceiptTemplateEngine();
  }

  /**
   * Generate HTML receipt from context.
   * 
   * Validates context, builds enriched document, and generates HTML.
   * Throws ValidationError if context is invalid.
   * 
   * @param context - Tax document context with all receipt data
   * @returns Complete HTML document string ready for email delivery
   * @throws ValidationError if context validation fails
   * 
   * @example
   * ```typescript
   * const html = receiptService.generateHTML(context);
   * ```
   */
  generateHTML(context: TaxDocumentContext): string {
    // Validate input context (Requirement 15.2)
    const validationResult = this.validator.validate(context);
    if (!validationResult.valid) {
      throw new ValidationError(validationResult.errors);
    }

    // Build enriched document (Requirement 15.3)
    const enrichedDoc = this.builder.build(context);

    // Log warning if totals don't match (Requirement 27.3)
    if (!enrichedDoc.validation.itemsMatchTotal) {
      console.warn(
        `[ReceiptService] Total mismatch: items=${enrichedDoc.totals.total} payment=${context.payment.total}`
      );
    }

    // Generate HTML (Requirement 15.4)
    const html = this.templateEngine.generate(enrichedDoc);

    return html;
  }

  /**
   * Generate receipt HTML and send via email.
   * 
   * Generates HTML using generateHTML(), then sends email via EmailService
   * with white-label support, error handling, and event tracking.
   * 
   * @param context - Tax document context with all receipt data
   * @returns Promise that resolves when email is sent
   * @throws ValidationError if context validation fails
   * 
   * @example
   * ```typescript
   * await receiptService.generateAndSend(context);
   * ```
   */
  async generateAndSend(context: TaxDocumentContext): Promise<void> {
    // Generate HTML (Requirement 15.5)
    const html = this.generateHTML(context);

    // Build email subject (Requirement 15.4)
    const subject = this.buildEmailSubject(context);

    // Send email via EmailService for white-label support, error handling, and event tracking
    // Provider context enables white-label sender resolution
    await emailService.sendReceipt({
      to: context.customer.email,
      subject,
      html,
      provider: context.provider ? { id: context.provider.id } as unknown as DisplayIdentitySource : undefined
    });
  }

  /**
   * Build email subject line based on document type.
   * 
   * @param context - Tax document context
   * @returns Email subject string
   * 
   * Requirements 17.1-17.5
   */
  private buildEmailSubject(context: TaxDocumentContext): string {
    const receiptNum = context.receiptNumber || 
                      this.formatReceiptNumber(context.receiptId, context.issuedDate);

    switch (context.documentType) {
      case DocumentType.TAX_INVOICE:
      case DocumentType.RCTI:
        return `Receipt ${receiptNum} - Lesson Booked`;
        
      case DocumentType.MIXED_DOCUMENT:
        return `Receipt ${receiptNum} - Package Purchased`;
        
      case DocumentType.PAYMENT_RECEIPT:
        return `Receipt ${receiptNum} - Wallet Topped Up`;
        
      case DocumentType.ADJUSTMENT_NOTE:
        return `Cancellation ${receiptNum} - Lesson Cancelled`;
        
      default:
        return `Receipt ${receiptNum}`;
    }
  }

  /**
   * Format receipt ID into receipt number.
   * 
   * Generates format: DB-{year}-{last6CharsOfId}
   * Example: DB-2024-ABC123
   * 
   * @param id - Transaction ID (e.g., UUID)
   * @param date - Issue date
   * @returns Formatted receipt number
   * 
   * Requirement 17.5
   */
  private formatReceiptNumber(id: string, date: Date): string {
    const year = date.getFullYear();
    const shortId = id.slice(-6).toUpperCase();
    return `DB-${year}-${shortId}`;
  }
}

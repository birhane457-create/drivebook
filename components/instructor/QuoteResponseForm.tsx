'use client'

import { useState } from 'react'
import { Plus, X, DollarSign, FileText, Send } from 'lucide-react'

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
}

interface QuoteResponseFormProps {
  bookingId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function QuoteResponseForm({ bookingId, onSuccess, onCancel }: QuoteResponseFormProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 }
  ])
  const [notes, setNotes] = useState('')
  const [validDays, setValidDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return // Keep at least one
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum: any, item: any) => sum + (item.quantity * item.unitPrice), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate
    if (lineItems.some(item => !item.description.trim())) {
      setError('All line items must have a description')
      return
    }

    const total = calculateTotal()
    if (total <= 0) {
      setError('Quote total must be greater than $0')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/instructor/quotes/${bookingId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems,
          notes,
          validDays,
          totalAmount: total,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit quote')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to submit quote')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-card/80 rounded-xl border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Submit Quote</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-foreground">Line Items</label>
            <button
              type="button"
              onClick={addLineItem}
              className="text-sm text-primary hover:text-primary flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={index} className="bg-background/60 rounded-lg p-4 border border-white/5">
                <div className="grid gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Description *</label>
                    <input
                      type="text"
                      required
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="e.g. Labour, Materials, Service fee"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Qty</label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Unit Price</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <div className="w-full">
                        <label className="block text-xs text-muted-foreground mb-1">Total</label>
                        <div className="px-3 py-2 bg-secondary/60 rounded-lg text-foreground text-sm font-medium">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </div>
                      </div>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="ml-2 p-2 text-destructive hover:text-destructive hover:bg-red-950/30 rounded-lg transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-sky-950/30 border border-sky-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-sky-200">Total Quote Amount</span>
            <span className="text-2xl font-bold text-sky-100">${calculateTotal().toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional details, terms, or conditions..."
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Valid Days */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Quote Valid For
          </label>
          <select
            value={validDays}
            onChange={(e) => setValidDays(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-sky-500"
          >
            <option value={3}>3 days</option>
            <option value={7}>7 days (recommended)</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-secondary transition font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-primary text-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Quote
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

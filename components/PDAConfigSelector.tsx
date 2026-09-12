'use client'

import { useState, useEffect } from 'react'
import { Zap, ChevronDown, Check } from 'lucide-react'

interface PDAConfig {
  id: string
  name: string
  durationMinutes: number
  price: number
  discountPercent?: number | null
  testCentres: Array<{ id: string; name: string }>
  includes?: {
    pickup?: boolean
    dropoff?: boolean
    debriefing?: boolean
  }
}

interface PDAConfigSelectorProps {
  providerId: string
  onSelect: (config: PDAConfig) => void
  selectedConfigId?: string
}

export default function PDAConfigSelector({
  providerId,
  onSelect,
  selectedConfigId
}: PDAConfigSelectorProps) {
  const [configs, setConfigs] = useState<PDAConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch(`/api/instructor/pda-configs`)
        if (!res.ok) throw new Error('Failed to fetch PDA configs')
        const data = await res.json()
        setConfigs((data as any).configs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading PDA configs')
        setConfigs([])
      } finally {
        setLoading(false)
      }
    }

    fetchConfigs()
  }, [providerId])

  const selectedConfig = configs.find(c => c.id === selectedConfigId)

  const calculatePrice = (config: PDAConfig) => {
    if (!config.discountPercent) return config.price
    return config.price * (1 - config.discountPercent / 100)
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading PDA options...</div>
  }

  if (error || configs.length === 0) {
    return null // No PDA configs available
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">PDA Test Config</label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 text-left bg-background border border-border rounded-lg text-foreground hover:border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {selectedConfig ? (
              <div>
                <div className="font-medium">{selectedConfig.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDuration(selectedConfig.durationMinutes)} • ${calculatePrice(selectedConfig as any).toFixed(2)}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Select a PDA test option...</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-10">
            <div className="max-h-64 overflow-y-auto">
              {configs.map(config => {
                const price = calculatePrice(config)
                const originalPrice = config.price
                const hasDiscount = config.discountPercent && config.discountPercent > 0
                const isSelected = config.id === selectedConfigId

                return (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => {
                      onSelect(config)
                      setIsOpen(false)
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-card border-b border-border last:border-b-0 transition-colors ${
                      isSelected ? 'bg-card' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{config.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                        </div>
                        
                        <div className="text-sm text-muted-foreground mt-1">
                          Duration: {formatDuration(config.durationMinutes)}
                        </div>

                        {config.includes && (
                          <div className="text-xs text-muted-foreground/60 mt-2 space-y-1">
                            {config.includes.pickup && <div>✓ Pickup from home</div>}
                            {config.includes.dropoff && <div>✓ Dropoff at centre</div>}
                            {config.includes.debriefing && <div>✓ Debriefing call</div>}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-2">
                          Test Centres: {config.testCentres.map(tc => tc.name).join(', ')}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {hasDiscount ? (
                          <div>
                            <div className="text-sm line-through text-muted-foreground/60">
                              ${originalPrice.toFixed(2)}
                            </div>
                            <div className="text-lg font-semibold text-green-500">
                              ${price.toFixed(2)}
                            </div>
                            <div className="text-xs text-emerald-400">
                              Save {config.discountPercent}%
                            </div>
                          </div>
                        ) : (
                          <div className="text-lg font-semibold text-foreground">
                            ${price.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

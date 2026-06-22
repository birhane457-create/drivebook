'use client'

import { useState } from 'react'
import { PenLine, ChevronDown, ChevronUp } from 'lucide-react'
import {
  PDA_FEEDBACK_CODES,
  PDACategory,
  PDASeverity,
  getCategoryDisplayName,
  getSeverityColor,
  getFeedbackByCategory
} from '@/lib/constants/pda-feedback-codes'
import {
  generateFeedbackSummary,
  calculateCategoryScores,
  calculateOverallScore
} from '@/lib/services/lesson-feedback-service'
import WhiteboardCanvas from '@/components/instructor/WhiteboardCanvas'

interface LessonFeedbackFormProps {
  bookingId: string
  instructorId: string
  clientId: string
  onSubmitSuccess?: () => void
}

export default function LessonFeedbackForm({
  bookingId,
  instructorId,
  clientId,
  onSubmitSuccess
}: LessonFeedbackFormProps) {
  const [selectedCodes, setSelectedCodes] = useState<number[]>([])
  const [strengths, setStrengths] = useState('')
  const [areasToImprove, setAreasToImprove] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<PDACategory | null>(null)
  const [whiteboardSketchUrl, setWhiteboardSketchUrl] = useState<string | null>(null)
  const [showWhiteboard, setShowWhiteboard] = useState(false)

  const toggleCode = (code: number) => {
    setSelectedCodes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const handleSubmit = async () => {
    if (selectedCodes.length === 0 && !strengths && !areasToImprove) {
      alert('Please select at least one feedback item or add notes')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/instructor/lesson-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          instructorId,
          clientId,
          feedbackCodes: selectedCodes,
          strengths,
          areasToImprove,
          instructorNotes: notes,
          whiteboardSketchUrl,
        })
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      const data = await response.json()
      alert(`Feedback saved! Overall score: ${data.summary.overallScore}/100`)
      
      // Reset form
      setSelectedCodes([])
      setStrengths('')
      setAreasToImprove('')
      setNotes('')
      
      if (onSubmitSuccess) onSubmitSuccess()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate preview scores
  const categoryScores = calculateCategoryScores(selectedCodes)
  const overallScore = calculateOverallScore(categoryScores)
  const summary = generateFeedbackSummary(selectedCodes)

  // Group categories
  const categories = Object.values(PDACategory)

  // Get severity badge color
  const getSeverityBadge = (severity: PDASeverity) => {
    const colors = {
      [PDASeverity.MINOR]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      [PDASeverity.MODERATE]: 'bg-orange-100 text-orange-800 border-orange-300',
      [PDASeverity.MAJOR]: 'bg-red-100 text-red-800 border-red-300',
      [PDASeverity.CRITICAL]: 'bg-red-200 text-red-900 border-red-400'
    }
    return colors[severity]
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Lesson Feedback</h2>
        <p className="text-gray-600">Tap on any issues observed during the lesson. The system will calculate scores automatically.</p>
      </div>

      {/* Score Preview */}
      {selectedCodes.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 rounded-xl mb-6 shadow-lg">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold">{overallScore}</div>
              <div className="text-sm opacity-90">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedCodes.length}</div>
              <div className="text-sm opacity-90">Issues Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.criticalIssues}</div>
              <div className="text-sm opacity-90">Critical Issues</div>
            </div>
            <div className="text-center">
              {summary.testReady ? (
                <div className="bg-green-500 px-4 py-2 rounded-full font-semibold text-sm">✓ Test Ready</div>
              ) : (
                <div className="bg-yellow-500 px-4 py-2 rounded-full font-semibold text-sm">Keep Practicing</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Categories */}
      <div className="space-y-4 mb-8">
        {categories.map(category => {
          const feedbackItems = getFeedbackByCategory(category)
          const categoryScore = categoryScores[category]
          const isExpanded = expandedCategory === category
          const selectedInCategory = selectedCodes.filter(code => 
            feedbackItems.some(item => item.code === code)
          ).length

          return (
            <div key={category} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl">
                    {category === PDACategory.SIGNAL && '🚦'}
                    {category === PDACategory.LOOK_BEHIND && '👀'}
                    {category === PDACategory.MOVEMENT && '🚗'}
                    {category === PDACategory.PATH && '🛣️'}
                    {category === PDACategory.VEHICLE_MANAGEMENT && '⚙️'}
                    {category === PDACategory.RESPONSIVENESS && '⚡'}
                    {category === PDACategory.FLOW && '🌊'}
                    {category === PDACategory.CRITICAL && '⚠️'}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">{getCategoryDisplayName(category)}</h3>
                    <p className="text-sm text-gray-600">{feedbackItems.length} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {selectedInCategory > 0 && (
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {selectedInCategory} selected
                    </span>
                  )}
                  {selectedCodes.length > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{categoryScore}</div>
                      <div className="text-xs text-gray-600">Score</div>
                    </div>
                  )}
                  <svg
                    className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
                  <div className="grid gap-3">
                    {feedbackItems.map(feedback => {
                      const isSelected = selectedCodes.includes(feedback.code)
                      
                      return (
                        <button
                          key={feedback.code}
                          onClick={() => toggleCode(feedback.code)}
                          className={`text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <h4 className="font-semibold text-gray-900">{feedback.shortText}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full border font-semibold flex-shrink-0 ${getSeverityBadge(feedback.severity)}`}>
                                  {feedback.severity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mb-2">{feedback.fullText}</p>
                              <div className="bg-blue-50 border-l-4 border-blue-400 p-2 rounded">
                                <p className="text-xs text-blue-800">
                                  <strong>💡 Tip:</strong> {feedback.improvementTip}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Additional Notes */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Additional Feedback</h3>
        
        <div>
          <label className="block font-medium text-gray-700 mb-2">
            What did the student do well? ⭐
          </label>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            rows={3}
            placeholder="Highlight positive aspects of their driving..."
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-2">
            Areas to improve 📈
          </label>
          <textarea
            value={areasToImprove}
            onChange={(e) => setAreasToImprove(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            rows={3}
            placeholder="What should they focus on for next lesson..."
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-2">
            Additional notes 📝
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            rows={3}
            placeholder="Any other observations or comments..."
          />
        </div>
      </div>

      {/* Whiteboard Sketch */}
      <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setShowWhiteboard(v => !v)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <PenLine className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Lesson Sketch</p>
              <p className="text-sm text-gray-500">
                {whiteboardSketchUrl
                  ? '✅ Sketch saved — student will see it on their progress page'
                  : 'Draw a diagram to explain the lesson concept (optional)'}
              </p>
            </div>
          </div>
          {showWhiteboard
            ? <ChevronUp className="h-5 w-5 text-gray-400" />
            : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>

        {showWhiteboard && (
          <div className="p-4 border-t border-gray-200">
            <WhiteboardCanvas
              bookingId={bookingId}
              onSave={(url) => setWhiteboardSketchUrl(url)}
            />
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`flex-1 bg-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl ${
            submitting ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
        
        {selectedCodes.length > 0 && (
          <button
            onClick={() => setSelectedCodes([])}
            className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Selected Summary */}
      {selectedCodes.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <p className="font-semibold text-blue-900 mb-2">Selected Issues ({selectedCodes.length}):</p>
          <p className="text-sm text-blue-800">
            Codes: {selectedCodes.sort((a, b) => a - b).join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

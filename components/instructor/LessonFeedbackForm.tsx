'use client'

import { useState } from 'react'
import { PenLine, ChevronDown, ChevronUp, CheckCircle, Target, ClipboardList } from 'lucide-react'
import {
  PDACategory,
  PDASeverity,
  getCategoryDisplayName,
  getFeedbackByCategory
} from '@/lib/constants/pda-feedback-codes'
import {
  generateFeedbackSummary,
  calculateCategoryScores,
  calculateOverallScore
} from '@/lib/services/lesson-feedback-service'
import WhiteboardCanvas from '@/components/instructor/WhiteboardCanvas'

type AssessmentType = 'COACHING' | 'MOCK'

interface LessonFeedbackFormProps {
  bookingId: string
  instructorId: string
  clientId: string
  onSubmitSuccess?: () => void
}

// Common driving lesson topics for coaching sessions
const LESSON_TOPICS = [
  'Roundabouts', 'Parking', 'Reverse parallel park', 'Three-point turn',
  'Lane changing', 'Highway driving', 'Overtaking', 'Intersections',
  'Traffic lights', 'Give way rules', 'Speed management', 'Hazard perception',
  'Night driving', 'Freeway entry/exit', 'Reversing', 'Hill starts', 'Final revision',
]

const ASSESSMENT_TYPE_CONFIG: Record<AssessmentType, {
  label: string; icon: string; description: string; color: string; activeColor: string
}> = {
  COACHING: {
    label: 'Coaching Lesson',
    icon: '🟢',
    description: 'Record topics covered, coaching notes and areas to work on. No score.',
    color: 'border-emerald-500/60 bg-emerald-950/20',
    activeColor: 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/40',
  },
  MOCK: {
    label: 'Mock PDA Assessment',
    icon: '🎯',
    description: 'Formal mock test — score and pass/fail across all categories.',
    color: 'border-blue-500/60 bg-blue-950/20',
    activeColor: 'border-blue-500 bg-blue-950/40 ring-2 ring-blue-500/40',
  },
}

const getSeverityBadge = (severity: PDASeverity) => {
  const colors: Record<PDASeverity, string> = {
    [PDASeverity.MINOR]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    [PDASeverity.MODERATE]: 'bg-orange-100 text-orange-800 border-orange-300',
    [PDASeverity.MAJOR]: 'bg-red-100 text-red-800 border-red-300',
    [PDASeverity.CRITICAL]: 'bg-red-200 text-red-900 border-red-400',
  }
  return colors[severity]
}

export default function LessonFeedbackForm({
  bookingId,
  instructorId,
  clientId,
  onSubmitSuccess,
}: LessonFeedbackFormProps) {
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('COACHING')
  const [selectedCodes, setSelectedCodes] = useState<number[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [strengths, setStrengths] = useState('')
  const [areasToImprove, setAreasToImprove] = useState('')
  const [notes, setNotes] = useState('')
  const [nextLessonFocus, setNextLessonFocus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<PDACategory | null>(null)
  const [whiteboardSketchUrl, setWhiteboardSketchUrl] = useState<string | null>(null)
  const [showWhiteboard, setShowWhiteboard] = useState(false)

  const isMock = assessmentType === 'MOCK'

  const toggleCode = (code: number) => {
    setSelectedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
  }

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic])
  }

  const handleSubmit = async () => {
    if (assessmentType === 'COACHING' && selectedTopics.length === 0 && !strengths && !notes) {
      alert('Please select at least one topic covered, or add coaching notes.')
      return
    }
    if (isMock && selectedCodes.length === 0) {
      alert('A Mock PDA Assessment requires at least one feedback code to be selected.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/instructor/lesson-feedback', {
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
          assessmentType,
          lessonTopics: selectedTopics.join(','),
          nextLessonFocus,
        }),
      })

      if (!res.ok) throw new Error('Failed to submit feedback')
      const data = await res.json()

      if (isMock && data.summary?.overallScore !== null) {
        const passLabel = data.summary.passed ? '✅ PASSED' : '❌ Not yet ready'
        alert(`Mock Assessment saved!\nOverall score: ${data.summary.overallScore}/100\nResult: ${passLabel}`)
      } else {
        alert('Coaching notes saved!')
      }

      setSelectedCodes([])
      setSelectedTopics([])
      setStrengths('')
      setAreasToImprove('')
      setNotes('')
      setNextLessonFocus('')
      if (onSubmitSuccess) onSubmitSuccess()
    } catch {
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const categoryScores = calculateCategoryScores(selectedCodes)
  const overallScore = calculateOverallScore(categoryScores, selectedCodes)
  const summary = generateFeedbackSummary(selectedCodes)
  const categories = Object.values(PDACategory)

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

      {/* ── Assessment type selector ── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Lesson Feedback</h2>
        <p className="text-gray-500 text-sm mb-4">Select the lesson type first — it changes what you record.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(ASSESSMENT_TYPE_CONFIG) as AssessmentType[]).map(type => {
            const cfg = ASSESSMENT_TYPE_CONFIG[type]
            const isActive = assessmentType === type
            return (
              <button
                key={type}
                onClick={() => setAssessmentType(type)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${isActive ? cfg.activeColor : cfg.color + ' hover:opacity-90'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{cfg.icon}</span>
                  <span className="font-semibold text-gray-900 text-sm">{cfg.label}</span>
                  {isActive && <CheckCircle className="h-4 w-4 text-emerald-600 ml-auto" />}
                </div>
                <p className="text-xs text-gray-500 leading-snug">{cfg.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── COACHING: topics covered ── */}
      {!isMock && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Topics Covered Today</h3>
            <span className="text-xs text-gray-400">(select all that apply)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LESSON_TOPICS.map(topic => {
              const active = selectedTopics.includes(topic)
              return (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700 bg-white'
                  }`}
                >
                  {active ? '✓ ' : ''}{topic}
                </button>
              )
            })}
          </div>
          {selectedTopics.length > 0 && (
            <p className="text-xs text-emerald-700 mt-2 font-medium">
              {selectedTopics.length} topic{selectedTopics.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      )}

      {/* ── Mock: score preview ── */}
      {isMock && selectedCodes.length > 0 && (
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-xl shadow-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-4xl font-bold ${overallScore >= 80 ? 'text-green-300' : overallScore >= 65 ? 'text-yellow-300' : 'text-red-300'}`}>
                {overallScore}
              </div>
              <div className="text-sm opacity-80">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedCodes.length}</div>
              <div className="text-sm opacity-80">Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-300">{summary.criticalIssues}</div>
              <div className="text-sm opacity-80">Critical</div>
            </div>
            <div className="flex items-center justify-center">
              {summary.testReady ? (
                <span className="bg-green-500 px-3 py-1.5 rounded-full font-semibold text-sm">✓ Test Ready</span>
              ) : (
                <span className="bg-yellow-500/80 px-3 py-1.5 rounded-full font-semibold text-sm">Not yet ready</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Observed issues (always shown, label changes) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">
            {isMock ? 'PDA Assessment Items' : 'Areas to Work On (Optional)'}
          </h3>
          {!isMock && (
            <span className="text-xs text-gray-400">Select issues observed during the lesson</span>
          )}
        </div>
        <div className="space-y-3">
          {categories.map(category => {
            const feedbackItems = getFeedbackByCategory(category)
            const categoryScore = categoryScores[category]
            const isExpanded = expandedCategory === category
            const selectedInCategory = selectedCodes.filter(code =>
              feedbackItems.some(item => item.code === code)
            ).length

            return (
              <div key={category} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {category === PDACategory.SIGNAL && '🚦'}
                      {category === PDACategory.LOOK_BEHIND && '👀'}
                      {category === PDACategory.MOVEMENT && '🚗'}
                      {category === PDACategory.PATH && '🛣️'}
                      {category === PDACategory.VEHICLE_MANAGEMENT && '⚙️'}
                      {category === PDACategory.RESPONSIVENESS && '⚡'}
                      {category === PDACategory.FLOW && '🌊'}
                      {category === PDACategory.CRITICAL && '⚠️'}
                    </span>
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-900 text-sm">{getCategoryDisplayName(category)}</h4>
                      <p className="text-xs text-gray-500">{feedbackItems.length} items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedInCategory > 0 && (
                      <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                        {selectedInCategory} selected
                      </span>
                    )}
                    {/* Score only shown for mock assessments with codes selected */}
                    {isMock && selectedCodes.length > 0 && (
                      <div className="text-right">
                        <div className={`text-xl font-bold ${categoryScore >= 85 ? 'text-green-600' : categoryScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {categoryScore}
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-gray-50 border-t-2 border-gray-200 space-y-2">
                    {feedbackItems.map(feedback => {
                      const isSelected = selectedCodes.includes(feedback.code)
                      return (
                        <button
                          key={feedback.code}
                          onClick={() => toggleCode(feedback.code)}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                            isSelected ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                            }`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="font-medium text-gray-900 text-sm">{feedback.shortText}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${getSeverityBadge(feedback.severity)}`}>
                                  {feedback.severity}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mb-1.5">{feedback.fullText}</p>
                              <div className="bg-blue-50 border-l-3 border-blue-400 px-2 py-1 rounded text-xs text-blue-800">
                                💡 {feedback.improvementTip}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Coaching notes ── */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">
          {isMock ? 'Examiner Comments' : 'Coaching Notes'}
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isMock ? 'What went well ⭐' : 'What the student did well ⭐'}
          </label>
          <textarea
            value={strengths}
            onChange={e => setStrengths(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 outline-none text-sm"
            rows={2}
            placeholder="Strengths observed..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isMock ? 'Areas where errors occurred 📋' : 'Areas to improve 📈'}
          </label>
          <textarea
            value={areasToImprove}
            onChange={e => setAreasToImprove(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 outline-none text-sm"
            rows={2}
            placeholder={isMock ? 'Errors observed...' : 'What to focus on next...'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes 📝</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 outline-none text-sm"
            rows={2}
            placeholder="Any other observations..."
          />
        </div>
        {!isMock && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next lesson focus 🎯</label>
            <input
              type="text"
              value={nextLessonFocus}
              onChange={e => setNextLessonFocus(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-purple-500 outline-none text-sm"
              placeholder="e.g. Highway merging, reversing practice..."
            />
          </div>
        )}
      </div>

      {/* ── Whiteboard sketch ── */}
      <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowWhiteboard(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <PenLine className="h-4 w-4 text-blue-600" />
            <div className="text-left">
              <p className="font-medium text-gray-900 text-sm">Lesson Sketch</p>
              <p className="text-xs text-gray-500">
                {whiteboardSketchUrl ? '✅ Sketch saved' : 'Draw a diagram to explain the lesson concept (optional)'}
              </p>
            </div>
          </div>
          {showWhiteboard ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showWhiteboard && (
          <div className="p-4 border-t border-gray-200">
            <WhiteboardCanvas bookingId={bookingId} onSave={url => setWhiteboardSketchUrl(url)} />
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`flex-1 py-4 rounded-xl font-bold text-base transition-all shadow-lg ${
            isMock ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          } ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
        >
          {submitting
            ? 'Saving...'
            : isMock
            ? '🎯 Save Mock Assessment'
            : '🟢 Save Coaching Notes'}
        </button>
        {selectedCodes.length > 0 && (
          <button
            onClick={() => setSelectedCodes([])}
            className="px-5 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm"
          >
            Clear codes
          </button>
        )}
      </div>
    </div>
  )
}

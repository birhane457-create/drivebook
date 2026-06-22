'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Pencil, Eraser, Trash2, Undo2, Download, Save, Loader2, CheckCircle } from 'lucide-react'

interface WhiteboardCanvasProps {
  /** Called with the Cloudinary URL after save */
  onSave?: (url: string) => void
  /** Existing sketch URL to pre-load (edit mode) */
  initialSketchUrl?: string | null
  bookingId: string
}

type Tool = 'pen' | 'eraser'

interface Point { x: number; y: number }
interface Stroke { tool: Tool; color: string; width: number; points: Point[] }

const COLORS = ['#1e293b', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed']
const PEN_SIZES = [2, 4, 8]
const ERASER_SIZE = 24

export default function WhiteboardCanvas({ onSave, initialSketchUrl, bookingId }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#1e293b')
  const [penSize, setPenSize] = useState(3)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load initial sketch if provided
  useEffect(() => {
    if (!initialSketchUrl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = initialSketchUrl
  }, [initialSketchUrl])

  // Initialise white background on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Redraw all strokes whenever strokes array changes
  const redraw = useCallback((strokesToDraw: Stroke[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    strokesToDraw.forEach(stroke => drawStroke(ctx, stroke))
  }, [])

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return
    ctx.beginPath()
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color
    ctx.lineWidth = stroke.tool === 'eraser' ? ERASER_SIZE : stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    stroke.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
    ctx.stroke()
  }

  function getPoint(e: React.MouseEvent | React.TouchEvent): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const point = getPoint(e)
    const stroke: Stroke = {
      tool,
      color,
      width: penSize,
      points: [point],
    }
    setCurrentStroke(stroke)
    setIsDrawing(true)
    setRedoStack([]) // clear redo on new stroke
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing || !currentStroke) return
    const point = getPoint(e)
    const updated = { ...currentStroke, points: [...currentStroke.points, point] }
    setCurrentStroke(updated)
    // Draw only the new segment for performance
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pts = updated.points
    if (pts.length >= 2) {
      ctx.beginPath()
      ctx.strokeStyle = updated.tool === 'eraser' ? '#ffffff' : updated.color
      ctx.lineWidth = updated.tool === 'eraser' ? ERASER_SIZE : updated.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.stroke()
    }
  }

  function stopDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing || !currentStroke) return
    const newStrokes = [...strokes, currentStroke]
    setStrokes(newStrokes)
    setCurrentStroke(null)
    setIsDrawing(false)
  }

  function undo() {
    if (strokes.length === 0) return
    const last = strokes[strokes.length - 1]
    const newStrokes = strokes.slice(0, -1)
    setRedoStack([...redoStack, last])
    setStrokes(newStrokes)
    redraw(newStrokes)
  }

  function redo() {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    const newStrokes = [...strokes, next]
    setRedoStack(redoStack.slice(0, -1))
    setStrokes(newStrokes)
    redraw(newStrokes)
  }

  function clearBoard() {
    setStrokes([])
    setRedoStack([])
    redraw([])
  }

  function downloadSketch() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `lesson-sketch-${bookingId}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function saveSketch() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    setError(null)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const res = await fetch('/api/instructor/whiteboard/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Upload failed')
      }
      const { url } = await res.json()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSave?.(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const cursorStyle = tool === 'eraser'
    ? 'cursor-cell'
    : 'cursor-crosshair'

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
        {/* Tool selector */}
        <div className="flex gap-1">
          <button
            onClick={() => setTool('pen')}
            title="Pen"
            className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="Eraser"
            className={`p-2 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>

        {/* Colour picker — only shown in pen mode */}
        {tool === 'pen' && (
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-blue-400 scale-125' : 'border-transparent'}`}
              />
            ))}
          </div>
        )}

        {/* Pen size */}
        {tool === 'pen' && (
          <div className="flex gap-1 items-center">
            {PEN_SIZES.map(s => (
              <button
                key={s}
                onClick={() => setPenSize(s)}
                className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${penSize === s ? 'bg-slate-300' : 'hover:bg-slate-200'}`}
              >
                <span
                  className="rounded-full bg-slate-800 inline-block"
                  style={{ width: s * 2.5, height: s * 2.5 }}
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* History + clear */}
        <button
          onClick={undo}
          disabled={strokes.length === 0}
          title="Undo"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-colors"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={clearBoard}
          title="Clear"
          className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          onClick={downloadSketch}
          title="Download"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <Download className="h-4 w-4" />
        </button>

        {/* Save */}
        <button
          onClick={saveSketch}
          disabled={saving || strokes.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Sketch'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          width={900}
          height={500}
          className={`w-full touch-none ${cursorStyle}`}
          style={{ display: 'block' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {strokes.length === 0 && !initialSketchUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-300 text-sm">Draw a sketch to explain the lesson concept</p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Draw with mouse or finger · Sketch saves to your lesson record and is visible to the student
      </p>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, BookOpen, ChevronRight, Hash, X } from 'lucide-react'

interface PolicyDocument {
  id: string
  title: string
  icon: string
  content: string
}

interface Section {
  id: string
  level: number
  title: string
}

interface SearchResult {
  docId: string
  docTitle: string
  docIcon: string
  sectionTitle: string
  sectionId: string
  snippet: string
}

// ── Markdown → HTML ───────────────────────────────────────────────────────────
function parseMarkdown(md: string): string {
  let html = md
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) =>
    `<pre class="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-x-auto my-3 text-sm text-slate-300"><code>${code.trim()}</code></pre>`
  )

  html = html.replace(/(\|.+\|\n)+/g, (table) => {
    const rows = table.trim().split('\n')
    if (rows.length < 2) return table
    const thCells = rows[0].split('|').filter((_, i, a) => i > 0 && i < a.length - 1)
      .map(c => `<th class="px-4 py-2 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700">${c.trim()}</th>`).join('')
    const trRows = rows.slice(2).map(row =>
      `<tr class="hover:bg-slate-800/40 transition-colors">${
        row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1)
          .map(c => `<td class="px-4 py-2.5 text-sm text-slate-300 border-b border-slate-800">${c.trim()}</td>`).join('')
      }</tr>`
    ).join('')
    return `<div class="overflow-x-auto my-4 rounded-lg border border-slate-700"><table class="w-full text-left border-collapse"><thead class="bg-slate-800/60"><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table></div>`
  })

  html = html.replace(/^(#{1,4})\s+(.+)$/gm, (_, hashes, title) => {
    const level = hashes.length
    const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    const cls: Record<number, string> = {
      1: 'text-2xl font-bold text-slate-100 mt-8 mb-4 pb-2 border-b border-slate-700',
      2: 'text-xl font-bold text-slate-100 mt-7 mb-3',
      3: 'text-base font-semibold text-slate-200 mt-5 mb-2',
      4: 'text-sm font-semibold text-slate-300 mt-4 mb-1.5',
    }
    return `<h${level} id="${id}" class="${cls[level] || cls[4]}">${title}</h${level}>`
  })

  html = html.replace(/^---$/gm, '<hr class="border-slate-700 my-6" />')

  html = html.replace(/^&gt;\s*\*\*(.+?)\*\*\s*(.*)$/gm,
    '<blockquote class="border-l-4 border-blue-500 bg-blue-900/20 px-4 py-3 my-4 rounded-r-lg"><p class="text-sm font-semibold text-blue-300">$1</p><p class="text-sm text-slate-300 mt-1">$2</p></blockquote>')
  html = html.replace(/^&gt;\s+(.+)$/gm,
    '<blockquote class="border-l-4 border-slate-600 bg-slate-800/40 px-4 py-2.5 my-3 rounded-r-lg text-sm text-slate-400">$1</blockquote>')

  html = html.replace(/^- \[ \] (.+)$/gm,
    '<label class="flex items-start gap-2.5 py-1"><input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 cursor-pointer flex-shrink-0" /><span class="text-sm text-slate-300">$1</span></label>')
  html = html.replace(/^- \[x\] (.+)$/gm,
    '<label class="flex items-start gap-2.5 py-1 opacity-60"><input type="checkbox" checked class="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 cursor-pointer flex-shrink-0" /><span class="text-sm text-slate-400 line-through">$1</span></label>')
  html = html.replace(/^- (.+)$/gm, '<li class="text-sm text-slate-300 py-0.5 pl-1">$1</li>')
  html = html.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g,
    '<ul class="list-disc list-inside space-y-0.5 my-2 ml-2">$1</ul>')

  html = html.replace(/`([^`]+)`/g,
    '<code class="bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-700">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em class="text-slate-300">$1</em>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>')

  const lines = html.split('\n')
  return lines.map(line => {
    const t = line.trim()
    if (!t) return ''
    if (t.match(/^<(h[1-4]|ul|li|pre|div|blockquote|hr|label|input|\/|table|thead|tbody|tr|th|td)/)) return t
    return `<p class="text-sm text-slate-300 leading-relaxed my-1.5">${t}</p>`
  }).join('\n')
}

function extractSections(md: string): Section[] {
  const results: Section[] = []
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)$/)
    if (!m) continue
    const title = m[2].replace(/[*_`]/g, '')
    results.push({
      level: m[1].length,
      title,
      id: title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    })
  }
  return results
}

// ── Full-text search across all docs ─────────────────────────────────────────
function searchAllDocs(docs: PolicyDocument[], query: string): SearchResult[] {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const doc of docs) {
    const lines = doc.content.split('\n')
    let currentSection = { title: doc.title, id: '' }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/)
      if (headingMatch) {
        const t = headingMatch[1].replace(/[*_`]/g, '')
        currentSection = {
          title: t,
          id: t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
        }
      }

      if (line.toLowerCase().includes(q) && !headingMatch) {
        // Build a snippet: up to 120 chars around the match
        const idx = line.toLowerCase().indexOf(q)
        const start = Math.max(0, idx - 40)
        const end = Math.min(line.length, idx + q.length + 80)
        let snippet = (start > 0 ? '…' : '') + line.slice(start, end).replace(/[*_`#|]/g, '').trim() + (end < line.length ? '…' : '')

        // Deduplicate: skip if same doc+section already has a result
        const already = results.find(r => r.docId === doc.id && r.sectionId === currentSection.id)
        if (!already) {
          results.push({
            docId: doc.id,
            docTitle: doc.title,
            docIcon: doc.icon,
            sectionTitle: currentSection.title,
            sectionId: currentSection.id,
            snippet,
          })
        }
        if (results.length >= 20) return results
      }
    }
  }
  return results
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPolicyViewer({ documents }: { documents: PolicyDocument[] }) {
  const [activeDoc, setActiveDoc] = useState(documents[0].id)
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const doc = documents.find(d => d.id === activeDoc) ?? documents[0]
  const sections = useMemo(() => extractSections(doc.content), [doc.content])
  const html = useMemo(() => parseMarkdown(doc.content), [doc.content])

  // Full-text search across all docs
  const searchResults = useMemo(() => searchAllDocs(documents, search), [documents, search])
  const isSearching = search.length >= 2

  // Track active section on scroll
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const headings = el.querySelectorAll('h1, h2, h3')
    const observer = new IntersectionObserver(
      entries => { for (const e of entries) { if (e.isIntersecting) { setActiveSection(e.target.id); break } } },
      { rootMargin: '-20% 0% -70% 0%', threshold: 0 }
    )
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [activeDoc])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); window.scrollBy(0, -80) }
  }

  const jumpTo = (docId: string, sectionId: string) => {
    setSearch('')
    if (docId !== activeDoc) {
      setActiveDoc(docId)
      setTimeout(() => scrollToSection(sectionId), 150)
    } else {
      scrollToSection(sectionId)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-64 xl:w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">

        {/* SEARCH — always at the very top */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search all documents…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-7 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {isSearching && (
            <p className="text-xs text-slate-600 mt-1.5 px-1">
              {searchResults.length === 0 ? 'No results' : `${searchResults.length} result${searchResults.length > 1 ? 's' : ''} across all docs`}
            </p>
          )}
        </div>

        {/* Search results panel */}
        {isSearching ? (
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            {searchResults.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">Nothing found for "{search}"</p>
            )}
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => jumpTo(r.docId, r.sectionId)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs">{r.docIcon}</span>
                  <span className="text-xs text-blue-400 font-medium truncate">{r.docTitle}</span>
                </div>
                <p className="text-xs font-semibold text-slate-200 mb-0.5 truncate">{r.sectionTitle}</p>
                <p className="text-xs text-slate-500 leading-snug line-clamp-2">{r.snippet}</p>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Document tabs */}
            <div className="p-2 border-b border-slate-800 space-y-0.5 max-h-48 overflow-y-auto">
              {documents.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveDoc(d.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    activeDoc === d.id
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-sm flex-shrink-0">{d.icon}</span>
                  <span className="text-xs leading-snug truncate">{d.title}</span>
                </button>
              ))}
            </div>

            {/* Section list for active doc */}
            <nav className="flex-1 overflow-y-auto py-2 px-2">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all group ${
                    activeSection === s.id ? 'bg-blue-600/15 text-blue-300' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  } ${s.level === 1 ? 'mt-1.5' : s.level === 2 ? 'pl-4' : 'pl-7'}`}
                >
                  {s.level === 1 && <Hash className="h-3 w-3 flex-shrink-0 text-blue-500" />}
                  {s.level === 2 && <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-600 group-hover:text-slate-400" />}
                  {s.level >= 3 && <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0 ml-0.5" />}
                  <span className={`text-xs leading-snug ${s.level === 1 ? 'font-semibold' : ''}`}>{s.title}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        <div className="p-2 border-t border-slate-800">
          <p className="text-xs text-slate-700 text-center">docs/operations/ · {documents.length} documents</p>
        </div>
      </aside>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-950" ref={contentRef}>
        <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-8 py-3 flex items-center gap-3">
          <BookOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-300">{doc.icon} {doc.title}</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-xs text-blue-400 ml-auto">
            Admin Reference
          </span>
        </div>
        <div className="max-w-4xl mx-auto px-8 py-8" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  )
}

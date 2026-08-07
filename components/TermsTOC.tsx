'use client'

import { useEffect, useState } from 'react'

const sections = [
  { id: 'parties', label: 'Parties' },
  { id: 'term-of-agreement', label: '1. Term of Agreement' },
  { id: 'capacity', label: '2–3. Capacity' },
  { id: 'relationship', label: '4. Relationship of Parties' },
  { id: 'services', label: '5–6. Description of Services' },
  { id: 'business-accounts', label: '6A. Business Accounts' },
  { id: 'ai-services', label: '6B. AI-Assisted Services' },
  { id: 'agreement-by-learner', label: '7–9. Agreement by Learner' },
  { id: 'platform-use', label: '10. Platform Use' },
  { id: 'lessons', label: '11. Lessons' },
  { id: 'payment', label: '12–15. Payment Terms' },
  { id: 'cancellation', label: '16–19. Cancellation & Refunds' },
  { id: 'rescheduling', label: '19A. Rescheduling Policy' },
  { id: 'wallet', label: '20–22. DriveBook Wallet' },
  { id: 'warranty', label: '23–24. Warranty' },
  { id: 'termination', label: '25–26. Events of Termination' },
  { id: 'indemnity', label: '27. Indemnity' },
  { id: 'privacy', label: '28–29. Privacy' },
  { id: 'ip', label: '30. Intellectual Property' },
  { id: 'force-majeure', label: '31. Force Majeure' },
  { id: 'disputes', label: '32. Dispute Resolution' },
  { id: 'modification', label: '33. Modification' },
  { id: 'governing-law', label: '34. Governing Law' },
  { id: 'entire-agreement', label: '35. Entire Agreement' },
  { id: 'liability', label: '36. Limitation of Liability' },
  { id: 'content', label: '37. Content & Reviews' },
  { id: 'no-agency', label: '38. No Agency' },
  { id: 'waiver', label: '39. Waiver' },
  { id: 'severability', label: '40. Severability' },
  { id: 'assignment', label: '41. Assignment' },
  { id: 'data-retention', label: '42. Data Retention' },
  { id: 'sms', label: '43. SMS Communications' },
  { id: 'definitions', label: 'Definitions' },
]

export default function TermsTOC() {
  const [active, setActive] = useState('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <nav className="hidden lg:block w-56 flex-shrink-0">
      <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contents</p>
        <ul className="space-y-0.5">
          {sections.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`block text-sm py-1 px-2 rounded transition-colors ${
                  active === id
                    ? 'text-purple-600 bg-purple-50 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

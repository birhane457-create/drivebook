import { redirect } from 'next/navigation'
import { checkPermission } from '@/lib/rbac/checkPermission'
import { PERM } from '@/lib/rbac/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminAIChat from '@/components/admin/AdminAIChat'
import { QUESTION_CATEGORIES, getDisplayQuestions } from '@/lib/admin/suggested-questions'
import AdminNav from '@/components/admin/AdminNav'
import { AdminPageLayout } from '@/components/ui'

export default async function AdminCopilotPage() {
  const session = await getServerSession(authOptions)
  const permCheck = await checkPermission(session, PERM.PLATFORM_COPILOT_VIEW)
  if (!permCheck.allowed) redirect('/admin')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Operations Copilot" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'T' }]}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Operations Copilot</h1>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Ask anything about platform performance, instructor risk, revenue, or operational issues.
            The copilot queries live data and responds in plain English.
          </p>
        </div>
        <AdminAIChat />
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-muted-foreground">
          {QUESTION_CATEGORIES.map((cat) => {
            const questions = getDisplayQuestions({ category: cat, limit: 4 })
            if (questions.length === 0) return null
            return (
              <div key={cat} className="bg-card border border-border rounded-xl p-4">
                <p className="font-semibold text-muted-foreground mb-2 capitalize">{cat}</p>
                <ul className="space-y-1">
                  {questions.map((q) => (
                    <li key={q.question}>→ {q.question}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        </div>
      </AdminPageLayout>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminNav from '@/components/admin/AdminNav'
import { readFileSync } from 'fs'
import { join } from 'path'
import AdminPolicyViewer from '@/components/admin/AdminPolicyViewer'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin Policy & Operations Manual',
}

export default async function AdminPolicyPage() {
  const session = await getServerSession(authOptions)
  if (
    !session ||
    (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
  ) {
    redirect('/login')
  }

  const opsBase = join(process.cwd(), 'docs', 'operations')
  const legacyBase = join(process.cwd(), 'docs', 'DOCROLEBASE', '00-overview')

  const read = (path: string) => { try { return readFileSync(path, 'utf-8') } catch { return `# File not found\n\`${path}\`` } }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <AdminPolicyViewer
        documents={[
          { id: 'index',        title: 'Manual Index',              icon: '📖', content: read(join(opsBase, 'README.md')) },
          { id: 'governance',   title: '01 Admin Governance',       icon: '🔐', content: read(join(opsBase, '01-admin-governance.md')) },
          { id: 'finance',      title: '02 Finance & Payments',     icon: '💰', content: read(join(opsBase, '02-finance.md')) },
          { id: 'bookings',     title: '03 Booking Operations',     icon: '📅', content: read(join(opsBase, '03-bookings.md')) },
          { id: 'instructors',  title: '04 Instructor Management',  icon: '🧑‍🏫', content: read(join(opsBase, '04-instructors.md')) },
          { id: 'business',     title: '05 Business Tier',          icon: '🏢', content: read(join(opsBase, '05-business-tier.md')) },
          { id: 'ai',           title: '06 AI Operations',          icon: '🤖', content: read(join(opsBase, '06-ai-operations.md')) },
          { id: 'security',     title: '07 Security & Fraud',       icon: '🛡️', content: read(join(opsBase, '07-security-fraud.md')) },
          { id: 'data',         title: '08 Data & Documents',       icon: '📂', content: read(join(opsBase, '08-data-documents.md')) },
          { id: 'emergency',    title: '09 Emergency Runbooks',     icon: '🚨', content: read(join(opsBase, '09-emergency-runbooks.md')) },
          { id: 'audit',        title: '10 Audit & Compliance',     icon: '✅', content: read(join(opsBase, '10-audit-compliance.md')) },
          { id: 'release',      title: '11 Release Management',     icon: '🚀', content: read(join(opsBase, '11-release-management.md')) },
          { id: 'hardcoded',    title: 'Hardcoded Values',          icon: '🔧', content: read(join(legacyBase, 'HARDCODED_VALUES.md')) },
        ]}
      />
    </div>
  )
}

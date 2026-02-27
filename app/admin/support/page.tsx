import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminSupportPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Support & Help</h1>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="/admin/instructors?status=pending"
                className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">👥</span>
                <div>
                  <p className="font-medium text-gray-900">Review Pending Instructors</p>
                  <p className="text-sm text-gray-500">Approve or reject applications</p>
                </div>
              </a>
              <a
                href="/admin/bookings"
                className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">📅</span>
                <div>
                  <p className="font-medium text-gray-900">View All Bookings</p>
                  <p className="text-sm text-gray-500">Monitor platform activity</p>
                </div>
              </a>
              <a
                href="/admin/reviews"
                className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">⭐</span>
                <div>
                  <p className="font-medium text-gray-900">Manage Reviews</p>
                  <p className="text-sm text-gray-500">Moderate flagged content</p>
                </div>
              </a>
              <a
                href="/admin/settings"
                className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mr-3">⚙️</span>
                <div>
                  <p className="font-medium text-gray-900">Platform Settings</p>
                  <p className="text-sm text-gray-500">Configure pricing & features</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Documentation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Documentation</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Platform Owner Guide</h3>
              <p className="text-sm text-gray-600 mb-2">
                Complete guide for managing instructors, subscriptions, and platform operations.
              </p>
              <a href="/PLATFORM_OWNER_GUIDE.md" className="text-sm text-blue-600 hover:text-blue-800">
                View Guide →
              </a>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Project Documentation</h3>
              <p className="text-sm text-gray-600 mb-2">
                Technical documentation covering features, architecture, and setup.
              </p>
              <a href="/PROJECT_DOCUMENTATION.md" className="text-sm text-blue-600 hover:text-blue-800">
                View Documentation →
              </a>
            </div>
          </div>
        </div>

        {/* Common Tasks */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Common Admin Tasks</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-2">Approving New Instructors</h3>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Go to Instructors → Pending tab</li>
                  <li>Review instructor profile and documents</li>
                  <li>Click Approve or Reject with reason</li>
                  <li>Instructor receives email notification</li>
                </ol>
              </div>
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-2">Managing Subscriptions</h3>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>View subscription stats on Overview page</li>
                  <li>Monitor trial users and past due accounts</li>
                  <li>PRO: $29/mo with 12% commission</li>
                  <li>BUSINESS: $59/mo with 7% commission</li>
                </ol>
              </div>
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-2">Handling Support Issues</h3>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Check bookings for cancellations or issues</li>
                  <li>Review flagged reviews for inappropriate content</li>
                  <li>Contact instructors directly via their profile</li>
                  <li>Use admin tools to suspend accounts if needed</li>
                </ol>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Revenue Monitoring</h3>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Monthly subscription revenue shown on Overview</li>
                  <li>Commission tracked per booking (12% or 7%)</li>
                  <li>8% bonus for first booking with new client</li>
                  <li>View detailed revenue in admin/revenue API</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

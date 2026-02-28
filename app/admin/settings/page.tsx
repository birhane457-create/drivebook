import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Platform Settings</h1>

        {/* Subscription Pricing */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Subscription Pricing</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">PRO Tier</h3>
                <p className="text-2xl font-bold text-blue-600 mb-2">$29/month</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 12% commission per booking</li>
                  <li>• 8% bonus for new clients</li>
                  <li>• Google Calendar sync</li>
                  <li>• Basic analytics</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">BUSINESS Tier</h3>
                <p className="text-2xl font-bold text-purple-600 mb-2">$59/month</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 7% commission per booking</li>
                  <li>• 8% bonus for new clients</li>
                  <li>• Priority support</li>
                  <li>• Advanced analytics</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Trial Period:</span> 14 days free for all new instructors
              </p>
            </div>
          </div>
        </div>

        {/* Platform Configuration */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Platform Configuration</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
                <input
                  type="text"
                  defaultValue="DriveBook"
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                <input
                  type="text"
                  defaultValue={process.env.NEXTAUTH_URL || 'Not configured'}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  disabled
                />
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">Note:</span> Platform settings are configured via environment variables. 
                Contact your system administrator to modify these values.
              </p>
            </div>
          </div>
        </div>

        {/* Email Configuration */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Email Configuration</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  defaultValue={process.env.SMTP_HOST || 'Not configured'}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="text"
                  defaultValue={process.env.SMTP_FROM || 'Not configured'}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  disabled
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${process.env.SMTP_HOST ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {process.env.SMTP_HOST ? 'Email service configured' : 'Email service not configured'}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Configuration */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Payment Configuration</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Status</label>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${process.env.STRIPE_SECRET_KEY ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    {process.env.STRIPE_SECRET_KEY ? 'Stripe configured' : 'Stripe not configured'}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Security:</span> Payment credentials are stored securely in environment variables 
                and are not displayed here for security reasons.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

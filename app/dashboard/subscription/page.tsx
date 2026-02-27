import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { SUBSCRIPTION_PLANS, isTrialExpired, SubscriptionTier } from '@/lib/config/subscriptions';

export default async function SubscriptionPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'INSTRUCTOR') {
    redirect('/login');
  }

  const instructor = await prisma.instructor.findUnique({
    where: { userId: session.user.id },
    include: {
      subscriptions: {
        where: { status: { in: ['TRIAL', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!instructor) {
    redirect('/setup');
  }

  const currentSubscription = instructor.subscriptions[0];
  const trialExpired = instructor.trialEndsAt ? isTrialExpired(instructor.trialEndsAt) : false;
  const daysLeftInTrial = instructor.trialEndsAt 
    ? Math.max(0, Math.ceil((new Date(instructor.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Subscription & Billing</h1>
          <p className="mt-2 text-gray-600">
            Choose the plan that works best for your driving instruction business
          </p>
        </div>

        {/* Current Plan Status */}
        {instructor.subscriptionStatus === 'TRIAL' && (
          <div className={`mb-8 rounded-lg p-6 ${trialExpired ? 'bg-red-50 border-2 border-red-200' : 'bg-blue-50 border-2 border-blue-200'}`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {trialExpired ? (
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${trialExpired ? 'text-red-800' : 'text-blue-800'}`}>
                  {trialExpired ? 'Trial Expired' : `Free Trial - ${daysLeftInTrial} days remaining`}
                </h3>
                <div className={`mt-2 text-sm ${trialExpired ? 'text-red-700' : 'text-blue-700'}`}>
                  {trialExpired ? (
                    <p>Your trial has ended. Please select a plan below to continue using the platform.</p>
                  ) : (
                    <>
                      <p>
                        You're currently on a free trial of the {SUBSCRIPTION_PLANS[instructor.subscriptionTier as SubscriptionTier].name} plan.
                        Your trial ends on {new Date(instructor.trialEndsAt!).toLocaleDateString()}.
                      </p>
                      <p className="mt-2 text-xs">
                        💡 To add a payment method now and avoid interruption, click "Start Free Trial" below to enter your payment details. 
                        You won't be charged until your trial ends.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {instructor.subscriptionStatus === 'ACTIVE' && currentSubscription && (
          <div className="mb-8 bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800">
                  Active Subscription - {SUBSCRIPTION_PLANS[instructor.subscriptionTier as SubscriptionTier].name} Plan
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    ${currentSubscription.monthlyAmount}/month • 
                    Renews on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()} •
                    {instructor.commissionRate}% commission per booking
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {instructor.subscriptionStatus === 'PAST_DUE' && (
          <div className="mb-8 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Payment Past Due
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Your last payment failed. Please update your payment method to continue using the platform.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Plans */}
        <SubscriptionPlans
          currentTier={instructor.subscriptionTier}
          currentStatus={instructor.subscriptionStatus}
          instructorId={instructor.id}
        />

        {/* Current Plan Details */}
        {instructor.subscriptionStatus === 'ACTIVE' && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Plan Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Commission Rate</h3>
                <p className="text-2xl font-bold text-gray-900">{instructor.commissionRate}%</p>
                <p className="text-sm text-gray-500">Per booking</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">New Student Bonus</h3>
                <p className="text-2xl font-bold text-gray-900">{instructor.newStudentBonus}%</p>
                <p className="text-sm text-gray-500">Extra for first booking with new students</p>
              </div>
              {instructor.subscriptionTier === 'BUSINESS' && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Domain</h3>
                    <p className="text-sm text-gray-900">
                      {instructor.customDomain || 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Branded Pages</h3>
                    <p className="text-sm text-gray-900">
                      {instructor.brandedBookingPage ? 'Enabled' : 'Not configured'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Billing History */}
        {currentSubscription && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Billing History</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {SUBSCRIPTION_PLANS[instructor.subscriptionTier as SubscriptionTier].name} Plan
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(currentSubscription.currentPeriodStart).toLocaleDateString()} - 
                      {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${currentSubscription.monthlyAmount}
                    </p>
                    <p className="text-sm text-gray-500">
                      {currentSubscription.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

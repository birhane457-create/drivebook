/**
 * usePermissions
 *
 * Thin React wrapper around permissionEngine.getCapabilities().
 * Fetches instructor state once on mount (cached per page load) and
 * returns the derived capability flags.
 *
 * Usage:
 *   const { canCreateBooking, canSendClientReminder } = usePermissions()
 *
 * Returns default-deny capabilities while loading, so UI components
 * show the locked state rather than flashing enabled then disabled.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  getCapabilities,
  type Capabilities,
  type InstructorState,
} from '@/lib/permissions/permissionEngine';

// Default: deny all write capabilities while state is unknown
const LOADING_CAPABILITIES: Capabilities = {
  canCreateBooking:        false,
  canCreateOfflineBooking: false,
  canSendClientReminder:   false,
  canCheckInOut:           false,
  canPublishProfile:       false,
  canReceivePayments:      false,
  canEditSetup:            true,   // always allow setup
};

// Module-level cache — one fetch per session, shared across all hook instances
let cachedCapabilities: Capabilities | null = null;
let fetchPromise: Promise<void> | null = null;

export interface UsePermissionsResult extends Capabilities {
  loading: boolean;
  /** Raw instructor state — available for components that need more than a boolean */
  instructorState: InstructorState | null;
}

export function usePermissions(): UsePermissionsResult {
  const { data: session } = useSession();
  const [capabilities, setCapabilities] = useState<Capabilities>(
    cachedCapabilities ?? LOADING_CAPABILITIES
  );
  const [instructorState, setInstructorState] = useState<InstructorState | null>(null);
  const [loading, setLoading] = useState(cachedCapabilities === null);

  useEffect(() => {
    if (!session?.user?.instructorId) {
      setLoading(false);
      return;
    }

    // Already cached — use immediately
    if (cachedCapabilities !== null) {
      setCapabilities(cachedCapabilities);
      setLoading(false);
      return;
    }

    // Deduplicate: if a fetch is already in flight, wait for it
    if (!fetchPromise) {
      fetchPromise = (async () => {
        try {
          // Profile now returns approvalStatus, subscriptionStatus, and trialEndsAt
          const profileRes = await fetch('/api/instructor/profile');
          const profile = profileRes.ok ? await profileRes.json() : {};

          const trialEndsAt: string | null = profile.trialEndsAt ?? null;
          const trialExpired = trialEndsAt ? new Date(trialEndsAt) < new Date() : false;

          const state: InstructorState = {
            approvalStatus:     profile.approvalStatus     ?? null,
            subscriptionStatus: profile.subscriptionStatus ?? null,
            trialExpired,
          };

          const caps = getCapabilities(state);
          cachedCapabilities = caps;

          // Update all mounted hook instances
          setCapabilities(caps);
          setInstructorState(state);
        } catch {
          // Fail open — if we can't determine state, don't block the instructor
          const openState: InstructorState = {
            approvalStatus: 'APPROVED',
            subscriptionStatus: 'ACTIVE',
            trialExpired: false,
          };
          cachedCapabilities = getCapabilities(openState);
          setCapabilities(cachedCapabilities);
        } finally {
          setLoading(false);
          fetchPromise = null;
        }
      })();
    } else {
      fetchPromise.then(() => {
        if (cachedCapabilities) {
          setCapabilities(cachedCapabilities);
          setLoading(false);
        }
      });
    }
  }, [session?.user?.instructorId]);

  return { ...capabilities, loading, instructorState };
}

/**
 * Reset the permission cache.
 * Call after the instructor's approval status changes
 * (e.g. after admin approves via the admin panel, or after Stripe webhook fires).
 */
export function resetPermissionsCache() {
  cachedCapabilities = null;
  fetchPromise = null;
}

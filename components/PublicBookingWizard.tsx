'use client';

/**
 * PublicBookingWizard
 * Thin client wrapper that provides BookingContext + renders SubdomainBookingWizard
 * inline on the /book/[instructorId] page (white background, not a dark overlay).
 *
 * The parent RSC (app/book/[instructorId]/page.tsx) passes provider data as props;
 * this component cannot do DB calls itself.
 */

import { BookingProvider } from '@/lib/contexts/BookingContext';
import SubdomainBookingWizard from '@/components/subdomain/SubdomainBookingWizard';

interface PublicBookingWizardProps {
  provider: {
    id: string;
    name: string;
    displayName?: string;
    profileImage: string | null;
    hourlyRate: number;
    averageRating: number | null;
    totalReviews: number;
    offersTestPackage: boolean;
    testPackagePrice: number | null;
    testPackageDuration: number | null;
    testPackageIncludes: string[];
    allowedDurations?: number[];
  };
  /** Brand primary colour — passed down to wizard progress bar and buttons */
  primary: string;
}

export default function PublicBookingWizard({ provider, primary }: PublicBookingWizardProps) {
  return (
    /**
     * Add the `dark` class here so that SubdomainBookingWizard's CSS variables
     * (text-foreground, bg-background, border-border, etc.) resolve to dark-mode
     * values inside this widget, matching the visual style of the subdomain wizard.
     *
     * The outer page remains light-mode — only this widget switches colour scheme.
     */
    <div className="dark rounded-xl bg-slate-900 p-6 shadow-xl">
      <BookingProvider>
        <SubdomainBookingWizard provider={provider} primary={primary} />
      </BookingProvider>
    </div>
  );
}

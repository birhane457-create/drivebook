// Legacy page - disabled for deployment
'use client';

import { useRouter } from 'next/navigation';

export default function ClientDetailsPage() {
  const router = useRouter();
  
  // Redirect to main booking page
  if (typeof window !== 'undefined') {
    router.push('/book');
  }
  
  return null;
}

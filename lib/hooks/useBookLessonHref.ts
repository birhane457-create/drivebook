'use client';

import { useState, useEffect } from 'react';

/**
 * Returns the correct "Book a Lesson" href.
 * If the client has a current instructor, returns the URL with ?instructorId=<id>
 * so the booking flow skips straight to step 3 (services).
 * Otherwise returns the plain URL (step 1 — location search).
 */
export function useBookLessonHref() {
  const [href, setHref] = useState('/client-dashboard/book-lesson');

  useEffect(() => {
    fetch('/api/client/current-instructor')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.currentInstructor?.id) {
          setHref(`/client-dashboard/book-lesson?instructorId=${data.currentInstructor.id}`);
        }
      })
      .catch(() => {});
  }, []);

  return href;
}

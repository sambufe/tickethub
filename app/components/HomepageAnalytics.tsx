'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';

export default function HomepageAnalytics() {
  useEffect(() => {
    posthog.capture('homepage_viewed');
  }, []);
  return null;
}

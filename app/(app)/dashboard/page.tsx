import { Suspense } from 'react';
import DashboardView from './DashboardView';

export default function Page() {
  return (
    <Suspense fallback={<div className="state">Loading…</div>}>
      <DashboardView />
    </Suspense>
  );
}

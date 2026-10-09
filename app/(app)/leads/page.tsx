import { Suspense } from 'react';
import LeadsView from './LeadsView';

export default function Page() {
  return (
    <Suspense fallback={<div className="state">Loading…</div>}>
      <LeadsView />
    </Suspense>
  );
}

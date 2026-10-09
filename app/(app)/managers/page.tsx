import { Suspense } from 'react';
import ManagersView from './ManagersView';

export default function Page() {
  return (
    <Suspense fallback={<div className="state">Loading…</div>}>
      <ManagersView />
    </Suspense>
  );
}

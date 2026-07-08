import { Suspense } from "react";
import { VerifierView } from "@/features/console/views/verifier-view";

export default function VerifierPage() {
  return (
    <Suspense fallback={<div className="empty">Loading verifier...</div>}>
      <VerifierView />
    </Suspense>
  );
}

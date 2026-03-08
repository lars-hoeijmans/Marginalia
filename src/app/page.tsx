"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import App from "@/components/App";
import QuickCapture from "@/components/QuickCapture";

function PageRouter() {
  const params = useSearchParams();

  // Electrobun: preload bridge sets __QUICK_CAPTURE__ before page scripts run
  // Electron: uses ?quick-capture=1 query param
  const isQC =
    (typeof window !== "undefined" &&
      !!(window as unknown as Record<string, unknown>).__QUICK_CAPTURE__) ||
    params.get("quick-capture") === "1";

  if (isQC) {
    return <QuickCapture />;
  }

  return <App />;
}

export default function Page() {
  return (
    <Suspense>
      <PageRouter />
    </Suspense>
  );
}

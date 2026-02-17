"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import App from "@/components/App";
import QuickCapture from "@/components/QuickCapture";

function PageRouter() {
  const params = useSearchParams();

  if (params.get("quick-capture") === "1") {
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

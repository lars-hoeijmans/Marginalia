"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import App from "@/components/App";
import QuickCapture from "@/components/QuickCapture";

function PageRouter() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"loading" | "app" | "quick-capture">(
    "loading"
  );

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    if (win.__QUICK_CAPTURE__ || params.get("quick-capture") === "1") {
      setMode("quick-capture");
    } else {
      setMode("app");
    }
  }, [params]);

  if (mode === "loading") return null;
  if (mode === "quick-capture") return <QuickCapture />;
  return <App />;
}

export default function Page() {
  return (
    <Suspense>
      <PageRouter />
    </Suspense>
  );
}

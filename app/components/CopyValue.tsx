"use client";
import { useState } from "react";
export function CopyValue({ value, label, copied, failed }: { value: string; label: string; copied: string; failed: string }) {
  const [status, setStatus] = useState("");
  return <div className="copy-value"><code dir="ltr">{value}</code><button type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setStatus(copied); } catch { setStatus(failed); }
  }}>{label}</button><span role="status">{status}</span></div>;
}

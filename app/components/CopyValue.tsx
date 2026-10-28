"use client";
import { useState } from "react";
export function CopyValue({ value, label, copied, failed, donationMethod }: { value: string; label: string; copied: string; failed: string; donationMethod?: string }) {
  const [status, setStatus] = useState("");
  return <div className="copy-value"><code dir="ltr">{value}</code><button type="button" onClick={async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(copied);
      if (donationMethod) {
        const analytics = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
        analytics?.('event', 'donation_copy', { donation_method: donationMethod });
      }
    } catch { setStatus(failed); }
  }}>{label}</button><span role="status">{status}</span></div>;
}

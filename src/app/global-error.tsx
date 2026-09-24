"use client";

import { useEffect } from "react";

/*
 * The last resort: an error thrown by the root layout itself,
 * before Header, Footer or any provider exists. It has to
 * supply its own <html> and <body>, and cannot use anything
 * from the design system - the stylesheet may be exactly what
 * failed to load - so the styles here are inline on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#fafafa",
          color: "#171717",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px" }}>
            Lamees is temporarily unavailable
          </h1>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#737373",
              margin: "0 0 24px",
            }}
          >
            We hit an unexpected problem loading the store. Please try again in a moment.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#ffffff",
              background: "#F97316",
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          {error.digest && (
            <p
              style={{
                marginTop: 28,
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                color: "#a3a3a3",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

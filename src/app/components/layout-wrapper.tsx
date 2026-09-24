"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/src/app/components/header";
import { WhatsAppButton } from "@/src/app/components/whatsapp-button";
import type React from "react";

export function LayoutWrapper({
  children,
  /*
   * The rendered footer, handed in from the server layout
   * rather than imported here.
   *
   * This file is "use client", so anything it imports is
   * client too - which was dragging 280 lines of entirely
   * static markup, and its icons, into every visitor's bundle
   * for a component with no state and no handlers. Taking it as
   * a node keeps it on the server, and incidentally removes the
   * `year` prop this component only ever forwarded.
   */
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname ? pathname.startsWith("/admin") : false;

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      {footer}

      {/* Storefront only - the admin branch above returns early. */}
      <WhatsAppButton />
    </>
  );
}

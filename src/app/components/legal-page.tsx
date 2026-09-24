/*
 * ---------------------------------------------------------
 * LEGAL PAGE
 * ---------------------------------------------------------
 *
 * One layout for Privacy, Terms and Shipping. They are the
 * same shape - a title, an intro, and a run of headed
 * sections - so they share a renderer rather than three
 * near-identical files.
 */

import { Container } from "@/src/app/components/ui/container";
import { PolicySections } from "@/src/app/components/policy-sections";
import { LEGAL_UPDATED } from "@/src/app/lib/legal";
import type { PolicyDocument } from "@/src/app/lib/policy";
import Link from "next/link";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export function LegalPage({ document }: { document: PolicyDocument }) {
  return (
    <Container className="py-12 lg:py-16">
      <header className="mb-12 max-w-2xl">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">{document.title}</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{document.title}</h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">{document.intro}</p>

        <p className="mt-4 text-xs text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
      </header>

      <PolicySections sections={document.sections} />
    </Container>
  );
}

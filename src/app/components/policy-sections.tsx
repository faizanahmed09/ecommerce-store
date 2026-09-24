/*
 * The body of a policy page: headed sections, each with
 * paragraphs and an optional list.
 *
 * Shared by /returns and by the Privacy, Terms and Shipping
 * pages, which were rendering identical markup from two
 * separate copies of it.
 */

import type { PolicySection } from "@/src/app/lib/policy";

export function PolicySections({ sections }: { sections: PolicySection[] }) {
  return (
    <div className="max-w-2xl space-y-10">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>

          {section.body?.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground">
              {paragraph}
            </p>
          ))}

          {section.points && (
            <ul className="mt-4 space-y-2">
              {section.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

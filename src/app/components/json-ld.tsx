import { serializeJsonLd } from "@/src/app/lib/seo";

/*
 * schema.org structured data, as Next's JSON-LD guide renders
 * it: a plain script tag in the page, escaped in seo.ts.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

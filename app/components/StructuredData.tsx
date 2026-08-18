import type { JsonLd } from "../lib/seo";

/**
 * Emits JSON-LD. Server-rendered on purpose: structured data that only appears
 * after hydration is structured data a crawler may never see.
 *
 * `</` is escaped because a `</script>` sequence inside the payload — a Latin
 * term or a condition name would be enough — would otherwise close the tag early
 * and break the page.
 */
export function StructuredData({ graphs }: { graphs: JsonLd[] }) {
  return (
    <>
      {graphs.map((graph, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}

import type { CategoryRecord } from "@/src/app/lib/categories";
import { childSegment } from "@/src/app/lib/navigation";
import Link from "next/link";

export function CollectionSubcategories({
  parent,
  categories,
  activeId,
}: {
  parent: CategoryRecord;
  categories: CategoryRecord[];
  activeId?: string;
}) {
  if (categories.length === 0) return null;

  const links = [
    { id: parent.id, name: `All ${parent.name}`, href: `/${parent.slug}` },
    ...categories.map((child) => ({
      id: child.id,
      name: child.name,
      href: `/${parent.slug}/${childSegment(child.slug, parent.slug)}`,
    })),
  ];

  return (
    <nav aria-label={`${parent.name} subcategories`} className="mt-8 border-t border-neutral-200">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 py-3 text-xs uppercase tracking-[0.05em] sm:gap-x-8 sm:gap-y-2 sm:py-4 sm:text-sm sm:tracking-[0.12em]">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              href={link.href}
              aria-current={link.id === (activeId ?? parent.id) ? "page" : undefined}
              className={`inline-block border-b-2 py-1 transition-colors ${link.id === (activeId ?? parent.id) ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-400 hover:text-neutral-900"}`}
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/src/app/lib/utils";

/**
 * The storefront's "nothing here" panel.
 *
 * The account tabs used to paper over an empty result with sample rows, which
 * meant a shopper with no orders was shown five invented ones. This is what
 * they show instead, and it doubles as the failure state — a load that broke
 * says so, and offers a retry, rather than quietly inventing data.
 */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center",
        className,
      )}
    >
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/40" />

      <p className="font-medium">{title}</p>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

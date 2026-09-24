import { cn } from "@/src/app/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type React from "react";

/*
 * ---------------------------------------------------------
 * PAGE SHELL
 * ---------------------------------------------------------
 *
 * The header and footer are already centred on max-w-7xl.
 * These wrappers keep every page on the same measure, so
 * content lines up with the chrome above and below it instead
 * of running edge to edge.
 */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

interface SectionHeadingProps {
  /* Small label above the title, e.g. "Handpicked". */
  eyebrow?: string;
  title: string;
  description?: string;
  /* Optional "view all" style link on the right. */
  actionHref?: string;
  actionLabel?: string;
  align?: "left" | "center";
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  align = "left",
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:mb-10",
        centered
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className={cn(centered && "max-w-2xl")}>
        {eyebrow && (
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </span>
        )}

        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>

        {description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>

      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground/70"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* Consistent vertical rhythm between homepage sections. */
export function Section({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("py-14 sm:py-16 lg:py-20", className)}>
      {children}
    </section>
  );
}

import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { Compass } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Page Not Found | Lamees",
};

/*
 * The 404 every notFound() lands on: an unknown department, a
 * category whose row is gone, a product that has been delisted.
 * It offers a way back into the store rather than a dead end.
 *
 * NOTE: do not add a loading.tsx to any route that can call
 * notFound(). It opens a Suspense boundary, the shell is
 * flushed with a 200 before the page resolves, and this page
 * then renders under that status - a soft 404, which search
 * engines treat as a thin duplicate rather than a removal.
 * Measured: with loading.tsx, /footwear returned 200; without
 * it, 404.
 */
export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 rounded-full bg-muted p-4">
        <Compass className="h-10 w-10 text-muted-foreground" />
      </div>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        We couldn&apos;t find that page
      </h1>

      <p className="mb-8 max-w-md text-sm leading-6 text-muted-foreground">
        The link may be out of date, or the collection it pointed to is no
        longer part of the store.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/products">Browse all products</Link>
        </Button>

        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </Container>
  );
}

/*
 * Shown the moment this route is clicked, until the server
 * responds. See components/listing-skeleton.tsx.
 */
import { ListingSkeleton } from "@/src/app/components/listing-skeleton";

export default function Loading() {
  return <ListingSkeleton />;
}

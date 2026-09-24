"use client";

/*
 * ---------------------------------------------------------
 * BOOK A SHIPMENT
 * ---------------------------------------------------------
 *
 * Pick an enabled courier and hand the order to it.
 *
 * The credentials are not here and cannot be: they live in env
 * vars read by /api/admin/shipments on the server. This
 * component knows only which couriers are switched on, which is
 * the one thing about them that is safe to read in a browser.
 *
 * The route is the authority on everything else - whether the
 * caller is staff, whether the city is serviceable, whether an
 * active shipment already exists - so its refusals are shown
 * verbatim rather than guessed at here.
 */

import { Button } from "@/src/app/components/ui/button";
import { createClient } from "@/src/app/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";
import { useEffect, useState } from "react";

interface Courier {
  code: string;
  name: string;
}

export function BookShipment({
  orderId,
  trackingNumber,
  onBooked,
}: {
  orderId: string;
  /* Already booked: the control becomes a statement of fact. */
  trackingNumber: string | null;
  onBooked: () => void;
}) {
  const { toast } = useToast();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courier, setCourier] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    let active = true;

    void createClient()
      .from("couriers")
      .select("code, name")
      .eq("enabled", true)
      .order("sort_order")
      .then(({ data }) => {
        if (!active) return;

        const rows = (data ?? []) as Courier[];

        setCouriers(rows);
        setCourier((current) => current || rows[0]?.code || "");
      });

    return () => {
      active = false;
    };
  }, []);

  if (trackingNumber) {
    return (
      <p className="text-sm text-neutral-600">
        Booked — <span className="font-mono">{trackingNumber}</span>
      </p>
    );
  }

  if (couriers.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No courier is enabled yet. Switch one on in the couriers table first.
      </p>
    );
  }

  const book = async () => {
    setBooking(true);

    try {
      /*
       * The route reads the caller's own token, so it acts as
       * this admin rather than as a service role.
       */
      const {
        data: { session },
      } = await createClient().auth.getSession();

      const response = await fetch("/api/admin/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ orderId, courierCode: courier }),
      });

      const payload = (await response.json()) as {
        error?: string;
        notified?: boolean;
        shipment?: { tracking_number: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "The booking failed.");
      }

      toast({
        title: `Booked — ${payload.shipment?.tracking_number ?? "no number returned"}`,
        description: payload.notified
          ? "The customer has been emailed the tracking link."
          : "The customer could not be emailed; the parcel is booked.",
      });

      onBooked();
    } catch (error: unknown) {
      toast({
        title: "Could not book this shipment",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={courier}
        onChange={(event) => setCourier(event.target.value)}
        disabled={booking}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm"
        aria-label="Courier"
      >
        {couriers.map((row) => (
          <option key={row.code} value={row.code}>
            {row.name}
          </option>
        ))}
      </select>

      <Button type="button" size="sm" onClick={() => void book()} disabled={booking || !courier}>
        <Truck className="mr-1 h-4 w-4" />
        {booking ? "Booking..." : "Book shipment"}
      </Button>
    </div>
  );
}

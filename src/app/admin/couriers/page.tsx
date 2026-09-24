"use client";

/*
 * ---------------------------------------------------------
 * ADMIN / COURIERS
 * ---------------------------------------------------------
 *
 * Which couriers the shop offers, and their city lists.
 *
 * Enabling one used to mean running SQL by hand. Two things
 * live here and nothing else:
 *
 *  - the on/off switch, which is what "the shop picks one or
 *    more" actually means
 *  - the city sync, without which every booking is refused:
 *    couriers do not accept a free-text city, so an empty
 *    courier_cities makes nothing serviceable
 *
 * Credentials are deliberately absent. They are env vars read
 * on the server; a form here would put them in the browser and
 * then in Postgres, which is the one place they must never be.
 */

import { Button } from "@/src/app/components/ui/button";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/src/app/lib/supabase/client";
import { RefreshCw } from "lucide-react";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import { useCallback, useState } from "react";

interface CourierRow {
  code: string;
  name: string;
  enabled: boolean;
  cities: number;
}

/* One shared empty array, so the fallback never retriggers a render. */
const NO_COURIERS: CourierRow[] = [];

export default function AdminCouriersPage() {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");

  /*
   * Through useAsyncData rather than an effect of its own: the
   * hook owns the loading flag and the unmounted-component
   * guard, and calling setState straight out of an effect is
   * what the React Compiler rule exists to stop.
   */
  const fetcher = useCallback(async (): Promise<CourierRow[]> => {
    const supabase = createClient();

    const [{ data: couriers }, { data: cities }] = await Promise.all([
      supabase.from("couriers").select("code, name, enabled").order("sort_order"),
      supabase.from("courier_cities").select("courier_code"),
    ]);

    /* One read for the counts, not one per courier. */
    const counted = new Map<string, number>();

    for (const city of cities ?? []) {
      counted.set(city.courier_code, (counted.get(city.courier_code) ?? 0) + 1);
    }

    return (couriers ?? []).map((courier) => ({
      ...courier,
      cities: counted.get(courier.code) ?? 0,
    }));
  }, []);

  const {
    data: rows,
    loading,
    reload,
  } = useAsyncData<CourierRow[]>(fetcher, {
    fallback: NO_COURIERS,
    onError: (error) => console.error("Could not read couriers:", error),
  });

  const toggle = async (courier: CourierRow) => {
    setBusy(courier.code);

    const { error } = await createClient()
      .from("couriers")
      .update({ enabled: !courier.enabled })
      .eq("code", courier.code);

    setBusy("");

    if (error) {
      toast({ title: "Could not change that", description: error.message, variant: "destructive" });
      return;
    }

    reload();
  };

  const syncCities = async (courier: CourierRow) => {
    setBusy(courier.code);

    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();

      const response = await fetch("/api/admin/couriers/cities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ courierCode: courier.code }),
      });

      const payload = (await response.json()) as { error?: string; synced?: number };

      if (!response.ok) {
        throw new Error(payload.error ?? "The sync failed.");
      }

      toast({ title: `${courier.name}: ${payload.synced} cities synced` });
      reload();
    } catch (error: unknown) {
      toast({
        title: `Could not sync ${courier.name}`,
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Couriers</h1>

        <p className="mt-1 text-sm text-neutral-500">
          Switch on the couriers you have an account with. API credentials are set as environment
          variables on the server, never here.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((courier) => (
            <div
              key={courier.code}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4"
            >
              <div>
                <p className="font-medium">{courier.name}</p>

                <p className="mt-0.5 text-xs text-neutral-500">
                  {courier.enabled ? "Enabled" : "Disabled"} &middot;{" "}
                  {courier.cities === 0 ? (
                    <span className="text-amber-600">
                      no cities synced — bookings will be refused
                    </span>
                  ) : (
                    `${courier.cities} cities`
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy === courier.code}
                  onClick={() => void syncCities(courier)}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Sync cities
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={courier.enabled ? "outline" : "default"}
                  disabled={busy === courier.code}
                  onClick={() => void toggle(courier)}
                >
                  {courier.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/*
 * ---------------------------------------------------------
 * SIZE GUIDE
 * ---------------------------------------------------------
 *
 * A link beside the size picker that opens the measurement
 * tables. The figures live in lib/size-guide, so this file is
 * only how they are shown.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/app/components/ui/dialog";
import {
  formatMeasurement,
  SIZE_CHARTS,
  SIZES,
  UNITS,
  type SizeChart,
  type Unit,
} from "@/src/app/lib/size-guide";
import { cn } from "@/src/app/lib/utils";
import { Ruler } from "lucide-react";
import { useState } from "react";

export function SizeGuide({ productName }: { productName: string }) {
  const [unit, setUnit] = useState<Unit>("cm");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Ruler className="h-3.5 w-3.5" />
          Size guide
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>Size charts</DialogDescription>
        </DialogHeader>

        {/* The tables scroll, the header and its close button do not. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <UnitToggle unit={unit} onChange={setUnit} />

          <div className="mt-6 space-y-8">
            {SIZE_CHARTS.map((chart) => (
              <ChartTable key={chart.garment} chart={chart} unit={unit} />
            ))}
          </div>

          <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
            Measurements are of the garment itself, in {unit === "cm" ? "centimetres" : "inches"}.
            Compare them against a piece you already own for the closest fit.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (unit: Unit) => void }) {
  return (
    <div
      role="group"
      aria-label="Measurement unit"
      className="mx-auto flex w-fit items-center rounded-full border p-0.5"
    >
      {UNITS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={unit === option.value}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
            unit === option.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChartTable({ chart, unit }: { chart: SizeChart; unit: Unit }) {
  return (
    <section>
      <h3 className="mb-3 text-center text-sm font-semibold">{chart.garment}</h3>

      {/* A narrow screen scrolls the table, never the page. */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Size
              </th>

              {SIZES.map((size) => (
                <th
                  key={size}
                  scope="col"
                  className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider"
                >
                  {size}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {chart.rows.map((row) => (
              <tr key={row.label} className="even:bg-muted/20">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-foreground">
                  {row.label}
                </th>

                {row.cm.map((value, index) => (
                  <td
                    key={SIZES[index]}
                    className="px-4 py-2.5 text-center tabular-nums text-muted-foreground"
                  >
                    {formatMeasurement(value, unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

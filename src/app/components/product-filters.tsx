"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/src/app/components/ui/accordion";
import { Button } from "@/src/app/components/ui/button";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { Slider } from "@/src/app/components/ui/slider";
import type { VariantGroup } from "@/src/app/lib/products";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

interface ProductFiltersProps {
  /* Accepted for call-site compatibility; not used to scope options yet. */
  categoryId?: string;
  /*
   * The sizes and colours to offer, read on the server from a
   * cached scope (lib/catalogue.ts) - one query shared by every
   * visitor rather than one per visitor per listing page.
   *
   * Required: the rail used to fetch these itself, which meant
   * shipping the query to the browser and rendering a skeleton
   * while it ran. Making it a prop keeps both out of the client.
   */
  options: VariantGroup[];
  showPieceFilter?: boolean;
}

const MIN_PRICE = 0;
const MAX_PRICE = 10000;

/* Values are carried in the URL as ?variants=m,black */
const VARIANTS_PARAM = "variants";

const CSS_COLORS = new Set([
  "black",
  "white",
  "red",
  "blue",
  "green",
  "yellow",
  "navy",
  "grey",
  "gray",
  "brown",
  "beige",
  "pink",
  "purple",
  "orange",
  "maroon",
  "teal",
]);

export function ProductFilters({ options, showPieceFilter = false }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [priceRange, setPriceRange] = useState<number[]>([
    Number.parseInt(searchParams.get("minPrice") || String(MIN_PRICE), 10),
    Number.parseInt(searchParams.get("maxPrice") || String(MAX_PRICE), 10),
  ]);

  const variantGroups = options;

  const [selectedValues, setSelectedValues] = useState<string[]>(
    searchParams.get(VARIANTS_PARAM)?.split(",").filter(Boolean) ?? []
  );
  const pieceCount = searchParams.get("pieces") ?? "";

  const setPieceCount = (value: "" | "2" | "3") => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("pieces", value);
    } else {
      params.delete("pieces");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const toggleValue = (value: string) => {
    setSelectedValues((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    );
  };

  const accordionSections = useMemo(
    () => [...(showPieceFilter ? ["pieces"] : []), "price", ...variantGroups.map((group) => group.name)],
    [variantGroups, showPieceFilter]
  );

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (priceRange[0] > MIN_PRICE) {
      params.set("minPrice", String(priceRange[0]));
    } else {
      params.delete("minPrice");
    }

    if (priceRange[1] < MAX_PRICE) {
      params.set("maxPrice", String(priceRange[1]));
    } else {
      params.delete("maxPrice");
    }

    if (selectedValues.length > 0) {
      params.set(VARIANTS_PARAM, selectedValues.join(","));
    } else {
      params.delete(VARIANTS_PARAM);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const resetFilters = () => {
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setSelectedValues([]);
    router.push(pathname);
  };

  /* Keep the two number inputs inside the slider bounds. */
  const setBound = (index: 0 | 1, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) ? parsed : index === 0 ? MIN_PRICE : MAX_PRICE;

    setPriceRange((current) =>
      index === 0
        ? [Math.min(Math.max(value, MIN_PRICE), current[1]), current[1]]
        : [current[0], Math.max(Math.min(value, MAX_PRICE), current[0])]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>

        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={accordionSections} className="w-full">
        {showPieceFilter && (
          <AccordionItem value="pieces">
            <AccordionTrigger>Pieces</AccordionTrigger>
            <AccordionContent>
              <div key={pieceCount} className="space-y-2">
                {(["", "2", "3"] as const).map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="piece-count"
                      value={value}
                      defaultChecked={pieceCount === value}
                      onChange={() => setPieceCount(value)}
                      className="accent-neutral-900"
                    />
                    {value === "" ? "All pieces" : `${value} Piece`}
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="price">
          <AccordionTrigger>Price Range</AccordionTrigger>

          <AccordionContent>
            <div className="space-y-4">
              <Slider
                value={priceRange}
                min={MIN_PRICE}
                max={MAX_PRICE}
                step={100}
                onValueChange={setPriceRange}
              />

              <div className="flex items-center justify-between gap-2">
                <div className="w-24">
                  <Input
                    type="number"
                    aria-label="Minimum price"
                    value={priceRange[0]}
                    onChange={(e) => setBound(0, e.target.value)}
                    min={MIN_PRICE}
                    max={priceRange[1]}
                  />
                </div>

                <span className="text-sm text-muted-foreground">to</span>

                <div className="w-24">
                  <Input
                    type="number"
                    aria-label="Maximum price"
                    value={priceRange[1]}
                    onChange={(e) => setBound(1, e.target.value)}
                    min={priceRange[0]}
                    max={MAX_PRICE}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/*
          No skeleton: the options arrive with the page, already
          rendered, so there is never a frame without them.
        */}
        {variantGroups.map((group) => (
          <AccordionItem key={group.name} value={group.name}>
            <AccordionTrigger>{group.name}</AccordionTrigger>

            <AccordionContent>
              <div className="grid grid-cols-2 gap-2">
                {group.values.map((variant) => {
                  const swatch = CSS_COLORS.has(variant.value.toLowerCase())
                    ? variant.value.toLowerCase()
                    : null;

                  const inputId = `filter-${group.name}-${variant.value}`;

                  return (
                    <div key={inputId} className="flex items-center space-x-2">
                      <Checkbox
                        id={inputId}
                        checked={selectedValues.includes(variant.value)}
                        onCheckedChange={() => toggleValue(variant.value)}
                      />

                      <Label htmlFor={inputId} className="flex cursor-pointer items-center">
                        {swatch && (
                          <span
                            aria-hidden="true"
                            className="mr-2 inline-block h-4 w-4 rounded-full border"
                            style={{ backgroundColor: swatch }}
                          />
                        )}
                        {variant.value}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {variantGroups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No product options are defined yet; use the available filters above.
        </p>
      )}

      <Button onClick={applyFilters} className="w-full">
        Apply Filters
      </Button>
    </div>
  );
}

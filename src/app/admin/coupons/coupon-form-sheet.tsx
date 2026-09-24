"use client";

/*
 * ---------------------------------------------------------
 * COUPON FORM
 * ---------------------------------------------------------
 *
 * Create and edit a discount code. The rules the shopper meets
 * at the cart are all set here: what comes off, the minimum
 * basket, the window it runs for, and how many times it can be
 * used.
 */

import { Input } from "@/src/app/components/ui/input";
import { Textarea } from "@/src/app/components/ui/textarea";
import { formatCurrency } from "@/src/app/lib/utils";
import { useState } from "react";
import { FormActions, FormField, FormSheet, INPUT_CLASS } from "../components/admin-ui";
import type { Coupon, CouponPayload } from "./queries";

/* The form holds strings; the payload holds numbers and nulls. */
interface FormValues {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  minSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  expiresAt: string;
  maxUses: string;
  active: boolean;
  promoted: boolean;
}

const EMPTY: FormValues = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  minSubtotal: "0",
  maxDiscount: "",
  startsAt: "",
  expiresAt: "",
  maxUses: "",
  active: true,
  promoted: false,
};

/* A timestamptz rendered for <input type="datetime-local">. */
const toLocalInput = (value: string | null): string =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

const fromLocalInput = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;

const valuesFrom = (coupon: Coupon): FormValues => ({
  code: coupon.code,
  description: coupon.description ?? "",
  discountType: coupon.discount_type,
  discountValue: String(coupon.discount_value),
  minSubtotal: String(coupon.min_subtotal),
  maxDiscount: coupon.max_discount === null ? "" : String(coupon.max_discount),
  startsAt: toLocalInput(coupon.starts_at),
  expiresAt: toLocalInput(coupon.expires_at),
  maxUses: coupon.max_uses === null ? "" : String(coupon.max_uses),
  active: coupon.active,
  promoted: coupon.promoted,
});

interface CouponFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Coupon | null;
  saving: boolean;
  onInvalid: (message: string) => void;
  onSubmit: (payload: CouponPayload) => void;
}

export function CouponFormSheet({
  open,
  onOpenChange,
  editing,
  saving,
  onInvalid,
  onSubmit,
}: CouponFormSheetProps) {
  const [values, setValues] = useState<FormValues>(EMPTY);

  /*
   * Reset when the sheet opens on a different coupon, compared
   * during render so the previous one is never on screen for a
   * frame.
   */
  const targetKey = open ? (editing?.id ?? "new") : null;
  const [loadedKey, setLoadedKey] = useState(targetKey);

  if (targetKey !== loadedKey) {
    setLoadedKey(targetKey);

    if (targetKey !== null) {
      setValues(editing ? valuesFrom(editing) : EMPTY);
    }
  }

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const code = values.code.trim().toUpperCase();
    const discountValue = Number(values.discountValue);

    if (!code) {
      onInvalid("Give the code a name, e.g. EID25.");
      return;
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      onInvalid("The discount has to be more than zero.");
      return;
    }

    if (values.discountType === "percent" && discountValue > 100) {
      onInvalid("A percentage discount cannot be more than 100.");
      return;
    }

    const startsAt = fromLocalInput(values.startsAt);
    const expiresAt = fromLocalInput(values.expiresAt);

    if (startsAt && expiresAt && startsAt >= expiresAt) {
      onInvalid("The end of the window has to come after its start.");
      return;
    }

    onSubmit({
      code,
      description: values.description.trim() || null,
      discount_type: values.discountType,
      discount_value: discountValue,
      min_subtotal: Number(values.minSubtotal) || 0,
      max_discount: values.maxDiscount.trim() === "" ? null : Number(values.maxDiscount),
      starts_at: startsAt,
      expires_at: expiresAt,
      max_uses: values.maxUses.trim() === "" ? null : Number(values.maxUses),
      active: values.active,
      /* A switched-off code has nothing to advertise. */
      promoted: values.active && values.promoted,
    });
  };

  const isPercent = values.discountType === "percent";

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${editing.code}` : "New discount code"}
      description="What comes off, who qualifies, and how long it runs."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField id="code" label="Code" required>
          <Input
            id="code"
            value={values.code}
            onChange={(event) => set("code", event.target.value.toUpperCase())}
            placeholder="EID25"
            className={`${INPUT_CLASS} font-mono uppercase`}
            autoComplete="off"
          />
        </FormField>

        <FormField id="description" label="Description">
          <Textarea
            id="description"
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="What this code is for. Staff only - shoppers never see it."
            className={INPUT_CLASS}
            rows={2}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField id="discountType" label="Type" required>
            <select
              id="discountType"
              value={values.discountType}
              onChange={(event) => set("discountType", event.target.value as "percent" | "fixed")}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </FormField>

          <FormField id="discountValue" label={isPercent ? "Percent off" : "Amount off"} required>
            <Input
              id="discountValue"
              type="number"
              min={0}
              max={isPercent ? 100 : undefined}
              step="0.01"
              value={values.discountValue}
              onChange={(event) => set("discountValue", event.target.value)}
              placeholder={isPercent ? "25" : "500"}
              className={INPUT_CLASS}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField id="minSubtotal" label="Minimum basket">
            <Input
              id="minSubtotal"
              type="number"
              min={0}
              step="0.01"
              value={values.minSubtotal}
              onChange={(event) => set("minSubtotal", event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>

          {/* Only a percentage can run away; a fixed amount is its own cap. */}
          {isPercent && (
            <FormField id="maxDiscount" label="Cap the discount at">
              <Input
                id="maxDiscount"
                type="number"
                min={0}
                step="0.01"
                value={values.maxDiscount}
                onChange={(event) => set("maxDiscount", event.target.value)}
                placeholder="No cap"
                className={INPUT_CLASS}
              />
            </FormField>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField id="startsAt" label="Starts">
            <Input
              id="startsAt"
              type="datetime-local"
              value={values.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>

          <FormField id="expiresAt" label="Expires">
            <Input
              id="expiresAt"
              type="datetime-local"
              value={values.expiresAt}
              onChange={(event) => set("expiresAt", event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>
        </div>

        <FormField id="maxUses" label="Total redemptions allowed">
          <Input
            id="maxUses"
            type="number"
            min={1}
            step="1"
            value={values.maxUses}
            onChange={(event) => set("maxUses", event.target.value)}
            placeholder="Unlimited"
            className={INPUT_CLASS}
          />

          {editing && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Used {editing.times_used} time
              {editing.times_used === 1 ? "" : "s"} so far.
            </p>
          )}
        </FormField>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => set("active", event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            Active — shoppers can use this code
          </label>

          {/*
           * Off by default, and deliberately so: the coupons
           * table has no public read policy precisely so that a
           * one-off code written for a support case, or a code
           * given to one influencer, cannot be listed. Ticking
           * this is the only thing that puts a code in front of
           * everyone, so it has to be a decision rather than a
           * default.
           */}
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={values.promoted}
              onChange={(event) => set("promoted", event.target.checked)}
              disabled={!values.active}
              className="h-4 w-4 rounded border-neutral-300 disabled:opacity-50"
            />
            Promote — advertise on the sale page and homepage
          </label>

          <p className="pl-6 text-xs text-neutral-500">
            {values.active
              ? "Shown publicly with its terms, but only while it is inside its window and has redemptions left."
              : "An inactive code is never advertised."}
          </p>
        </div>

        <p className="rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
          {isPercent
            ? `Takes ${values.discountValue || "0"}% off baskets of ${formatCurrency(Number(values.minSubtotal) || 0)} or more${values.maxDiscount ? `, up to ${formatCurrency(Number(values.maxDiscount))}` : ""}.`
            : `Takes ${formatCurrency(Number(values.discountValue) || 0)} off baskets of ${formatCurrency(Number(values.minSubtotal) || 0)} or more.`}
        </p>

        <FormActions
          saving={saving}
          submitLabel={editing ? "Save changes" : "Create code"}
          savingLabel="Saving..."
          onCancel={() => onOpenChange(false)}
        />
      </form>
    </FormSheet>
  );
}

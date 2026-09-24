"use client";

/*
 * ---------------------------------------------------------
 * ORDER DRAWER
 * ---------------------------------------------------------
 *
 * Fulfillment fields on top, read-only context below.
 */

import { useToast } from "@/hooks/use-toast";
import { Input } from "@/src/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select";
import { cn } from "@/src/app/lib/utils";
import { ClipboardList, CreditCard, Truck, type LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  FormActions,
  FormField,
  FormSheet,
  formatDateTime,
  formatOrderId,
  getErrorMessage,
  INPUT_CLASS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  titleCase,
  type SelectOption,
} from "../components/admin-ui";
import { CustomerSection, NotesSection, OrderItemsSection } from "./order-sections";
import { updateOrder } from "./queries";
import type { Order, OrderUpdate } from "./types";
import { useOrderItems } from "./use-orders";
import { BookShipment } from "@/src/app/admin/orders/book-shipment";

interface SelectFieldProps {
  id: string;
  label: string;
  icon?: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly SelectOption[];
  disabled: boolean;
}

function SelectField({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: SelectFieldProps) {
  return (
    <FormField id={id} label={label} icon={icon}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className={cn(INPUT_CLASS, "bg-white")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

const updateFromOrder = (order: Order): OrderUpdate => ({
  status: order.status || "pending",
  paymentStatus: order.payment_status || "pending",
  paymentMethod: order.payment_method ?? "",
  trackingNumber: order.tracking_number ?? "",
});

interface OrderDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSaved: () => Promise<void> | void;
}

export function OrderDetailSheet({ open, onOpenChange, order, onSaved }: OrderDetailSheetProps) {
  const { toast } = useToast();

  const [update, setUpdate] = useState<OrderUpdate>({
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "",
    trackingNumber: "",
  });

  const [saving, setSaving] = useState(false);

  const { items, loading: loadingItems } = useOrderItems(open && order ? order.id : null);

  /*
   * Seed the form from the order the sheet was opened on.
   *
   * Compared during render rather than in an effect: from an
   * effect the sheet painted the previous order's status for a
   * frame before correcting itself, which on a slow list read
   * as the wrong order being open.
   */
  const orderKey = open ? (order?.id ?? null) : null;

  const [loadedKey, setLoadedKey] = useState(orderKey);

  if (orderKey !== loadedKey) {
    setLoadedKey(orderKey);

    if (order && orderKey !== null) {
      setUpdate(updateFromOrder(order));
    }
  }

  const setField = <K extends keyof OrderUpdate>(key: K, value: OrderUpdate[K]): void => {
    setUpdate((current) => ({ ...current, [key]: value }));
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (saving) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    if (!order || saving) {
      return;
    }

    setSaving(true);

    try {
      await updateOrder(order.id, update);

      toast({
        title: "Order updated",
        description: `Order ${formatOrderId(order.id)} has been saved.`,
      });

      await onSaved();

      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Order update error:", error);

      toast({
        title: "Update failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      wide
      title={
        <>
          <ClipboardList className="h-5 w-5 text-brand-strong" />
          Manage Order {order ? formatOrderId(order.id) : ""}
        </>
      }
      description={order ? `Placed ${formatDateTime(order.created_at)}` : ""}
    >
      {order && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Fulfillment Options
            </span>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                id="drawer-status"
                label="Order Status"
                value={update.status}
                onChange={(value) => setField("status", value)}
                placeholder="Status"
                options={ORDER_STATUSES}
                disabled={saving}
              />

              <SelectField
                id="drawer-payment"
                label="Payment Status"
                value={update.paymentStatus}
                onChange={(value) => setField("paymentStatus", value)}
                placeholder="Payment"
                options={PAYMENT_STATUSES}
                disabled={saving}
              />
            </div>

            <SelectField
              id="drawer-method"
              label="Payment Method"
              icon={CreditCard}
              value={update.paymentMethod}
              onChange={(value) => setField("paymentMethod", value)}
              placeholder="Not recorded"
              options={PAYMENT_METHODS}
              disabled={saving}
            />

            {/*
              Booking writes the tracking number itself - a
              trigger mirrors it from the shipment - so this is
              above the field rather than replacing it. The
              field stays for couriers with no adapter, where
              the number is copied in by hand.
            */}
            <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-3">
              <BookShipment
                orderId={order.id}
                trackingNumber={order.tracking_number}
                onBooked={onSaved}
              />
            </div>

            <FormField id="drawer-tracking" label="Tracking / Courier Reference" icon={Truck}>
              <Input
                id="drawer-tracking"
                value={update.trackingNumber}
                onChange={(event) => setField("trackingNumber", event.target.value)}
                placeholder="e.g. DHL992837 or TCS88493"
                disabled={saving}
                className={cn(INPUT_CLASS, "bg-white")}
              />
            </FormField>
          </div>

          <CustomerSection order={order} />

          <OrderItemsSection
            items={items}
            loading={loadingItems}
            totalAmount={order.total_amount}
          />

          {order.notes && <NotesSection notes={order.notes} />}

          {order.payment_method && (
            <p className="text-[10px] text-neutral-400">
              Recorded payment method:{" "}
              <span className="font-semibold text-neutral-500">
                {titleCase(order.payment_method)}
              </span>
            </p>
          )}

          <FormActions
            saving={saving}
            submitLabel="Save Order Status"
            savingLabel="Saving..."
            onCancel={() => handleOpenChange(false)}
          />
        </form>
      )}
    </FormSheet>
  );
}

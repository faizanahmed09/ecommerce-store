"use client";

/*
 * ---------------------------------------------------------
 * ADMIN / DISCOUNT CODES
 * ---------------------------------------------------------
 *
 * Where codes are created, switched off and retired. The cart
 * checks them through redeem_coupon(); this is the other half.
 */

import { Badge } from "@/src/app/components/ui/badge";
import { Button } from "@/src/app/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/src/app/lib/utils";
import { cn } from "@/src/app/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Trash2, TicketPercent } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  FILTER_BAR_CLASS,
  FilterSelect,
  formatDate,
  getErrorMessage,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  RefreshButton,
  SearchInput,
} from "../components/admin-ui";
import { DataTable, type AdminColumnDef } from "../components/data-table";
import { CouponFormSheet } from "./coupon-form-sheet";
import {
  createCoupon,
  deleteCoupon,
  fetchCoupons,
  setCouponActive,
  updateCoupon,
  type Coupon,
  type CouponPayload,
} from "./queries";

const NO_COUPONS: Coupon[] = [];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Switched off" },
  { value: "expired", label: "Expired" },
];

/*
 * What a shopper would actually meet today. `active` is the
 * switch; a code can be switched on and still be unusable
 * because its window has passed or its uses are spent.
 */
function statusOf(coupon: Coupon): {
  label: string;
  tone: "live" | "off" | "spent";
} {
  if (!coupon.active) {
    return { label: "Off", tone: "off" };
  }

  const now = Date.now();

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    return { label: "Expired", tone: "spent" };
  }

  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { label: "Scheduled", tone: "off" };
  }

  if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses) {
    return { label: "Fully used", tone: "spent" };
  }

  return { label: "Live", tone: "live" };
}

export default function AdminCouponsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: coupons = NO_COUPONS,
    isPending: loading,
    error,
  } = useQuery({ queryKey: ["admin-coupons"], queryFn: fetchCoupons });

  if (error) {
    console.error("Could not load discount codes:", error);
  }

  const reload = () => void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return coupons.filter((coupon) => {
      const matchesSearch =
        needle === "" ||
        coupon.code.toLowerCase().includes(needle) ||
        (coupon.description ?? "").toLowerCase().includes(needle);

      if (!matchesSearch) {
        return false;
      }

      if (statusFilter === "all") {
        return true;
      }

      const { label } = statusOf(coupon);

      if (statusFilter === "active") return label === "Live";
      if (statusFilter === "expired") return label === "Expired";

      return label === "Off" || label === "Scheduled" || label === "Fully used";
    });
  }, [coupons, search, statusFilter]);

  const handleSubmit = async (payload: CouponPayload) => {
    setSaving(true);

    try {
      if (editing) {
        await updateCoupon(editing.id, payload);
      } else {
        await createCoupon(payload);
      }

      toast({
        title: editing ? "Code updated" : "Code created",
        description: `${payload.code} has been saved.`,
      });

      reload();
      setIsFormOpen(false);
    } catch (saveError: unknown) {
      console.error("Coupon save error:", saveError);

      toast({
        title: editing ? "Update failed" : "Creation failed",
        /* The unique index is what a duplicate code trips. */
        description: getErrorMessage(saveError).includes("coupons_code_unique")
          ? "That code already exists."
          : getErrorMessage(saveError),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    try {
      await setCouponActive(coupon.id, !coupon.active);
      reload();

      toast({
        title: coupon.active ? `${coupon.code} switched off` : `${coupon.code} is live`,
      });
    } catch (toggleError: unknown) {
      toast({
        title: "Couldn't change that code",
        description: getErrorMessage(toggleError),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);

    try {
      await deleteCoupon(pendingDelete.id);
      reload();

      toast({ title: `${pendingDelete.code} deleted` });
    } catch (deleteError: unknown) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const columns: AdminColumnDef<Coupon>[] = useMemo(
    () => [
      {
        id: "code",
        accessorFn: (coupon) => coupon.code,
        header: "Code",
        cell: ({ row }) => (
          <div>
            <div className="font-mono font-bold text-neutral-800">{row.original.code}</div>

            {row.original.description && (
              <div className="mt-0.5 max-w-xs truncate text-[11px] text-neutral-400">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "discount",
        accessorFn: (coupon) => coupon.discount_value,
        header: "Discount",
        cell: ({ row }) => (
          <span className="font-semibold text-neutral-800">
            {row.original.discount_type === "percent"
              ? `${row.original.discount_value}%`
              : formatCurrency(row.original.discount_value)}
          </span>
        ),
      },
      {
        id: "conditions",
        enableSorting: false,
        header: "Conditions",
        cell: ({ row }) => (
          <div className="text-xs text-neutral-500">
            <div>
              Min {formatCurrency(row.original.min_subtotal)}
              {row.original.max_discount !== null &&
                ` · max ${formatCurrency(row.original.max_discount)}`}
            </div>

            {row.original.expires_at && (
              <div className="mt-0.5">Until {formatDate(row.original.expires_at)}</div>
            )}
          </div>
        ),
      },
      {
        id: "used",
        accessorFn: (coupon) => coupon.times_used,
        header: "Used",
        cell: ({ row }) => (
          <span className="text-neutral-600">
            {row.original.times_used}
            {row.original.max_uses !== null && ` / ${row.original.max_uses}`}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (coupon) => statusOf(coupon).label,
        header: "Status",
        cell: ({ row }) => {
          const { label, tone } = statusOf(row.original);

          return (
            <div className="flex flex-wrap items-center gap-1">
              <Badge
                className={cn(
                  "border-none text-[9px] font-bold",
                  tone === "live" && "bg-emerald-100 text-emerald-700",
                  tone === "off" && "bg-neutral-100 text-neutral-500",
                  tone === "spent" && "bg-amber-100 text-amber-700"
                )}
              >
                {label.toUpperCase()}
              </Badge>

              {/*
                Which codes are on the sale page and the homepage
                is the thing you most want to be able to see
                without opening each one - the difference between
                a private code and a broadcast one.
              */}
              {row.original.promoted && (
                <Badge
                  className="border-none bg-brand/10 text-[9px] font-bold text-brand"
                  title="Advertised on the sale page and homepage"
                >
                  PROMOTED
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleToggle(row.original)}
              className="h-8 text-xs text-neutral-500 hover:text-neutral-900"
            >
              {row.original.active ? "Switch off" : "Switch on"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditing(row.original);
                setIsFormOpen(true);
              }}
              className="h-8 w-8 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Edit2 className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setPendingDelete(row.original)}
              className="h-8 w-8 text-neutral-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discount Codes"
        description="Create codes, set what they take off, and switch them on or off."
      >
        <RefreshButton onClick={reload} loading={loading} />

        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setIsFormOpen(true);
          }}
          className={cn("flex items-center gap-2", PRIMARY_BUTTON_CLASS)}
        >
          <Plus className="h-4 w-4" />
          New Code
        </Button>
      </PageHeader>

      <div className={FILTER_BAR_CLASS}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by code or description..."
        />

        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          allLabel="All statuses"
          options={STATUS_OPTIONS}
        />
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        totalRows={coupons.length}
        columns={columns}
        getRowId={(coupon) => coupon.id}
        emptyIcon={TicketPercent}
        emptyTitle="No discount codes yet."
        emptyDescription="Create one to run your first campaign."
        filteredTitle="No codes match your filters."
        filteredDescription="Try changing the search or the status filter."
      />

      <CouponFormSheet
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setIsFormOpen(open);
          }
        }}
        editing={editing}
        saving={saving}
        onInvalid={(message) =>
          toast({ title: "Check the form", description: message, variant: "destructive" })
        }
        onSubmit={(payload) => void handleSubmit(payload)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setPendingDelete(null);
          }
        }}
        title="Delete discount code"
        description={`"${pendingDelete?.code ?? ""}" will be permanently deleted, along with how many times it was used. Switching it off instead keeps that history.`}
        confirmLabel="Delete code"
        confirmingLabel="Deleting..."
        confirming={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

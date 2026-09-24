"use client";

import { useCallback, useState } from "react";
import { AlertCircle, MapPin, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/src/app/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/app/components/ui/card";
import { EmptyState } from "@/src/app/components/ui/empty-state";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/app/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/src/app/context/auth-context";
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
  type AddressPayload,
  type AddressRecord,
} from "@/src/app/lib/addresses";
import { useAsyncData } from "@/src/app/lib/use-async-data";

const NO_ADDRESSES: AddressRecord[] = [];

const EMPTY_FORM: AddressPayload = {
  name: "",
  street_address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Pakistan",
  phone: "",
  is_default: false,
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Please try again.";

export function AccountAddresses() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<AddressRecord | null>(null);
  const [form, setForm] = useState<AddressPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<AddressRecord[]> => {
    if (!user) {
      return NO_ADDRESSES;
    }

    return fetchAddresses(user.id);
  }, [user]);

  const onError = useCallback((error: unknown) => {
    console.error("Error fetching addresses:", error);
  }, []);

  const {
    data: addresses,
    loading,
    error,
    reload,
  } = useAsyncData(load, {
    fallback: NO_ADDRESSES,
    enabled: Boolean(user),
    onError,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (address: AddressRecord) => {
    setEditing(address);
    setForm({
      name: address.name,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone ?? "",
      is_default: address.is_default,
    });
    setIsFormOpen(true);
  };

  const setField = (field: keyof AddressPayload, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    setSaving(true);

    try {
      const payload: AddressPayload = {
        ...form,
        phone: form.phone?.trim() ? form.phone.trim() : null,
      };

      if (editing) {
        await updateAddress(editing.id, user.id, payload);
      } else {
        await createAddress(user.id, payload);
      }

      toast({
        title: editing ? "Address updated" : "Address saved",
        description: `${payload.name} is on your account.`,
      });

      setIsFormOpen(false);
      reload();
    } catch (caught: unknown) {
      console.error("Failed to save address:", caught);

      toast({
        title: "Couldn't save that address",
        description: getErrorMessage(caught),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (address: AddressRecord) => {
    setBusyId(address.id);

    try {
      await deleteAddress(address.id);

      toast({
        title: "Address removed",
        description: `${address.name} has been deleted.`,
      });

      reload();
    } catch (caught: unknown) {
      console.error("Failed to delete address:", caught);

      toast({
        title: "Couldn't remove that address",
        description: getErrorMessage(caught),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (address: AddressRecord) => {
    if (!user) {
      return;
    }

    setBusyId(address.id);

    try {
      await setDefaultAddress(address.id, user.id);

      toast({
        title: "Default address updated",
        description: `${address.name} is now your default.`,
      });

      reload();
    } catch (caught: unknown) {
      console.error("Failed to set default address:", caught);

      toast({
        title: "Couldn't update your default",
        description: getErrorMessage(caught),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <div className="flex justify-between">
      <h3 className="text-lg font-semibold">Your Addresses</h3>
      <Button onClick={openCreate}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add New Address
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array(2)
          .fill(null)
          .map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-6"
            >
              <div className="mb-4 h-6 w-1/2 rounded bg-muted"></div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-muted"></div>
                <div className="h-4 w-3/4 rounded bg-muted"></div>
                <div className="h-4 w-1/2 rounded bg-muted"></div>
              </div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* A failed load is not an empty address book. */}
      {error ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load your addresses"
          description="Something went wrong reaching the store. Nothing has been lost — try again in a moment."
          action={
            <Button variant="outline" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Save an address to make checkout faster next time."
          action={<Button onClick={openCreate}>Add your first address</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  {address.name}
                  {address.is_default && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Default
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-muted-foreground">
                  {address.street_address}
                  <br />
                  {address.city}, {address.state} {address.postal_code}
                  <br />
                  {address.country}
                  {address.phone && (
                    <>
                      <br />
                      Phone: {address.phone}
                    </>
                  )}
                </address>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                {!address.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === address.id}
                    onClick={() => handleSetDefault(address)}
                  >
                    Make default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(address)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === address.id}
                  onClick={() => handleDelete(address)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit address" : "Add a new address"}
            </SheetTitle>
            <SheetDescription>
              Saved addresses make checkout faster.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address-name">Label</Label>
              <Input
                id="address-name"
                placeholder="Home, Office…"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address-street">Street address</Label>
              <Input
                id="address-street"
                value={form.street_address}
                onChange={(e) => setField("street_address", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address-city">City</Label>
                <Input
                  id="address-city"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-state">State/Province</Label>
                <Input
                  id="address-state"
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-postal">Postal code</Label>
                <Input
                  id="address-postal"
                  value={form.postal_code}
                  onChange={(e) => setField("postal_code", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-country">Country</Label>
                <Input
                  id="address-country"
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address-phone">Phone (optional)</Label>
              <Input
                id="address-phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.is_default}
                onChange={(e) => setField("is_default", e.target.checked)}
              />
              Use as my default address
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add address"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

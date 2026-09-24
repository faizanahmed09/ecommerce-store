"use client";

import type React from "react";

import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/src/app/components/cart-provider";
import { Button } from "@/src/app/components/ui/button";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select";
import { Separator } from "@/src/app/components/ui/separator";
import { Textarea } from "@/src/app/components/ui/textarea";
import { useAuth } from "@/src/app/context/auth-context";
import { calculateOrderTotals } from "@/src/app/lib/order-totals";
import { formatCurrency, safeImageSrc } from "@/src/app/lib/utils";
import { Banknote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAddress, fetchAddresses, type AddressRecord } from "@/src/app/lib/addresses";
import { fetchUserProfileByEmail } from "@/src/app/lib/users";
import { CheckoutError, PAYMENT_METHOD, placeOrder, StockError } from "./queries";
import { sendOrderConfirmation } from "@/src/app/lib/send-order-confirmation";
import { Container } from "@/src/app/components/ui/container";
import { useCartImages } from "@/src/app/lib/use-cart-images";

/* The picker's value when the shopper is typing an address of their own. */
const NEW_ADDRESS = "new";

const DEFAULT_COUNTRY = "Pakistan";

/* The form fields that make up a delivery address, as opposed to contact. */
const ADDRESS_FIELDS = ["address", "city", "state", "postalCode", "country"] as const;

type AddressField = (typeof ADDRESS_FIELDS)[number];

/*
 * Country carries a default, so it says nothing about whether the shopper
 * has actually entered an address worth keeping.
 */
const TYPED_ADDRESS_FIELDS = ADDRESS_FIELDS.filter(
  (field): field is Exclude<AddressField, "country"> => field !== "country"
);

/* Only the fields the form marks required; notes is optional. */
const REQUIRED_FIELDS = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["postalCode", "Postal code"],
  ["country", "Country"],
] as const;

/*
 * addresses.name and users.full_name are single columns, but the form asks
 * for the two halves separately. The first word is the given name and the
 * remainder the family name - wrong for some naming conventions, which is
 * why it only ever pre-fills a field the shopper can then correct.
 */
/* "12 Mall Road, Lahore, Punjab 54000" - enough to tell two entries apart. */
function summariseAddress(address: AddressRecord): string {
  const region = [address.city, address.state].filter(Boolean).join(", ");

  return [address.street_address, region, address.postal_code].filter(Boolean).join(", ");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, cartTotal, clearCart, coupon } = useCart();

  /* The saved URL is a snapshot; this is the product's photo now. */
  const imageFor = useCartImages(items);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* The summary below and the order row are priced from the same call. */
  const totals = useMemo(
    () => calculateOrderTotals(cartTotal, coupon?.discount ?? 0),
    [cartTotal, coupon]
  );

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: DEFAULT_COUNTRY,
    notes: "",
  });

  /*
   * What the prefill managed to fill, so the shopper is told whether they are
   * checking details over or still have some to add.
   */
  const [prefill, setPrefill] = useState<{
    applied: boolean;
    hasSavedAddress: boolean;
  } | null>(null);

  /* The shopper's address book, for the "Deliver to" picker. */
  const [savedAddresses, setSavedAddresses] = useState<AddressRecord[]>([]);

  /* Which saved address is in the form, or NEW_ADDRESS when typed by hand. */
  const [selectedAddressId, setSelectedAddressId] = useState<string>(NEW_ADDRESS);

  /* Offer to remember an address the shopper typed themselves. */
  const [saveAddress, setSaveAddress] = useState(false);

  /* Prefill runs once per signed-in shopper, never twice over their edits. */
  const prefilledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || prefilledFor.current === user.id) {
      return;
    }

    /*
     * Claimed before the fetch so a second run cannot start a duplicate, and
     * released again if it fails so a later mount can retry.
     *
     * Deliberately no "cancelled" flag: under StrictMode the effect is run,
     * cleaned up and run again on the same mount, so cancelling on cleanup
     * would discard the only run the guard lets through. A setState after a
     * real unmount is a harmless no-op in React 18+.
     */
    prefilledFor.current = user.id;

    const loadSavedDetails = async () => {
      /*
       * The email is on the session already, so it is filled before anything
       * is fetched - it must not depend on a query that can fail.
       */
      if (user.email) {
        setFormData((current) =>
          current.email.trim() ? current : { ...current, email: user.email ?? "" }
        );

        setPrefill((current) => current ?? { applied: true, hasSavedAddress: false });
      }

      /*
       * The profile carries the name and phone; the delivery fields come from
       * the address book, default first - the same order the account
       * Addresses tab lists them in.
       *
       * Settled rather than all: these are independent, and an address book
       * that cannot be read must not cost the shopper their name and phone
       * as well.
       */
      const [profileResult, addressResult] = await Promise.allSettled([
        user.email ? fetchUserProfileByEmail(user.email) : Promise.resolve(null),
        fetchAddresses(user.id),
      ]);

      if (profileResult.status === "rejected") {
        console.error("Could not read the account profile:", profileResult.reason);
      }

      if (addressResult.status === "rejected") {
        console.error("Could not read the saved addresses:", addressResult.reason);
      }

      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const addresses = addressResult.status === "fulfilled" ? addressResult.value : [];

      try {
        const address = addresses.find((entry) => entry.is_default) ?? addresses[0] ?? null;
        const { firstName, lastName } = splitName(address?.name || profile?.full_name || "");

        const saved: Partial<typeof formData> = {
          firstName,
          lastName,
          email: user.email ?? profile?.email ?? "",
          phone: address?.phone || profile?.phone || "",
          address: address?.street_address ?? "",
          city: address?.city ?? "",
          state: address?.state ?? "",
          postalCode: address?.postal_code ?? "",
          country: address?.country ?? "",
        };

        setFormData((current) => {
          /*
           * Only blanks are filled. Anything already typed - including the
           * country default - is the shopper's own answer and stands.
           */
          const merged = { ...current };

          for (const [field, value] of Object.entries(saved)) {
            const key = field as keyof typeof formData;

            if (!merged[key].trim() && value) {
              merged[key] = value;
            }
          }

          return merged;
        });

        setSavedAddresses(addresses);
        setSelectedAddressId(address?.id ?? NEW_ADDRESS);

        /*
         * A shopper with nothing saved is the one who benefits most from
         * keeping this address, so the offer starts accepted for them.
         */
        setSaveAddress(addresses.length === 0);
        setPrefill({ applied: true, hasSavedAddress: address !== null });
      } catch (error: unknown) {
        /* Prefill is a convenience; the form still works when it fails. */
        console.error("Could not apply saved checkout details:", error);

        /* Let a later mount try again rather than staying half-filled. */
        prefilledFor.current = null;
      }
    };

    loadSavedDetails();
  }, [user]);

  /*
   * Derived rather than stored, so the notice shrinks as the shopper fills
   * the gaps in rather than describing the form as it was on load.
   */
  const missingFields = prefill?.applied
    ? REQUIRED_FIELDS.filter(([field]) => !formData[field].trim()).map(([, label]) => label)
    : [];

  /*
   * The offer only makes sense for a signed-in shopper who has actually
   * typed an address - picking one they already saved has nothing to keep.
   */
  const shouldOfferSave =
    Boolean(user) &&
    selectedAddressId === NEW_ADDRESS &&
    TYPED_ADDRESS_FIELDS.some((field) => formData[field].trim());

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    /*
     * Editing a delivery field means this is no longer the saved address it
     * was filled from, so the picker stops claiming otherwise and the offer
     * to remember it becomes worth making.
     */
    if (ADDRESS_FIELDS.includes(name as AddressField) && selectedAddressId !== NEW_ADDRESS) {
      setSelectedAddressId(NEW_ADDRESS);
    }
  };

  /*
   * Picking a saved address overwrites the delivery fields - unlike the
   * initial prefill, this is an explicit choice, so it replaces rather than
   * fills gaps. The notes and email are left alone; they are not part of it.
   */
  const handleSelectAddress = (addressId: string): void => {
    setSelectedAddressId(addressId);

    if (addressId === NEW_ADDRESS) {
      setFormData((current) => ({
        ...current,
        address: "",
        city: "",
        state: "",
        postalCode: "",
        country: DEFAULT_COUNTRY,
      }));

      setSaveAddress(true);
      return;
    }

    const address = savedAddresses.find((entry) => entry.id === addressId);

    if (!address) {
      return;
    }

    const { firstName, lastName } = splitName(address.name);

    setFormData((current) => ({
      ...current,
      firstName: firstName || current.firstName,
      lastName: lastName || current.lastName,
      phone: address.phone || current.phone,
      address: address.street_address,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      country: address.country,
    }));

    /* It is already saved, so there is nothing to offer to keep. */
    setSaveAddress(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      /*
       * A guest order carries no user_id. It still reaches the admin Orders
       * screen, where it shows as a Guest customer.
       */
      const orderId = await placeOrder({
        userId: user?.id ?? null,
        customer: formData,
        items,
        paymentMethod: PAYMENT_METHOD,
        totals,
        /*
         * The code, not the amount. place_order re-earns the
         * discount from it against a subtotal it priced itself.
         */
        couponCode: coupon?.code ?? null,
      });

      /*
       * The confirmation email. Deliberately not awaited into the
       * success path: the order is already placed and paid for on
       * delivery, so a slow or failing SMTP hop must not hold the
       * shopper on a spinner or make a good order look broken.
       * The route is idempotent, so a retry cannot double-send.
       */
      void sendOrderConfirmation(orderId);

      /*
       * Only after the order is safely placed. Remembering an address is a
       * convenience, so a failure here is logged and never shown - it must
       * not make a successful order look like it went wrong.
       */
      if (shouldOfferSave && saveAddress && user?.id) {
        try {
          await createAddress(user.id, {
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            street_address: formData.address.trim(),
            city: formData.city.trim(),
            state: formData.state.trim(),
            postal_code: formData.postalCode.trim(),
            country: formData.country.trim(),
            phone: formData.phone.trim() || null,
            /* createAddress makes the first one default on its own. */
            is_default: false,
          });
        } catch (error: unknown) {
          console.error("Could not save the delivery address:", error);
        }
      }

      toast({
        title: "Order placed successfully!",
        description: "Thank you for your purchase. Your order has been received.",
      });

      clearCart();

      /*
       * The id travels in the URL because a guest cannot read their own order
       * back — the confirmation page has no other way to name it.
       */
      router.push(`/checkout/success?order=${orderId}`);
    } catch (error: unknown) {
      console.error("Failed to place order:", error);

      /*
       * Stock ran out between filling the cart and paying. The cart is left
       * alone so the shopper can adjust the lines themselves.
       */
      /*
       * The shop recomputed the total and disagreed, or the
       * discount code lapsed while the form was being filled.
       * The message from place_order is already addressed to the
       * shopper, and the cart is left intact so they can look.
       */
      if (error instanceof CheckoutError) {
        toast({
          title: "Please check your order",
          description: `${error.message.replace(/\.$/, "")}. Your cart has been kept.`,
          variant: "destructive",
        });

        setIsSubmitting(false);
        return;
      }

      if (error instanceof StockError) {
        toast({
          title: "Some items are no longer available",
          description: `${error.message.replace(/\.$/, "")}. Please update your cart and try again.`,
          variant: "destructive",
        });

        setIsSubmitting(false);
        return;
      }

      toast({
        title: "Order could not be placed",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Your cart has been kept — please try again.",
        variant: "destructive",
      });

      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <h1 className="mb-6 text-3xl font-bold">Checkout</h1>
        <p className="mb-8 text-gray-600">
          Your cart is empty. Please add items to your cart before checking out.
        </p>
        <Button onClick={() => router.push("/products")}>Browse Products</Button>
      </Container>
    );
  }

  return (
    <Container className="py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-bold">Checkout</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 lg:pr-8">
            <div className="space-y-8">
              {/*
               * Says what the prefill did, so a part-filled form reads as
               * "here is what we knew" rather than a half-broken one.
               */}
              {prefill?.applied && (
                <div className="rounded-lg border border-muted bg-muted/40 p-4 text-sm">
                  {missingFields.length > 0 ? (
                    <p>
                      We&apos;ve filled in what your account had
                      {prefill.hasSavedAddress ? " and your saved address" : ""}. Please add your{" "}
                      <span className="font-medium">{missingFields.join(", ").toLowerCase()}</span>{" "}
                      to finish.
                    </p>
                  ) : (
                    <p>
                      Filled in from your account
                      {prefill.hasSavedAddress ? " and saved address" : ""} — please check it over
                      before placing the order.
                    </p>
                  )}

                  <Link
                    href="/account"
                    className="mt-1 inline-block text-xs underline underline-offset-4 hover:no-underline"
                  >
                    {prefill.hasSavedAddress
                      ? "Manage saved addresses"
                      : "Save an address for next time"}
                  </Link>
                </div>
              )}

              {/* Contact Information */}
              <div>
                <h2 className="mb-4 text-xl font-semibold">Contact Information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h2 className="mb-4 text-xl font-semibold">Shipping Address</h2>

                {/*
                 * Only worth a picker once there is a choice to make; a
                 * single saved address is already in the fields below.
                 */}
                {savedAddresses.length > 1 && (
                  <div className="mb-4 space-y-2">
                    <Label htmlFor="savedAddress">Deliver to</Label>
                    <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                      <SelectTrigger id="savedAddress">
                        <SelectValue placeholder="Choose an address" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedAddresses.map((address) => (
                          <SelectItem key={address.id} value={address.id}>
                            {summariseAddress(address)}
                            {address.is_default ? " (default)" : ""}
                          </SelectItem>
                        ))}
                        <SelectItem value={NEW_ADDRESS}>Use a different address</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  {shouldOfferSave && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="saveAddress"
                        checked={saveAddress}
                        onCheckedChange={(checked) => setSaveAddress(checked === true)}
                      />
                      <Label htmlFor="saveAddress" className="cursor-pointer text-sm font-normal">
                        Save this address to my account for next time
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h2 className="mb-4 text-xl font-semibold">Payment Method</h2>

                {/*
                  Cash on delivery is the only way to pay, so this
                  states it rather than offering a choice of one.
                  Card and PayPal used to be listed here and were
                  never wired to a processor - every order they
                  produced was unpaid, which is a promise the shop
                  could not keep.
                */}
                <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4">
                  <Banknote
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />

                  <div>
                    <p className="font-medium">Cash on Delivery</p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Pay the courier in cash when your order arrives. Please have the exact amount
                      ready.
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Notes */}
              <div>
                <Label htmlFor="notes" className="mb-4 block text-xl font-semibold">
                  Order Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Special instructions for delivery or any other notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="h-24"
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="sticky top-24 rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">Order Summary</h2>

              <div className="max-h-[300px] overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center">
                      <div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted">
                        <Image
                          src={safeImageSrc(imageFor(item))}
                          /*
                           * Empty on purpose. The product's name is
                           * the text immediately beside this - an alt
                           * repeating it makes a screen reader read
                           * the name twice in a row, and puts it into
                           * the page twice when the region is copied.
                           * A thumbnail sitting next to its own label
                           * is decorative.
                           */
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="ml-4">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && coupon && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="flex items-center gap-1.5">
                      Discount
                      <span className="font-mono text-xs">({coupon.code})</span>
                    </span>
                    <span>-{formatCurrency(totals.discount)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span>Delivery</span>
                  <span>
                    {totals.freeShipping ? (
                      <span className="font-medium text-emerald-600">Free</span>
                    ) : (
                      formatCurrency(totals.shipping)
                    )}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <Button type="submit" variant="brand" className="mt-6 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : "Place Order"}
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                By placing your order, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </form>
    </Container>
  );
}

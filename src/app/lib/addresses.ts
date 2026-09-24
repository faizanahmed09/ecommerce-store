/*
 * ---------------------------------------------------------
 * ADDRESS QUERIES
 * ---------------------------------------------------------
 *
 * The account Addresses tab used to query a table that had
 * never been created, so it showed invented rows. These are
 * the readers and writers behind the real one.
 *
 * Mirrors schema.sql: addresses (user_id, name,
 * street_address, city, state, postal_code, country, phone,
 * is_default).
 */

import { createClient } from "@/src/app/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * `addresses` was added after the generated database types, so
 * it is absent from them. Widening the client here is honest
 * about that; hand-editing database.types.ts would be undone by
 * the next regeneration.
 */
type Client = SupabaseClient;

export interface AddressRecord {
  id: string;
  name: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
}

export const ADDRESS_SELECT =
  "id, name, street_address, city, state, postal_code, country, phone, is_default";

type AddressRow = Record<string, unknown>;

const mapAddress = (row: AddressRow): AddressRecord => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  street_address: String(row.street_address ?? ""),
  city: String(row.city ?? ""),
  state: String(row.state ?? ""),
  postal_code: String(row.postal_code ?? ""),
  country: String(row.country ?? ""),
  phone: (row.phone as string | null) ?? null,
  is_default: Boolean(row.is_default),
});

/* A shopper's own addresses, default first then newest. */
export async function fetchAddresses(
  userId: string,
  client: Client = createClient() as Client,
): Promise<AddressRecord[]> {
  const { data, error } = await client
    .from("addresses")
    .select(ADDRESS_SELECT)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAddress);
}

export interface AddressPayload {
  name: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
}

/*
 * A unique partial index enforces one default per shopper, so
 * the previous default has to go before the new one lands.
 * `exceptId` skips the row being edited, which would otherwise
 * clear the flag it is about to set.
 */
async function clearDefault(
  client: Client,
  userId: string,
  exceptId?: string,
): Promise<void> {
  let query = client
    .from("addresses")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_default", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

export async function createAddress(
  userId: string,
  payload: AddressPayload,
  client: Client = createClient() as Client,
): Promise<AddressRecord> {
  /* The first address a shopper saves is their default. */
  const existing = await fetchAddresses(userId, client);
  const isDefault = payload.is_default || existing.length === 0;

  if (isDefault) {
    await clearDefault(client, userId);
  }

  const { data, error } = await client
    .from("addresses")
    .insert({ ...payload, user_id: userId, is_default: isDefault })
    .select(ADDRESS_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapAddress(data as AddressRow);
}

export async function updateAddress(
  addressId: string,
  userId: string,
  payload: AddressPayload,
  client: Client = createClient() as Client,
): Promise<AddressRecord> {
  if (payload.is_default) {
    await clearDefault(client, userId, addressId);
  }

  const { data, error } = await client
    .from("addresses")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", addressId)
    .select(ADDRESS_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapAddress(data as AddressRow);
}

export async function deleteAddress(
  addressId: string,
  client: Client = createClient() as Client,
): Promise<void> {
  const { error } = await client
    .from("addresses")
    .delete()
    .eq("id", addressId);

  if (error) {
    throw error;
  }
}

/*
 * Promoting an address is its own action rather than an edit,
 * because the card offers it as a single click.
 */
export async function setDefaultAddress(
  addressId: string,
  userId: string,
  client: Client = createClient() as Client,
): Promise<void> {
  await clearDefault(client, userId, addressId);

  const { error } = await client
    .from("addresses")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", addressId);

  if (error) {
    throw error;
  }
}

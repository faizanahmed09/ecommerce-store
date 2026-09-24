/*
 * ---------------------------------------------------------
 * ORDER TYPES
 * ---------------------------------------------------------
 *
 * Mirrors the orders / order_items tables, with the customer
 * profile and product/variant names already resolved so the
 * table and drawer render straight from these shapes.
 */

export interface Order {
  id: string;
  user_id: string | null;
  status: string;
  total_amount: number;
  shipping_address: string;
  billing_address: string | null;
  payment_method: string | null;
  payment_status: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  product_variant_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
  variant_label: string | null;
}

/* The fields the drawer can change. */
export interface OrderUpdate {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  trackingNumber: string;
}

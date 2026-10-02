export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      /* migrations/013-couriers.sql. Hand-added, as above. */
      couriers: {
        Row: {
          code: string;
          name: string;
          enabled: boolean;
          supports_cod: boolean;
          config: Json;
          sort_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          code: string;
          name: string;
          enabled?: boolean;
          supports_cod?: boolean;
          config?: Json;
          sort_order?: number;
        };
        Update: {
          name?: string;
          enabled?: boolean;
          supports_cod?: boolean;
          config?: Json;
          sort_order?: number;
        };
        Relationships: [];
      };
      courier_cities: {
        Row: {
          courier_code: string;
          city_id: string;
          city_name: string;
          /* Generated column - readable, never written. */
          normalised: string;
        };
        Insert: { courier_code: string; city_id: string; city_name: string };
        Update: { city_name?: string };
        Relationships: [];
      };
      courier_status_map: {
        Row: { courier_code: string; courier_status: string; status: string };
        Insert: { courier_code: string; courier_status: string; status: string };
        Update: { status?: string };
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          courier_code: string;
          tracking_number: string | null;
          status: string;
          courier_status: string | null;
          cod_amount: number;
          weight_grams: number | null;
          label_url: string | null;
          raw_request: Json | null;
          raw_response: Json | null;
          booked_at: string | null;
          delivered_at: string | null;
          customer_notified_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          order_id: string;
          courier_code: string;
          tracking_number?: string | null;
          status?: string;
          courier_status?: string | null;
          cod_amount?: number;
          weight_grams?: number | null;
          label_url?: string | null;
          raw_request?: Json | null;
          raw_response?: Json | null;
          booked_at?: string | null;
          delivered_at?: string | null;
          customer_notified_at?: string | null;
        };
        Update: {
          tracking_number?: string | null;
          status?: string;
          courier_status?: string | null;
          label_url?: string | null;
          delivered_at?: string | null;
          customer_notified_at?: string | null;
        };
        Relationships: [];
      };
      shipment_events: {
        Row: {
          id: string;
          shipment_id: string;
          status: string;
          courier_status: string | null;
          occurred_at: string;
          raw: Json | null;
          created_at: string | null;
        };
        Insert: {
          shipment_id: string;
          status: string;
          courier_status?: string | null;
          occurred_at?: string;
          raw?: Json | null;
        };
        Update: { status?: string };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: string;
          discount_value: number;
          min_subtotal: number;
          max_discount: number | null;
          starts_at: string | null;
          expires_at: string | null;
          max_uses: number | null;
          times_used: number;
          active: boolean;
          promoted: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type?: string;
          discount_value: number;
          min_subtotal?: number;
          max_discount?: number | null;
          starts_at?: string | null;
          expires_at?: string | null;
          max_uses?: number | null;
          times_used?: number;
          active?: boolean;
          promoted?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          min_subtotal?: number;
          max_discount?: number | null;
          starts_at?: string | null;
          expires_at?: string | null;
          max_uses?: number | null;
          times_used?: number;
          active?: boolean;
          promoted?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          cart_id: string | null;
          created_at: string | null;
          id: string;
          product_id: string | null;
          product_variant_id: string | null;
          quantity: number;
          updated_at: string | null;
        };
        Insert: {
          cart_id?: string | null;
          created_at?: string | null;
          id?: string;
          product_id?: string | null;
          product_variant_id?: string | null;
          quantity?: number;
          updated_at?: string | null;
        };
        Update: {
          cart_id?: string | null;
          created_at?: string | null;
          id?: string;
          product_id?: string | null;
          product_variant_id?: string | null;
          quantity?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string | null;
          id: string;
          session_id: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          session_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          session_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          image_url: string | null;
          is_enabled: boolean;
          name: string;
          parent_id: string | null;
          slug: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_enabled?: boolean;
          name: string;
          parent_id?: string | null;
          slug: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_enabled?: boolean;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string | null;
          id: string;
          order_id: string | null;
          product_id: string | null;
          product_variant_id: string | null;
          quantity: number;
          total_price: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          product_variant_id?: string | null;
          quantity: number;
          total_price: number;
          unit_price: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          product_variant_id?: string | null;
          quantity?: number;
          total_price?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          billing_address: string | null;
          created_at: string | null;
          id: string;
          notes: string | null;
          payment_method: string | null;
          payment_status: string | null;
          shipping_address: string;
          status: string;
          total_amount: number;
          discount_amount: number;
          coupon_code: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          confirmation_sent_at: string | null;
          tracking_number: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          billing_address?: string | null;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          shipping_address: string;
          status?: string;
          total_amount: number;
          discount_amount: number;
          coupon_code: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          confirmation_sent_at: string | null;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          billing_address?: string | null;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          shipping_address?: string;
          status?: string;
          total_amount?: number;
          discount_amount?: number;
          coupon_code?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          confirmation_sent_at?: string | null;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          created_at: string | null;
          display_order: number | null;
          id: string;
          image_url: string;
          is_primary: boolean | null;
          product_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          image_url: string;
          is_primary?: boolean | null;
          product_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          image_url?: string;
          is_primary?: boolean | null;
          product_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          price_adjustment: number | null;
          product_id: string | null;
          stock_quantity: number;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          price_adjustment?: number | null;
          product_id?: string | null;
          stock_quantity?: number;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          price_adjustment?: number | null;
          product_id?: string | null;
          stock_quantity?: number;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          piece_count: number | null;
          created_at: string | null;
          description: string | null;
          featured: boolean | null;
          is_enabled: boolean;
          id: string;
          name: string;
          price: number;
          sale_price: number | null;
          slug: string;
          stock_quantity: number;
          updated_at: string | null;
        };
        Insert: {
          category_id?: string | null;
          piece_count?: number | null;
          created_at?: string | null;
          description?: string | null;
          featured?: boolean | null;
          is_enabled?: boolean;
          id?: string;
          name: string;
          price: number;
          sale_price?: number | null;
          slug: string;
          stock_quantity?: number;
          updated_at?: string | null;
        };
        Update: {
          category_id?: string | null;
          piece_count?: number | null;
          created_at?: string | null;
          description?: string | null;
          featured?: boolean | null;
          is_enabled?: boolean;
          id?: string;
          name?: string;
          price?: number;
          sale_price?: number | null;
          slug?: string;
          stock_quantity?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          admin_response: string | null;
          admin_response_at: string | null;
          body: string | null;
          created_at: string | null;
          id: string;
          is_verified_purchase: boolean;
          product_id: string;
          rating: number;
          reviewer_name: string;
          status: string;
          title: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          admin_response?: string | null;
          admin_response_at?: string | null;
          body?: string | null;
          created_at?: string | null;
          id?: string;
          is_verified_purchase?: boolean;
          product_id: string;
          rating: number;
          reviewer_name?: string;
          status?: string;
          title?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          admin_response?: string | null;
          admin_response_at?: string | null;
          body?: string | null;
          created_at?: string | null;
          id?: string;
          is_verified_purchase?: boolean;
          product_id?: string;
          rating?: number;
          reviewer_name?: string;
          status?: string;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string;
          full_name: string;
          id: string;
          password_hash: string;
          phone: string | null;
          updated_at: string | null;
          user_type: string;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          full_name: string;
          id?: string;
          password_hash: string;
          phone?: string | null;
          updated_at?: string | null;
          user_type?: string;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          password_hash?: string;
          phone?: string | null;
          updated_at?: string | null;
          user_type?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          created_at: string | null;
          id: string;
          product_id: string | null;
          wishlist_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          product_id?: string | null;
          wishlist_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          product_id?: string | null;
          wishlist_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey";
            columns: ["wishlist_id"];
            isOneToOne: false;
            referencedRelation: "wishlists";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlists: {
        Row: {
          created_at: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      product_review_stats: {
        Row: {
          average_rating: number | null;
          five_star: number | null;
          four_star: number | null;
          one_star: number | null;
          product_id: string | null;
          review_count: number | null;
          three_star: number | null;
          two_star: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      /* place-order.sql: writes an order, its lines and the stock decrements
       * in one transaction. Hand-added - regenerating types will pick it up. */
      /* migrations/006-server-side-totals.sql. Hand-added, as above. */
      place_order: {
        Args: {
          p_user_id: string | null;
          p_shipping_address: string;
          p_payment_method: string;
          p_notes: string | null;
          /* A cross-check against the total the function computes. */
          p_total_amount: number;
          p_items: Json;
          p_coupon_code?: string | null;
          p_contact_email?: string | null;
          p_contact_phone?: string | null;
        };
        Returns: string;
      };
      effective_unit_price: {
        Args: {
          p_product_id: string;
          p_variant_ids: Json;
        };
        Returns: number;
      };
      claim_order_confirmation: {
        Args: {
          p_order_id: string;
        };
        Returns: {
          order_id: string;
          contact_email: string;
          total_amount: number;
          discount_amount: number;
          coupon_code: string | null;
          payment_method: string | null;
          shipping_addr: string;
          placed_at: string;
          items: Json;
        }[];
      };
      /* migrations/002-track-order.sql: one order's status, for the
       * person who placed it. Hand-added - regenerating types will
       * pick it up. */
      track_order: {
        Args: {
          p_reference: string;
          p_email: string;
        };
        Returns: {
          id: string;
          status: string;
          payment_status: string;
          tracking_number: string | null;
          total_amount: number;
          created_at: string;
          updated_at: string;
        }[];
      };
      /* migrations/004-coupons.sql. Hand-added - regenerating
       * types will pick it up. */
      redeem_coupon: {
        Args: {
          p_code: string;
          p_subtotal: number;
        };
        Returns: {
          valid: boolean;
          reason: string | null;
          code: string | null;
          discount: number;
        }[];
      };
      /* migrations/012-variant-options.sql. Hand-added, as above. */
      list_variant_options: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          value: string;
          price_adjustment: number;
          stock_quantity: number;
        }[];
      };
      /* migrations/005-promoted-coupons.sql. Hand-added, as above. */
      list_promoted_coupons: {
        Args: Record<string, never>;
        Returns: {
          code: string;
          discount_type: string;
          discount_value: number;
          min_subtotal: number;
          max_discount: number | null;
          expires_at: string | null;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof Database },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof Database },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof Database },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof Database },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

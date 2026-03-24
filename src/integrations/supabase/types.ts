export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      courts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price_per_hour: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price_per_hour?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price_per_hour?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          arena_name: string
          arena_slug: string | null
          banner_url: string | null
          created_at: string
          id: string
          location_link: string | null
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
          cancellation_limit_hours: number | null
          advance_percentage: number | null
          pix_key: string | null
          balance_cents: number | null
          payment_method: string | null
          manual_pix_key: string | null
          manual_pix_receiver_name: string | null
          uazapi_token: string | null
          uazapi_instance_name: string | null
        }
        Insert: {
          address?: string | null
          arena_name?: string
          arena_slug?: string | null
          banner_url?: string | null
          created_at?: string
          id?: string
          location_link?: string | null
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
          cancellation_limit_hours?: number | null
          advance_percentage?: number | null
          pix_key?: string | null
          balance_cents?: number | null
          payment_method?: string | null
          manual_pix_key?: string | null
          manual_pix_receiver_name?: string | null
          uazapi_token?: string | null
          uazapi_instance_name?: string | null
        }
        Update: {
          address?: string | null
          arena_name?: string
          arena_slug?: string | null
          banner_url?: string | null
          created_at?: string
          id?: string
          location_link?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
          cancellation_limit_hours?: number | null
          advance_percentage?: number | null
          pix_key?: string | null
          balance_cents?: number | null
          payment_method?: string | null
          manual_pix_key?: string | null
          manual_pix_receiver_name?: string | null
          uazapi_token?: string | null
          uazapi_instance_name?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          client_name: string
          client_phone: string | null
          court_id: string
          created_at: string
          date: string
          end_time: string
          extra_time: number
          id: string
          sport: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
          payment_id: string | null
          payment_url: string | null
          amount_paid: number | null
          status_pagamento: string | null
          payment_method: string | null
        }
        Insert: {
          client_name: string
          client_phone?: string | null
          court_id: string
          created_at?: string
          date: string
          end_time: string
          extra_time?: number
          id?: string
          sport?: string
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
          payment_id?: string | null
          payment_url?: string | null
          amount_paid?: number | null
          status_pagamento?: string | null
          payment_method?: string | null
        }
        Update: {
          client_name?: string
          client_phone?: string | null
          court_id?: string
          created_at?: string
          date?: string
          end_time?: string
          extra_time?: number
          id?: string
          sport?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
          payment_id?: string | null
          payment_url?: string | null
          amount_paid?: number | null
          status_pagamento?: string | null
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_configs: {
        Row: {
          created_at: string
          day_of_week: number
          default_duration: number
          end_time: string
          id: string
          min_interval: number
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          default_duration?: number
          end_time?: string
          id?: string
          min_interval?: number
          start_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          default_duration?: number
          end_time?: string
          id?: string
          min_interval?: number
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          related_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          related_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          related_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

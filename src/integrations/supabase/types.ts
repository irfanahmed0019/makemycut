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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      barbers: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          distance_km: number | null
          id: string
          image_url: string | null
          name: string
          owner_id: string | null
          rating: number | null
          review_count: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          id?: string
          image_url?: string | null
          name: string
          owner_id?: string | null
          rating?: number | null
          review_count?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          id?: string
          image_url?: string | null
          name?: string
          owner_id?: string | null
          rating?: number | null
          review_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          barber_id: string
          booking_date: string
          booking_time: string
          created_at: string | null
          expires_at: string | null
          id: string
          payment_method: string | null
          payment_status: string | null
          qr_code: string | null
          service_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          barber_id: string
          booking_date: string
          booking_time: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          qr_code?: string | null
          service_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          barber_id?: string
          booking_date?: string
          booking_time?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          qr_code?: string | null
          service_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          referral_code: string | null
          trust_score: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          referral_code?: string | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          referral_code?: string | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      queues: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          joined_at: string
          queue_position: number
          salon_id: string
          served_at: string | null
          service_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          joined_at?: string
          queue_position: number
          salon_id: string
          served_at?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          joined_at?: string
          queue_position?: number
          salon_id?: string
          served_at?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          barber_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          barber_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          barber_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salon_settings: {
        Row: {
          booking_enabled: boolean
          close_time: string
          created_at: string
          open_time: string
          queue_enabled: boolean
          queue_paused: boolean
          salon_id: string
          slot_duration: number
          updated_at: string
          wait_per_customer: number
        }
        Insert: {
          booking_enabled?: boolean
          close_time?: string
          created_at?: string
          open_time?: string
          queue_enabled?: boolean
          queue_paused?: boolean
          salon_id: string
          slot_duration?: number
          updated_at?: string
          wait_per_customer?: number
        }
        Update: {
          booking_enabled?: boolean
          close_time?: string
          created_at?: string
          open_time?: string
          queue_enabled?: boolean
          queue_paused?: boolean
          salon_id?: string
          slot_duration?: number
          updated_at?: string
          wait_per_customer?: number
        }
        Relationships: [
          {
            foreignKeyName: "salon_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          barber_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          price: number
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          price: number
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_holds: {
        Row: {
          barber_id: string
          booking_date: string
          booking_time: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          barber_id: string
          booking_date: string
          booking_time: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          barber_id?: string
          booking_date?: string
          booking_time?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_holds_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      queue_public: {
        Row: {
          id: string | null
          joined_at: string | null
          queue_position: number | null
          salon_id: string | null
          service_id: string | null
          status: string | null
        }
        Insert: {
          id?: string | null
          joined_at?: string | null
          queue_position?: number | null
          salon_id?: string | null
          service_id?: string | null
          status?: string | null
        }
        Update: {
          id?: string | null
          joined_at?: string | null
          queue_position?: number | null
          salon_id?: string | null
          service_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_booking: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      clean_expired_holds: { Args: never; Returns: undefined }
      confirm_booking_from_hold: {
        Args: {
          p_barber_id: string
          p_booking_date: string
          p_booking_time: string
          p_service_id: string
          p_user_id: string
        }
        Returns: string
      }
      confirm_hold: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      count_active_bookings: { Args: { p_user_id: string }; Returns: number }
      decrement_trust_on_cancel: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      decrement_trust_on_noshow: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_next_queue_position: { Args: { p_salon_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_queue: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_salon_id: string
          p_service_id: string
          p_user_id?: string
        }
        Returns: {
          estimated_wait: number
          queue_id: string
          queue_pos: number
        }[]
      }
      leave_queue: {
        Args: { p_queue_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_queue_served: {
        Args: { p_owner_id: string; p_queue_id: string }
        Returns: boolean
      }
      place_hold: {
        Args: {
          p_barber_id: string
          p_booking_date: string
          p_booking_time: string
          p_service_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

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
      app_settings: {
        Row: {
          bool_value: boolean | null
          created_at: string
          key: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          bool_value?: boolean | null
          created_at?: string
          key: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          bool_value?: boolean | null
          created_at?: string
          key?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      barber_assignments: {
        Row: {
          chair_id: string | null
          created_at: string
          id: string
          is_active: boolean
          salon_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chair_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          salon_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chair_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          salon_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      barbers: {
        Row: {
          address: string | null
          area: string | null
          badge_type: string | null
          created_at: string | null
          description: string | null
          distance_km: number | null
          district: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          is_verified: boolean
          name: string
          owner_id: string | null
          rating: number | null
          review_count: number | null
          status_tag: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          badge_type?: string | null
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          district?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_verified?: boolean
          name: string
          owner_id?: string | null
          rating?: number | null
          review_count?: number | null
          status_tag?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          badge_type?: string | null
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          district?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_verified?: boolean
          name?: string
          owner_id?: string | null
          rating?: number | null
          review_count?: number | null
          status_tag?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      booking_reminders: {
        Row: {
          booking_id: string
          id: string
          offset_minutes: number
          sent_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          offset_minutes: number
          sent_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          offset_minutes?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          barber_id: string
          booking_date: string
          booking_time: string
          chair_id: string | null
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
          chair_id?: string | null
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
          chair_id?: string | null
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
      chair_transfer_requests: {
        Row: {
          booking_id: string | null
          created_at: string
          from_barber_id: string
          from_chair_id: string
          id: string
          queue_id: string | null
          salon_id: string
          status: string
          to_barber_id: string | null
          to_chair_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          from_barber_id: string
          from_chair_id: string
          id?: string
          queue_id?: string | null
          salon_id: string
          status?: string
          to_barber_id?: string | null
          to_chair_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          from_barber_id?: string
          from_chair_id?: string
          id?: string
          queue_id?: string | null
          salon_id?: string
          status?: string
          to_barber_id?: string | null
          to_chair_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chairs: {
        Row: {
          chair_number: number
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          chair_number: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          chair_number?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          appointment_reminders: boolean
          appointment_updates: boolean
          created_at: string
          last_minute_alerts: boolean
          promotions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_reminders?: boolean
          appointment_updates?: boolean
          created_at?: string
          last_minute_alerts?: boolean
          promotions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_reminders?: boolean
          appointment_updates?: boolean
          created_at?: string
          last_minute_alerts?: boolean
          promotions?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_payment_details: {
        Row: {
          created_at: string
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      queues: {
        Row: {
          chair_id: string | null
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
          chair_id?: string | null
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
          chair_id?: string | null
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
      salon_time_slots: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          salon_id: string
          slot_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          salon_id: string
          slot_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          salon_id?: string
          slot_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_time_slots_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
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
          chair_id: string | null
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          barber_id: string
          booking_date: string
          booking_time: string
          chair_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          barber_id?: string
          booking_date?: string
          booking_time?: string
          chair_id?: string | null
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
      admin_list_admins: {
        Args: never
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      admin_lookup_user: {
        Args: { p_user_id: string }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      admin_reset_salon_data: { Args: { p_salon_id: string }; Returns: Json }
      admin_search_users: {
        Args: { p_query: string }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      clean_expired_holds: { Args: never; Returns: undefined }
      confirm_booking_from_hold:
        | {
            Args: {
              p_barber_id: string
              p_booking_date: string
              p_booking_time: string
              p_service_id: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_barber_id: string
              p_booking_date: string
              p_booking_time: string
              p_chair_id?: string
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
      current_barber_chair: { Args: { _user_id: string }; Returns: string }
      current_barber_salon: { Args: { _user_id: string }; Returns: string }
      decrement_trust_on_cancel: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      decrement_trust_on_noshow: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      expire_stale_queue_entries: { Args: never; Returns: undefined }
      get_next_queue_position: { Args: { p_salon_id: string }; Returns: number }
      get_occupied_slots: {
        Args: {
          p_barber_id: string
          p_booking_date: string
          p_chair_id?: string
        }
        Returns: {
          booking_time: string
          chair_id: string
        }[]
      }
      get_queue_list: {
        Args: { p_salon_id: string }
        Returns: {
          display_name: string
          entry_id: string
          queue_position: number
          status: string
        }[]
      }
      get_queue_status: {
        Args: { p_salon_id: string; p_user_id: string }
        Returns: {
          estimated_wait: number
          in_queue: boolean
          people_ahead: number
          queue_id: string
          queue_length: number
          queue_pos: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_slot_occupied: {
        Args: {
          p_barber_id: string
          p_booking_date: string
          p_booking_time: string
          p_chair_id?: string
          p_exclude_booking_id?: string
        }
        Returns: boolean
      }
      is_spam_phone: { Args: { p_phone: string }; Returns: boolean }
      join_queue: {
        Args: {
          p_chair_id?: string
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
      list_area_index: {
        Args: never
        Returns: {
          area: string
          district: string
        }[]
      }
      mark_queue_served: {
        Args: { p_owner_id: string; p_queue_id: string }
        Returns: boolean
      }
      normalize_in_phone: { Args: { p_phone: string }; Returns: string }
      normalize_slug: { Args: { val: string }; Returns: string }
      owner_search_users: {
        Args: { p_query: string; p_salon_id: string }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      place_hold:
        | {
            Args: {
              p_barber_id: string
              p_booking_date: string
              p_booking_time: string
              p_service_id: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_barber_id: string
              p_booking_date: string
              p_booking_time: string
              p_chair_id?: string
              p_service_id: string
              p_user_id: string
            }
            Returns: string
          }
      request_chair_transfer: {
        Args: {
          p_booking_id: string
          p_queue_id: string
          p_to_chair_id: string
        }
        Returns: string
      }
      respond_chair_transfer: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: boolean
      }
      search_areas: {
        Args: { p_query: string }
        Returns: {
          area: string
          district: string
        }[]
      }
      set_my_phone: { Args: { p_phone: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "barber"
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
      app_role: ["admin", "moderator", "user", "barber"],
    },
  },
} as const

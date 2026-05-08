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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          avatar_emoji: string
          avatar_image_url: string | null
          bio: string
          catchphrase: string | null
          color: string
          created_at: string
          greeting: string
          id: string
          is_online: boolean
          major_city: string | null
          map_x: number
          map_y: number
          name: string
          personality_traits: string[]
          rating: number
          specialty: string
          state: string
          total_chats: number
        }
        Insert: {
          avatar_emoji: string
          avatar_image_url?: string | null
          bio: string
          catchphrase?: string | null
          color: string
          created_at?: string
          greeting: string
          id: string
          is_online?: boolean
          major_city?: string | null
          map_x: number
          map_y: number
          name: string
          personality_traits?: string[]
          rating?: number
          specialty: string
          state: string
          total_chats?: number
        }
        Update: {
          avatar_emoji?: string
          avatar_image_url?: string | null
          bio?: string
          catchphrase?: string | null
          color?: string
          created_at?: string
          greeting?: string
          id?: string
          is_online?: boolean
          major_city?: string | null
          map_x?: number
          map_y?: number
          name?: string
          personality_traits?: string[]
          rating?: number
          specialty?: string
          state?: string
          total_chats?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          last_message_at: string
          message_count: number
          title: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          title?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      external_listings: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          id: string
          location: string | null
          notes: string | null
          price_monthly: number | null
          share_expires_at: string | null
          share_mask_sensitive: boolean
          share_token: string
          source: string
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          price_monthly?: number | null
          share_expires_at?: string | null
          share_mask_sensitive?: boolean
          share_token?: string
          source?: string
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          price_monthly?: number | null
          share_expires_at?: string | null
          share_mask_sensitive?: boolean
          share_token?: string
          source?: string
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          agent_id: string
          amenities: string[]
          available_from: string | null
          bathrooms: number
          bedrooms: number
          city: string
          created_at: string
          description: string | null
          furnished: boolean
          id: string
          image_url: string
          is_featured: boolean
          neighborhood: string
          pet_friendly: boolean
          price_monthly: number
          sqft: number | null
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amenities?: string[]
          available_from?: string | null
          bathrooms: number
          bedrooms: number
          city: string
          created_at?: string
          description?: string | null
          furnished?: boolean
          id?: string
          image_url: string
          is_featured?: boolean
          neighborhood: string
          pet_friendly?: boolean
          price_monthly: number
          sqft?: number | null
          state: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amenities?: string[]
          available_from?: string | null
          bathrooms?: number
          bedrooms?: number
          city?: string
          created_at?: string
          description?: string | null
          furnished?: boolean
          id?: string
          image_url?: string
          is_featured?: boolean
          neighborhood?: string
          pet_friendly?: boolean
          price_monthly?: number
          sqft?: number | null
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bedrooms: number | null
          budget_max: number | null
          budget_min: number | null
          created_at: string
          daily_chat_count: number
          daily_chat_reset_at: string
          daily_draft_count: number
          daily_draft_reset_at: string
          email: string | null
          full_name: string | null
          id: string
          pet_friendly: boolean | null
          preferred_state: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bedrooms?: number | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          daily_chat_count?: number
          daily_chat_reset_at?: string
          daily_draft_count?: number
          daily_draft_reset_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          pet_friendly?: boolean | null
          preferred_state?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bedrooms?: number | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          daily_chat_count?: number
          daily_chat_reset_at?: string
          daily_draft_count?: number
          daily_draft_reset_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          pet_friendly?: boolean | null
          preferred_state?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      pwa_events: {
        Row: {
          created_at: string
          event: string
          id: string
          meta: Json | null
          platform: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          meta?: Json | null
          platform?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          meta?: Json | null
          platform?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          done: boolean
          due_at: string
          external_listing_id: string | null
          id: string
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at: string
          external_listing_id?: string | null
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string
          external_listing_id?: string | null
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "external_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_daily_chat: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          allowed: boolean
          remaining: number
          tier: string
        }[]
      }
      consume_daily_draft: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          allowed: boolean
          remaining: number
          tier: string
        }[]
      }
      get_shared_listing: {
        Args: { _token: string }
        Returns: {
          bathrooms: number
          bedrooms: number
          created_at: string
          expired: boolean
          id: string
          location: string
          notes: string
          price_monthly: number
          share_expires_at: string
          share_mask_sensitive: boolean
          source: string
          title: string
          url: string
        }[]
      }
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

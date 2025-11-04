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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_bot_assignments: {
        Row: {
          auto_execute: boolean | null
          bot_id: string
          created_at: string
          executed_at: string | null
          id: string
          signal_id: string
          status: string
          trading_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_execute?: boolean | null
          bot_id: string
          created_at?: string
          executed_at?: string | null
          id?: string
          signal_id: string
          status?: string
          trading_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_execute?: boolean | null
          bot_id?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          signal_id?: string
          status?: string
          trading_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_bot_assignments_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_assignments_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "trading_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_assignments_trading_account_id_fkey"
            columns: ["trading_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_bots: {
        Row: {
          bot_name: string
          created_at: string
          id: string
          settings: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          bot_name: string
          created_at?: string
          id?: string
          settings?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          bot_name?: string
          created_at?: string
          id?: string
          settings?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      copy_trading_relationships: {
        Row: {
          created_at: string
          follower_account_id: string | null
          follower_user_id: string | null
          id: string
          master_account_id: string | null
          master_user_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          follower_account_id?: string | null
          follower_user_id?: string | null
          id?: string
          master_account_id?: string | null
          master_user_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          follower_account_id?: string | null
          follower_user_id?: string | null
          id?: string
          master_account_id?: string | null
          master_user_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copy_trading_relationships_follower_account_id_fkey"
            columns: ["follower_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trading_relationships_master_account_id_fkey"
            columns: ["master_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bank_statement_url: string | null
          city: string | null
          date_of_birth: string | null
          document_type: string
          fica_compliant: boolean | null
          full_name: string | null
          id: string
          id_number: string | null
          image_url: string
          physical_address: string | null
          postal_code: string | null
          proof_of_residence_url: string | null
          province: string | null
          status: string | null
          submitted_at: string
          user_id: string
          verification_notes: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bank_statement_url?: string | null
          city?: string | null
          date_of_birth?: string | null
          document_type: string
          fica_compliant?: boolean | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          image_url: string
          physical_address?: string | null
          postal_code?: string | null
          proof_of_residence_url?: string | null
          province?: string | null
          status?: string | null
          submitted_at?: string
          user_id: string
          verification_notes?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bank_statement_url?: string | null
          city?: string | null
          date_of_birth?: string | null
          document_type?: string
          fica_compliant?: boolean | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          image_url?: string
          physical_address?: string | null
          postal_code?: string | null
          proof_of_residence_url?: string | null
          province?: string | null
          status?: string | null
          submitted_at?: string
          user_id?: string
          verification_notes?: string | null
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          email: string
          id: string
          image_url: string
          plan: string
          status: string | null
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          email: string
          id?: string
          image_url: string
          plan: string
          status?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          email?: string
          id?: string
          image_url?: string
          plan?: string
          status?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pending_trades: {
        Row: {
          awaiting_confirmation: boolean | null
          created_at: string | null
          direction: string
          expires_at: string | null
          id: string
          lot_size: number | null
          risk_percent: number | null
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
        }
        Insert: {
          awaiting_confirmation?: boolean | null
          created_at?: string | null
          direction: string
          expires_at?: string | null
          id?: string
          lot_size?: number | null
          risk_percent?: number | null
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id: string
        }
        Update: {
          awaiting_confirmation?: boolean | null
          created_at?: string | null
          direction?: string
          expires_at?: string | null
          id?: string
          lot_size?: number | null
          risk_percent?: number | null
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          closed_at: string | null
          comment: string | null
          created_at: string
          direction: string
          entry_price: number | null
          executed_at: string
          exit_price: number | null
          id: string
          profit_loss: number | null
          signal_id: string | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          trading_account_id: string
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          direction: string
          entry_price?: number | null
          executed_at?: string
          exit_price?: number | null
          id?: string
          profit_loss?: number | null
          signal_id?: string | null
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          trading_account_id: string
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          executed_at?: string
          exit_price?: number | null
          id?: string
          profit_loss?: number | null
          signal_id?: string | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          trading_account_id?: string
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_history_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "trading_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_history_trading_account_id_fkey"
            columns: ["trading_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          balance: number | null
          connection_status: string | null
          created_at: string
          equity: number | null
          id: string
          is_master: boolean | null
          login: string
          metaapi_account_id: string
          name: string
          platform: string
          server: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number | null
          connection_status?: string | null
          created_at?: string
          equity?: number | null
          id?: string
          is_master?: boolean | null
          login: string
          metaapi_account_id: string
          name: string
          platform: string
          server: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number | null
          connection_status?: string | null
          created_at?: string
          equity?: number | null
          id?: string
          is_master?: boolean | null
          login?: string
          metaapi_account_id?: string
          name?: string
          platform?: string
          server?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          comment: string | null
          created_at: string
          direction: string
          expires_at: string | null
          id: string
          lot_size: number
          open_price: number | null
          order_type: string | null
          scheduled_at: string | null
          status: string | null
          stop_loss: number | null
          symbol: string
          take_profit: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction: string
          expires_at?: string | null
          id?: string
          lot_size: number
          open_price?: number | null
          order_type?: string | null
          scheduled_at?: string | null
          status?: string | null
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: string
          expires_at?: string | null
          id?: string
          lot_size?: number
          open_price?: number | null
          order_type?: string | null
          scheduled_at?: string | null
          status?: string | null
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          appearance_theme: string | null
          created_at: string
          email_notifications: Json | null
          id: string
          language: string | null
          push_notifications: Json | null
          timezone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          appearance_theme?: string | null
          created_at?: string
          email_notifications?: Json | null
          id?: string
          language?: string | null
          push_notifications?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          appearance_theme?: string | null
          created_at?: string
          email_notifications?: Json | null
          id?: string
          language?: string | null
          push_notifications?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_expired_pending_trades: { Args: never; Returns: undefined }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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

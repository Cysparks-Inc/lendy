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
      audit_log: {
        Row: {
          action: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          email: string | null
          id: number
          is_active: boolean | null
          location: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          id?: never
          is_active?: boolean | null
          location?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          id?: never
          is_active?: boolean | null
          location?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_logs: {
        Row: {
          contact_method: string
          created_at: string | null
          id: number
          loan_id: string
          log_date: string
          next_follow_up_date: string | null
          notes: string
          officer_id: string
        }
        Insert: {
          contact_method: string
          created_at?: string | null
          id?: number
          loan_id: string
          log_date?: string
          next_follow_up_date?: string | null
          notes: string
          officer_id: string
        }
        Update: {
          contact_method?: string
          created_at?: string | null
          id?: number
          loan_id?: string
          log_date?: string
          next_follow_up_date?: string | null
          notes?: string
          officer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "collection_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          communication_type: string
          created_at: string | null
          follow_up_date: string | null
          follow_up_notes: string | null
          id: string
          loan_id: string | null
          member_id: string | null
          notes: string
          officer_id: string | null
          updated_at: string | null
        }
        Insert: {
          communication_type: string
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          id?: string
          loan_id?: string | null
          member_id?: string | null
          notes: string
          officer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          communication_type?: string
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          id?: string
          loan_id?: string | null
          member_id?: string | null
          notes?: string
          officer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_email_tracker: {
        Row: {
          can_reuse_after: string | null
          deleted_at: string | null
          deleted_user_id: string
          id: string
          is_reusable: boolean | null
          notes: string | null
          original_email: string
        }
        Insert: {
          can_reuse_after?: string | null
          deleted_at?: string | null
          deleted_user_id: string
          id?: string
          is_reusable?: boolean | null
          notes?: string | null
          original_email: string
        }
        Update: {
          can_reuse_after?: string | null
          deleted_at?: string | null
          deleted_user_id?: string
          id?: string
          is_reusable?: boolean | null
          notes?: string | null
          original_email?: string
        }
        Relationships: []
      }
      expense_approvals: {
        Row: {
          action: string
          approval_level: Database["public"]["Enums"]["approval_level"]
          approved_at: string | null
          approver_id: string
          comments: string | null
          expense_id: string
          id: string
        }
        Insert: {
          action: string
          approval_level: Database["public"]["Enums"]["approval_level"]
          approved_at?: string | null
          approver_id: string
          comments?: string | null
          expense_id: string
          id?: string
        }
        Update: {
          action?: string
          approval_level?: Database["public"]["Enums"]["approval_level"]
          approved_at?: string | null
          approver_id?: string
          comments?: string | null
          expense_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_budgets: {
        Row: {
          branch_id: number | null
          budget_amount: number
          category_id: string | null
          created_at: string | null
          created_by: string
          id: string
          month: number | null
          remaining_amount: number | null
          spent_amount: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          branch_id?: number | null
          budget_amount: number
          category_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          month?: number | null
          remaining_amount?: number | null
          spent_amount?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          branch_id?: number | null
          budget_amount?: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          month?: number | null
          remaining_amount?: number | null
          spent_amount?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          budget_limit: number | null
          code: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          budget_limit?: number | null
          code: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          budget_limit?: number | null
          code?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_reports: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          last_generated: string | null
          next_generation: string | null
          parameters: Json | null
          report_name: string
          report_type: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          last_generated?: string | null
          next_generation?: string | null
          parameters?: Json | null
          report_name: string
          report_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          last_generated?: string | null
          next_generation?: string | null
          parameters?: Json | null
          report_name?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachments: Json | null
          branch_id: number | null
          category_id: string | null
          created_at: string | null
          created_by: string
          currency: string | null
          department: string | null
          description: string | null
          due_date: string | null
          expense_date: string
          expense_number: string
          id: string
          invoice_number: string | null
          notes: string | null
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          priority: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["expense_status"] | null
          tags: string[] | null
          title: string
          updated_at: string | null
          vendor_contact: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          attachments?: Json | null
          branch_id?: number | null
          category_id?: string | null
          created_at?: string | null
          created_by: string
          currency?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          expense_date: string
          expense_number: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          priority?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          vendor_contact?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          attachments?: Json | null
          branch_id?: number | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          expense_date?: string
          expense_number?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          priority?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vendor_contact?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          assigned_officer_id: string | null
          branch_id: number | null
          code: string | null
          contact_person_id: string | null
          created_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          description: string | null
          id: number
          is_active: boolean | null
          loan_officer_id: string | null
          location: string | null
          meeting_day: string | null
          meeting_time: string | null
          name: string
          processing_fee: number | null
          status: string | null
        }
        Insert: {
          assigned_officer_id?: string | null
          branch_id?: number | null
          code?: string | null
          contact_person_id?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          description?: string | null
          id?: never
          is_active?: boolean | null
          loan_officer_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name: string
          processing_fee?: number | null
          status?: string | null
        }
        Update: {
          assigned_officer_id?: string | null
          branch_id?: number | null
          code?: string | null
          contact_person_id?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          description?: string | null
          id?: never
          is_active?: boolean | null
          loan_officer_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name?: string
          processing_fee?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_assigned_officer_id_fkey"
            columns: ["assigned_officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_assigned_officer_id_fkey"
            columns: ["assigned_officer_id"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_assigned_officer_id_fkey"
            columns: ["assigned_officer_id"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_increment_levels: {
        Row: {
          amount: number
          created_at: string | null
          id: number
          level: number
          payment_weeks_12: boolean | null
          payment_weeks_8: boolean | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: number
          level: number
          payment_weeks_12?: boolean | null
          payment_weeks_8?: boolean | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: number
          level?: number
          payment_weeks_12?: boolean | null
          payment_weeks_8?: boolean | null
        }
        Relationships: []
      }
      loan_installments: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          due_date: string
          id: string
          installment_number: number
          interest_amount: number
          is_paid: boolean | null
          loan_id: string
          paid_date: string | null
          principal_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          interest_amount: number
          is_paid?: boolean | null
          loan_id: string
          paid_date?: string | null
          principal_amount: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          interest_amount?: number
          is_paid?: boolean | null
          loan_id?: string
          paid_date?: string | null
          principal_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          installment_number: number
          loan_id: string
          notes: string | null
          payment_date: string
          payment_reference: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          installment_number: number
          loan_id: string
          notes?: string | null
          payment_date?: string
          payment_reference: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          installment_number?: number
          loan_id?: string
          notes?: string | null
          payment_date?: string
          payment_reference?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      loans: {
        Row: {
          account_number: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: number | null
          created_at: string
          created_by: string | null
          current_balance: number
          customer_id: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string
          group_id: number | null
          id: string
          increment_level: number | null
          installment_type: string | null
          interest_disbursed: number | null
          interest_rate: number
          interest_type: Database["public"]["Enums"]["interest_type"]
          is_deleted: boolean | null
          issue_date: string
          late_payment_penalty_rate: number | null
          loan_officer_id: string | null
          loan_program: string | null
          member_id: string | null
          payment_weeks: number
          penalty_type: string | null
          previous_loan_id: string | null
          principal_amount: number
          processing_fee: number | null
          rejection_reason: string | null
          repayment_schedule: Database["public"]["Enums"]["repayment_schedule"]
          status: Database["public"]["Enums"]["loan_status"]
          total_disbursed: number | null
          total_interest_accrued: number
          total_paid: number
          updated_at: string
          written_off_date: string | null
        }
        Insert: {
          account_number?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: number | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          customer_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date: string
          group_id?: number | null
          id?: string
          increment_level?: number | null
          installment_type?: string | null
          interest_disbursed?: number | null
          interest_rate: number
          interest_type?: Database["public"]["Enums"]["interest_type"]
          is_deleted?: boolean | null
          issue_date?: string
          late_payment_penalty_rate?: number | null
          loan_officer_id?: string | null
          loan_program?: string | null
          member_id?: string | null
          payment_weeks?: number
          penalty_type?: string | null
          previous_loan_id?: string | null
          principal_amount: number
          processing_fee?: number | null
          rejection_reason?: string | null
          repayment_schedule: Database["public"]["Enums"]["repayment_schedule"]
          status?: Database["public"]["Enums"]["loan_status"]
          total_disbursed?: number | null
          total_interest_accrued?: number
          total_paid?: number
          updated_at?: string
          written_off_date?: string | null
        }
        Update: {
          account_number?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: number | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          customer_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string
          group_id?: number | null
          id?: string
          increment_level?: number | null
          installment_type?: string | null
          interest_disbursed?: number | null
          interest_rate?: number
          interest_type?: Database["public"]["Enums"]["interest_type"]
          is_deleted?: boolean | null
          issue_date?: string
          late_payment_penalty_rate?: number | null
          loan_officer_id?: string | null
          loan_program?: string | null
          member_id?: string | null
          payment_weeks?: number
          penalty_type?: string | null
          previous_loan_id?: string | null
          principal_amount?: number
          processing_fee?: number | null
          rejection_reason?: string | null
          repayment_schedule?: Database["public"]["Enums"]["repayment_schedule"]
          status?: Database["public"]["Enums"]["loan_status"]
          total_disbursed?: number | null
          total_interest_accrued?: number
          total_paid?: number
          updated_at?: string
          written_off_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_previous_loan_id_fkey"
            columns: ["previous_loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loans_previous_loan_id_fkey"
            columns: ["previous_loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_previous_loan_id_fkey"
            columns: ["previous_loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_previous_loan_id_fkey"
            columns: ["previous_loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_previous_loan_id_fkey"
            columns: ["previous_loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      members: {
        Row: {
          activation_fee_paid: boolean | null
          address: string | null
          address_1: string | null
          address_2: string | null
          assigned_officer_id: string | null
          bank_account: string | null
          branch_id: number | null
          created_at: string
          created_by: string | null
          dob: string | null
          full_name: string
          group_assignment: string | null
          group_id: number | null
          guarantor_contact_number: string | null
          house_owner: string | null
          house_type: string | null
          id: string
          id_number: string
          kra_pin: string | null
          kyc_id_type: string | null
          last_activity_date: string | null
          location: string | null
          marital_status: string | null
          member_no: string | null
          monthly_income: number | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          notes: string | null
          phone_number: string
          photo_url: string | null
          profession: string | null
          profession_other: string | null
          profile_picture_url: string | null
          registration_fee_paid: boolean | null
          sex: string | null
          spouse_dob: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          activation_fee_paid?: boolean | null
          address?: string | null
          address_1?: string | null
          address_2?: string | null
          assigned_officer_id?: string | null
          bank_account?: string | null
          branch_id?: number | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          full_name: string
          group_assignment?: string | null
          group_id?: number | null
          guarantor_contact_number?: string | null
          house_owner?: string | null
          house_type?: string | null
          id?: string
          id_number: string
          kra_pin?: string | null
          kyc_id_type?: string | null
          last_activity_date?: string | null
          location?: string | null
          marital_status?: string | null
          member_no?: string | null
          monthly_income?: number | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          notes?: string | null
          phone_number: string
          photo_url?: string | null
          profession?: string | null
          profession_other?: string | null
          profile_picture_url?: string | null
          registration_fee_paid?: boolean | null
          sex?: string | null
          spouse_dob?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          activation_fee_paid?: boolean | null
          address?: string | null
          address_1?: string | null
          address_2?: string | null
          assigned_officer_id?: string | null
          bank_account?: string | null
          branch_id?: number | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          full_name?: string
          group_assignment?: string | null
          group_id?: number | null
          guarantor_contact_number?: string | null
          house_owner?: string | null
          house_type?: string | null
          id?: string
          id_number?: string
          kra_pin?: string | null
          kyc_id_type?: string | null
          last_activity_date?: string | null
          location?: string | null
          marital_status?: string | null
          member_no?: string | null
          monthly_income?: number | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          notes?: string | null
          phone_number?: string
          photo_url?: string | null
          profession?: string | null
          profession_other?: string | null
          profile_picture_url?: string | null
          registration_fee_paid?: boolean | null
          sex?: string | null
          spouse_dob?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      next_of_kin: {
        Row: {
          contact_number: string | null
          created_at: string | null
          dob: string | null
          full_name: string
          id: number
          member_id: string
          relationship: string | null
          sex: string | null
        }
        Insert: {
          contact_number?: string | null
          created_at?: string | null
          dob?: string | null
          full_name: string
          id?: number
          member_id: string
          relationship?: string | null
          sex?: string | null
        }
        Update: {
          contact_number?: string | null
          created_at?: string | null
          dob?: string | null
          full_name?: string
          id?: number
          member_id?: string
          relationship?: string | null
          sex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "next_of_kin_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_of_kin_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: number
          interest_component: number
          loan_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          principal_component: number
          recorded_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: number
          interest_component?: number
          loan_id: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          principal_component?: number
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: number
          interest_component?: number
          loan_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          principal_component?: number
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: number | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone_number: string | null
          profile_picture_url: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: number | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          phone_number?: string | null
          profile_picture_url?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: number | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          profile_picture_url?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      realizable_assets: {
        Row: {
          asset_type: string
          branch_id: number | null
          created_at: string
          created_by: string
          current_market_value: number
          description: string
          id: string
          last_valuation_date: string
          loan_id: string | null
          location: string | null
          member_id: string | null
          notes: string | null
          original_value: number
          realizable_value: number
          realization_period: number
          recovery_likelihood: string
          risk_factor: number
          status: string
          updated_at: string
        }
        Insert: {
          asset_type: string
          branch_id?: number | null
          created_at?: string
          created_by?: string
          current_market_value?: number
          description: string
          id?: string
          last_valuation_date?: string
          loan_id?: string | null
          location?: string | null
          member_id?: string | null
          notes?: string | null
          original_value?: number
          realizable_value?: number
          realization_period?: number
          recovery_likelihood?: string
          risk_factor?: number
          status?: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          branch_id?: number | null
          created_at?: string
          created_by?: string
          current_market_value?: number
          description?: string
          id?: string
          last_valuation_date?: string
          loan_id?: string | null
          location?: string | null
          member_id?: string | null
          notes?: string | null
          original_value?: number
          realizable_value?: number
          realization_period?: number
          recovery_likelihood?: string
          risk_factor?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realizable_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "realizable_assets_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "realizable_assets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizable_assets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      repayments: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string
          notes: string | null
          payment_date: string
          recorded_by: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          notes?: string | null
          payment_date?: string
          recorded_by: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      system_settings: {
        Row: {
          auto_calculate_interest: boolean
          backup_frequency: string
          company_email: string | null
          company_name: string
          company_phone: string | null
          default_interest_rate: number
          default_penalty_rate: number
          email_notifications: boolean
          id: number
          loan_term_months: number
          max_loan_amount: number
          min_loan_amount: number
          sms_notifications: boolean
          updated_at: string | null
        }
        Insert: {
          auto_calculate_interest?: boolean
          backup_frequency?: string
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          default_interest_rate?: number
          default_penalty_rate?: number
          email_notifications?: boolean
          id: number
          loan_term_months?: number
          max_loan_amount?: number
          min_loan_amount?: number
          sms_notifications?: boolean
          updated_at?: string | null
        }
        Update: {
          auto_calculate_interest?: boolean
          backup_frequency?: string
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          default_interest_rate?: number
          default_penalty_rate?: number
          email_notifications?: boolean
          id?: number
          loan_term_months?: number
          max_loan_amount?: number
          min_loan_amount?: number
          sms_notifications?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          branch_id: number | null
          created_at: string | null
          created_by: string | null
          currency: string
          description: string
          fees: number | null
          id: string
          interest_paid: number | null
          loan_id: string | null
          member_id: string | null
          notes: string | null
          payment_method: string
          penalties: number | null
          principal_paid: number | null
          receipt_url: string | null
          reference_number: string
          status: string
          total_paid: number | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          branch_id?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description: string
          fees?: number | null
          id?: string
          interest_paid?: number | null
          loan_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_method: string
          penalties?: number | null
          principal_paid?: number | null
          receipt_url?: string | null
          reference_number: string
          status?: string
          total_paid?: number | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          branch_id?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string
          fees?: number | null
          id?: string
          interest_paid?: number | null
          loan_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_method?: string
          penalties?: number | null
          principal_paid?: number | null
          receipt_url?: string | null
          reference_number?: string
          status?: string
          total_paid?: number | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_roles: {
        Row: {
          branch_id: number
          id: number
          role: string
          user_id: string
        }
        Insert: {
          branch_id: number
          id?: never
          role: string
          user_id: string
        }
        Update: {
          branch_id?: number
          id?: never
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          permission: string
          user_id: string
        }
        Insert: {
          permission: string
          user_id: string
        }
        Update: {
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      branch_basic_view: {
        Row: {
          created_at: string | null
          id: number | null
          loan_count: number | null
          location: string | null
          member_count: number | null
          name: string | null
          total_outstanding: number | null
          total_portfolio: number | null
        }
        Relationships: []
      }
      branch_summary_view: {
        Row: {
          avg_loan_size: number | null
          created_at: string | null
          id: number | null
          loan_count: number | null
          location: string | null
          member_count: number | null
          name: string | null
          total_outstanding: number | null
          total_portfolio: number | null
        }
        Relationships: []
      }
      communication_logs_with_details: {
        Row: {
          branch_id: number | null
          branch_name: string | null
          communication_type: string | null
          created_at: string | null
          follow_up_date: string | null
          follow_up_notes: string | null
          id: string | null
          loan_id: string | null
          member_id: string | null
          member_name: string | null
          notes: string | null
          officer_id: string | null
          officer_name: string | null
          officer_role: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "super_admin_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "user_profile_view"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_stats: {
        Row: {
          active_loans: number | null
          outstanding_balance: number | null
          overdue_loans: number | null
          total_disbursed: number | null
          total_loans: number | null
          total_members: number | null
        }
        Relationships: []
      }
      group_summary_view: {
        Row: {
          branch_id: number | null
          branch_name: string | null
          description: string | null
          group_created_at: string | null
          id: number | null
          last_activity: string | null
          loan_count: number | null
          loan_officer_count: number | null
          member_count: number | null
          name: string | null
          total_outstanding: number | null
          total_portfolio: number | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      groups_with_details: {
        Row: {
          branch_id: number | null
          branch_name: string | null
          created_at: string | null
          id: number | null
          loan_officer_id: string | null
          loan_officer_name: string | null
          location: string | null
          member_count: number | null
          name: string | null
          outstanding_balance: number | null
          total_loans: number | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installment_schedule: {
        Row: {
          due_date: string | null
          installment_interest: number | null
          installment_number: number | null
          installment_principal: number | null
          installment_total: number | null
          installment_type: string | null
          interest_disbursed: number | null
          issue_date: string | null
          loan_id: string | null
          loan_program: string | null
          principal_amount: number | null
          repayment_weeks: number | null
          total_disbursed: number | null
        }
        Relationships: []
      }
      loans_with_details: {
        Row: {
          account_number: string | null
          branch_id: number | null
          branch_name: string | null
          created_at: string | null
          created_by: string | null
          current_balance: number | null
          customer_id: string | null
          due_date: string | null
          group_id: number | null
          group_name: string | null
          id: string | null
          interest_rate: number | null
          issue_date: string | null
          loan_officer_id: string | null
          loan_officer_name: string | null
          member_id: string | null
          member_id_number: string | null
          member_name: string | null
          member_phone: string | null
          member_status: string | null
          principal_amount: number | null
          status: Database["public"]["Enums"]["loan_status"] | null
          total_paid: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      members_with_details: {
        Row: {
          address: string | null
          assigned_officer_id: string | null
          assigned_officer_name: string | null
          branch_id: number | null
          branch_name: string | null
          created_at: string | null
          full_name: string | null
          group_id: number | null
          group_name: string | null
          id: string | null
          id_number: string | null
          kyc_id_type: string | null
          marital_status: string | null
          monthly_income: number | null
          outstanding_balance: number | null
          phone_number: string | null
          profession: string | null
          sex: string | null
          status: string | null
          total_loans: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_with_profile: {
        Row: {
          amount: number | null
          created_at: string | null
          id: number | null
          loan_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          recorded_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_installment_schedule"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "recent_loans"
            referencedColumns: ["member_id"]
          },
        ]
      }
      recent_loans: {
        Row: {
          due_date: string | null
          id: string | null
          member_id: string | null
          member_name: string | null
          principal_amount: number | null
          status: Database["public"]["Enums"]["loan_status"] | null
        }
        Relationships: []
      }
      super_admin_ids: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      transaction_summary: {
        Row: {
          amount: number | null
          balance_after: number | null
          balance_before: number | null
          branch_address: string | null
          branch_name: string | null
          created_at: string | null
          created_by_name: string | null
          currency: string | null
          description: string | null
          fees: number | null
          id: string | null
          interest_paid: number | null
          loan_account_number: string | null
          loan_officer_name: string | null
          loan_officer_phone: string | null
          member_id_number: string | null
          member_name: string | null
          member_phone: string | null
          notes: string | null
          payment_method: string | null
          penalties: number | null
          principal_paid: number | null
          reference_number: string | null
          status: string | null
          total_paid: number | null
          transaction_date: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      user_profile_view: {
        Row: {
          branch_id: number | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          phone_number: string | null
          profile_picture_url: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          phone_number?: string | null
          profile_picture_url?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          phone_number?: string | null
          profile_picture_url?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_basic_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_branch: {
        Args: { admin_user_id: string; branch_id: number }
        Returns: boolean
      }
      activate_dormant_member: {
        Args: { member_uuid: string }
        Returns: boolean
      }
      activate_group: {
        Args: { admin_user_id: string; group_id: number }
        Returns: boolean
      }
      activate_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      admin_update_user_role: {
        Args: {
          admin_user_id: string
          new_branch_id?: number
          new_role: string
          target_user_id: string
        }
        Returns: undefined
      }
      assign_unassigned_members_to_officer: {
        Args: { officer_id_param: string }
        Returns: undefined
      }
      calculate_loan_details: {
        Args: { p_loan_program: string; p_principal: number }
        Returns: {
          interest_amount: number
          interest_rate: number
          processing_fee: number
          repayment_weeks: number
          total_disbursed: number
        }[]
      }
      calculate_loan_interest: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      can_reuse_email: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_user_active: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cleanup_user_references: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      cleanup_user_references_simple: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      deactivate_branch: {
        Args: { admin_user_id: string; branch_id: number }
        Returns: boolean
      }
      deactivate_group: {
        Args: { admin_user_id: string; group_id: number }
        Returns: boolean
      }
      deactivate_user: {
        Args: { reason?: string; target_user_id: string }
        Returns: undefined
      }
      debug_table_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          exists_flag: boolean
          row_count: number
          table_name: string
        }[]
      }
      delete_loan: {
        Args: { admin_user_id: string; loan_id: string }
        Returns: boolean
      }
      distribute_payment_across_installments: {
        Args: { p_amount: number; p_loan_id: string }
        Returns: boolean
      }
      force_email_reuse: {
        Args: { email_to_force: string }
        Returns: boolean
      }
      generate_installment_schedule: {
        Args: {
          p_installment_type?: string
          p_interest_amount: number
          p_issue_date: string
          p_loan_id: string
          p_principal: number
          p_repayment_weeks: number
        }
        Returns: {
          due_date: string
          installment_number: number
          interest_amount: number
          principal_amount: number
          total_amount: number
        }[]
      }
      get_bad_debt_loans: {
        Args: { requesting_user_id?: string }
        Returns: {
          account_number: string
          branch_name: string
          current_balance: number
          days_overdue: number
          days_since_last_payment: number
          due_date: string
          id: string
          is_problem: boolean
          issue_date: string
          last_payment_date: string
          loan_officer_name: string
          member_id: string
          member_name: string
          principal_amount: number
          status: string
        }[]
      }
      get_bad_debt_report: {
        Args: { requesting_user_id: string }
        Returns: {
          account_number: string
          branch_name: string
          id: string
          loan_officer_name: string
          member_id: string
          member_name: string
          principal_amount: number
          written_off_balance: number
          written_off_date: string
        }[]
      }
      get_branch_detailed_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_loans: number
          active_members: number
          avg_loan_size: number
          created_at: string
          defaulted_loans: number
          id: number
          last_activity: string
          loan_count: number
          location: string
          member_count: number
          name: string
          recovery_rate: number
          total_outstanding: number
          total_portfolio: number
        }[]
      }
      get_branch_performance_comparison: {
        Args: Record<PropertyKey, never>
        Returns: {
          branch_name: string
          efficiency_score: number
          loan_growth_rate: number
          member_growth_rate: number
          portfolio_growth_rate: number
        }[]
      }
      get_branch_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          id: number
          loan_count: number
          location: string
          member_count: number
          name: string
          total_loans: number
          total_outstanding: number
          total_portfolio: number
        }[]
      }
      get_communication_logs_for_user: {
        Args: {
          loan_id_filter?: string
          member_id_filter?: string
          requesting_user_id: string
        }
        Returns: {
          branch_name: string
          communication_type: string
          created_at: string
          follow_up_date: string
          follow_up_notes: string
          id: string
          loan_id: string
          member_id: string
          member_name: string
          notes: string
          officer_id: string
          officer_name: string
          officer_role: string
          updated_at: string
        }[]
      }
      get_current_user_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_branch_id: number
          user_role: string
        }[]
      }
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_loans: number
          defaulted_loans: number
          outstanding_balance: number
          repaid_loans: number
          total_customers: number
          total_disbursed: number
          total_loans: number
          total_repaid: number
        }[]
      }
      get_dashboard_stats_for_user: {
        Args: { user_branch_id?: number; user_id?: string; user_role: string }
        Returns: {
          active_loans: number
          outstanding_balance: number
          overdue_loans: number
          total_disbursed: number
          total_loans: number
          total_members: number
        }[]
      }
      get_dormant_members: {
        Args: Record<PropertyKey, never>
        Returns: {
          activation_fee_paid: boolean
          branch_name: string
          full_name: string
          id: string
          id_number: string
          last_activity_date: string
          months_inactive: number
          phone_number: string
          status: string
        }[]
      }
      get_dormant_members_report: {
        Args: { dormancy_days?: number; requesting_user_id: string }
        Returns: {
          branch_name: string
          days_inactive: number
          full_name: string
          id: string
          last_payment_date: string
          outstanding_balance: number
          phone_number: string
          profile_picture_url: string
          status: string
        }[]
      }
      get_email_reuse_status: {
        Args: { email_to_check: string }
        Returns: {
          can_reuse_after: string
          deleted_at: string
          email: string
          is_reusable: boolean
          notes: string
          time_until_reusable: unknown
        }[]
      }
      get_group_activity_timeline: {
        Args: { days_back?: number; group_id_param: number }
        Returns: {
          activity_date: string
          activity_type: string
          amount: number
          description: string
          loan_officer_name: string
          member_name: string
        }[]
      }
      get_group_comprehensive_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_loans: number
          active_members: number
          avg_loan_size: number
          avg_member_age: number
          branch_id: number
          branch_name: string
          created_at: string
          description: string
          group_health_score: number
          id: number
          last_activity: string
          loan_count: number
          member_count: number
          name: string
          total_loan_officers: number
          total_outstanding: number
          total_portfolio: number
        }[]
      }
      get_group_loan_officers: {
        Args: { group_id_param: number }
        Returns: {
          active_loans: number
          assigned_members: number
          avg_loan_size: number
          email: string
          full_name: string
          last_activity: string
          officer_id: string
          phone_number: string
          total_portfolio: number
        }[]
      }
      get_group_loan_summary: {
        Args: { group_id_param: number }
        Returns: {
          account_number: string
          current_balance: number
          days_overdue: number
          due_date: string
          interest_accrued: number
          issue_date: string
          loan_id: string
          loan_officer_name: string
          member_name: string
          principal_amount: number
          status: string
          total_paid: number
        }[]
      }
      get_group_members_detailed: {
        Args: { group_id_param: number }
        Returns: {
          active_loans: number
          address: string
          assigned_officer_id: string
          full_name: string
          id: string
          id_number: string
          last_loan_date: string
          loan_officer_name: string
          member_since: string
          monthly_income: number
          phone_number: string
          profession: string
          status: string
          total_loans: number
          total_outstanding: number
        }[]
      }
      get_group_performance_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          branch_name: string
          efficiency_score: number
          group_id: number
          group_name: string
          loan_growth_rate: number
          member_growth_rate: number
          portfolio_growth_rate: number
          repayment_rate: number
          risk_score: number
        }[]
      }
      get_installment_overdue_loans_report: {
        Args: { requesting_user_id?: string }
        Returns: {
          account_number: string
          applied_at: string
          branch_id: number
          branch_name: string
          days_overdue: number
          due_date: string
          id: string
          installment_amount: number
          last_payment_date: string
          loan_balance: number
          loan_officer_id: string
          loan_officer_name: string
          loan_program: string
          member_id: string
          member_name: string
          next_due_date: string
          overdue_amount: number
          overdue_installments: number
          paid_installments: number
          phone_number: string
          principal_amount: number
          risk_level: string
          total_installments: number
        }[]
      }
      get_loan_officer_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_loans: number
          branch_id: number
          branch_name: string
          completed_loans: number
          created_at: string
          defaulted_loans: number
          email: string
          id: string
          name: string
          pending_loans: number
          phone: string
          profile_picture_url: string
          total_balance: number
          total_disbursed: number
          total_loans: number
        }[]
      }
      get_master_roll_data: {
        Args: { requesting_user_id: string }
        Returns: {
          branch_name: string
          created_at: string
          full_name: string
          group_name: string
          id: string
          id_number: string
          last_payment_date: string
          outstanding_balance: number
          phone_number: string
          profile_picture_url: string
          status: string
          total_loans: number
        }[]
      }
      get_members_by_officer: {
        Args: { officer_id: string }
        Returns: {
          full_name: string
          id: string
          outstanding_balance: number
          phone_number: string
          total_loans: number
        }[]
      }
      get_members_for_user: {
        Args: { requesting_user_id: string }
        Returns: {
          branch_name: string
          full_name: string
          id_number: string
          member_id: string
          outstanding_balance: number
          phone_number: string
          status: string
          total_loans: number
        }[]
      }
      get_next_loan_increment: {
        Args: { _member_id: string }
        Returns: {
          can_borrow_less: boolean
          next_amount: number
          next_level: number
          payment_weeks_12: boolean
          payment_weeks_8: boolean
        }[]
      }
      get_officer_performance_data: {
        Args: { requesting_user_id: string }
        Returns: {
          active_loans: number
          branch_id: number
          branch_name: string
          completed_loans: number
          created_at: string
          defaulted_loans: number
          email: string
          id: string
          name: string
          pending_loans: number
          phone: string
          profile_picture_url: string
          total_balance: number
          total_disbursed: number
          total_loans: number
        }[]
      }
      get_overdue_loans_report: {
        Args: { requesting_user_id?: string }
        Returns: {
          account_number: string
          applied_at: string
          branch_id: number
          branch_name: string
          days_overdue: number
          due_date: string
          id: string
          last_payment_date: string
          loan_balance: number
          loan_officer_id: string
          loan_officer_name: string
          loan_program: string
          member_id: string
          member_name: string
          overdue_amount: number
          paid_installments: number
          phone_number: string
          principal_amount: number
          risk_level: string
          total_installments: number
        }[]
      }
      get_realizable_assets_report: {
        Args: { requesting_user_id: string }
        Returns: {
          asset_type: string
          branch_name: string
          current_market_value: number
          description: string
          id: string
          last_valuation_date: string
          loan_account_number: string
          loan_id: string
          location: string
          member_id: string
          member_name: string
          notes: string
          original_value: number
          realizable_value: number
          realization_period: number
          recovery_likelihood: string
          risk_factor: number
          status: string
        }[]
      }
      get_unified_overdue_loans_report: {
        Args: { requesting_user_id?: string }
        Returns: {
          account_number: string
          applied_at: string
          branch_id: number
          branch_name: string
          days_overdue: number
          due_date: string
          id: string
          installment_amount: number
          last_payment_date: string
          loan_balance: number
          loan_officer_id: string
          loan_officer_name: string
          loan_program: string
          member_id: string
          member_name: string
          next_due_date: string
          overdue_amount: number
          overdue_installments: number
          paid_installments: number
          phone_number: string
          principal_amount: number
          risk_level: string
          total_installments: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_super_admin_user: {
        Args: { user_id: string }
        Returns: boolean
      }
      member_has_pending_loans: {
        Args: { _member_id: string }
        Returns: boolean
      }
      search_members_robust: {
        Args: { current_user_id?: string; search_term: string }
        Returns: {
          activation_fee_paid: boolean
          branch_id: number
          branch_name: string
          full_name: string
          group_id: number
          group_name: string
          id: string
          id_number: string
          phone_number: string
          status: string
        }[]
      }
      search_members_securely: {
        Args: { requesting_user_id: string; search_term: string }
        Returns: {
          branch_name: string
          full_name: string
          id: string
          id_number: string
          outstanding_balance: number
          phone_number: string
          profile_picture_url: string
          status: string
          total_loans: number
        }[]
      }
      search_members_simple: {
        Args: { search_term: string }
        Returns: {
          activation_fee_paid: boolean
          branch_id: string
          branch_name: string
          full_name: string
          group_id: string
          group_name: string
          id: string
          id_number: string
          phone_number: string
          status: string
        }[]
      }
      set_loan_approval_status: {
        Args: { p_loan_id: string; p_set_by: string; p_status: string }
        Returns: undefined
      }
      track_deleted_email: {
        Args: { user_email: string; user_id: string }
        Returns: undefined
      }
      transfer_member_to_new_officer: {
        Args: { member_id_param: string; new_officer_id_param: string }
        Returns: undefined
      }
      update_profile_personal_details: {
        Args: {
          full_name?: string
          phone_number?: string
          profile_picture_url?: string
          user_id: string
        }
        Returns: undefined
      }
      validate_loan_increment: {
        Args: {
          _member_id: string
          _payment_weeks: number
          _requested_amount: number
          _user_role: string
        }
        Returns: {
          error_message: string
          is_valid: boolean
          suggested_amount: number
          suggested_payment_weeks: number
        }[]
      }
      write_off_loan: {
        Args: {
          loan_uuid: string
          requesting_user_uuid: string
          write_off_notes: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "super_admin"
      approval_level: "super_admin" | "finance_manager" | "branch_manager"
      expense_category:
        | "office_supplies"
        | "utilities"
        | "rent"
        | "salaries"
        | "marketing"
        | "travel"
        | "equipment"
        | "maintenance"
        | "insurance"
        | "legal_fees"
        | "consulting"
        | "training"
        | "software"
        | "hardware"
        | "communications"
        | "transportation"
        | "meals"
        | "entertainment"
        | "other"
      expense_status: "active" | "inactive"
      interest_type: "simple" | "compound"
      loan_status:
        | "active"
        | "repaid"
        | "defaulted"
        | "pending"
        | "bad_debt"
        | "approved"
        | "disbursed"
        | "completed"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "check"
        | "mobile_money"
        | "credit_card"
        | "debit_card"
        | "other"
      repayment_schedule:
        | "weekly"
        | "monthly"
        | "Weekly"
        | "Monthly"
        | "End of Term"
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
      app_role: ["admin", "staff", "super_admin"],
      approval_level: ["super_admin", "finance_manager", "branch_manager"],
      expense_category: [
        "office_supplies",
        "utilities",
        "rent",
        "salaries",
        "marketing",
        "travel",
        "equipment",
        "maintenance",
        "insurance",
        "legal_fees",
        "consulting",
        "training",
        "software",
        "hardware",
        "communications",
        "transportation",
        "meals",
        "entertainment",
        "other",
      ],
      expense_status: ["active", "inactive"],
      interest_type: ["simple", "compound"],
      loan_status: [
        "active",
        "repaid",
        "defaulted",
        "pending",
        "bad_debt",
        "approved",
        "disbursed",
        "completed",
      ],
      payment_method: [
        "cash",
        "bank_transfer",
        "check",
        "mobile_money",
        "credit_card",
        "debit_card",
        "other",
      ],
      repayment_schedule: [
        "weekly",
        "monthly",
        "Weekly",
        "Monthly",
        "End of Term",
      ],
    },
  },
} as const

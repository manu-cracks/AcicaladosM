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
      attendance_justifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendance_id: string | null
          audit_history: Json
          created_at: string
          employee_id: string
          evidence_url: string | null
          id: string
          observation: string | null
          reason: string
          registered_by: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_id?: string | null
          audit_history?: Json
          created_at?: string
          employee_id: string
          evidence_url?: string | null
          id?: string
          observation?: string | null
          reason: string
          registered_by?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_id?: string | null
          audit_history?: Json
          created_at?: string
          employee_id?: string
          evidence_url?: string | null
          id?: string
          observation?: string | null
          reason?: string
          registered_by?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_justifications_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "employee_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_justifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          created_at: string
          entry_tolerance_minutes: number
          exit_tolerance_minutes: number
          id: string
          shift_entry_time: string
          shift_exit_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_tolerance_minutes?: number
          exit_tolerance_minutes?: number
          id?: string
          shift_entry_time?: string
          shift_exit_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_tolerance_minutes?: number
          exit_tolerance_minutes?: number
          id?: string
          shift_entry_time?: string
          shift_exit_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      bonus_settings: {
        Row: {
          bonus_start_time: string
          day_name: string
          day_of_week: number
          effective_from: string
          effective_to: string | null
          id: number
          is_active: boolean
          rounding_method: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bonus_start_time: string
          day_name: string
          day_of_week: number
          effective_from?: string
          effective_to?: string | null
          id?: number
          is_active?: boolean
          rounding_method?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bonus_start_time?: string
          day_name?: string
          day_of_week?: number
          effective_from?: string
          effective_to?: string | null
          id?: number
          is_active?: boolean
          rounding_method?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      booking_services: {
        Row: {
          assigned_employee_id: string | null
          booking_id: string
          created_at: string
          duration_minutes: number
          end_time: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          liberado_at: string | null
          service_id: string | null
          service_name: string
          service_price_cents: number
          start_time: string | null
          status: string | null
        }
        Insert: {
          assigned_employee_id?: string | null
          booking_id: string
          created_at?: string
          duration_minutes: number
          end_time?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          liberado_at?: string | null
          service_id?: string | null
          service_name: string
          service_price_cents: number
          start_time?: string | null
          status?: string | null
        }
        Update: {
          assigned_employee_id?: string | null
          booking_id?: string
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          liberado_at?: string | null
          service_id?: string | null
          service_name?: string
          service_price_cents?: number
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          advance_amount_cents: number
          advance_percentage: number
          assigned_employee_id: string | null
          balance_cents: number
          billing_address: string | null
          billing_doc_number: string | null
          billing_doc_type: string | null
          billing_name: string | null
          booking_code: string
          booking_date: string
          cancelled_at: string | null
          client_dni: string | null
          client_email: string | null
          client_first_name: string
          client_last_name: string
          client_phone: string | null
          completed_at: string | null
          comprobante_numero: number | null
          comprobante_serie: string | null
          comprobante_tipo: string | null
          confirmed_at: string | null
          created_at: string
          culqi_charge_id: string | null
          culqi_order_id: string | null
          end_time: string
          expired_at: string | null
          id: string
          payment_method: string | null
          payment_status: string
          pdf_url: string | null
          service_type: string
          slot_lock_expires_at: string | null
          slot_locked_at: string | null
          start_time: string
          total_duration_minutes: number
          total_price_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          advance_amount_cents: number
          advance_percentage: number
          assigned_employee_id?: string | null
          balance_cents: number
          billing_address?: string | null
          billing_doc_number?: string | null
          billing_doc_type?: string | null
          billing_name?: string | null
          booking_code?: string
          booking_date: string
          cancelled_at?: string | null
          client_dni?: string | null
          client_email?: string | null
          client_first_name: string
          client_last_name: string
          client_phone?: string | null
          completed_at?: string | null
          comprobante_numero?: number | null
          comprobante_serie?: string | null
          comprobante_tipo?: string | null
          confirmed_at?: string | null
          created_at?: string
          culqi_charge_id?: string | null
          culqi_order_id?: string | null
          end_time: string
          expired_at?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string
          pdf_url?: string | null
          service_type: string
          slot_lock_expires_at?: string | null
          slot_locked_at?: string | null
          start_time: string
          total_duration_minutes: number
          total_price_cents: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          advance_amount_cents?: number
          advance_percentage?: number
          assigned_employee_id?: string | null
          balance_cents?: number
          billing_address?: string | null
          billing_doc_number?: string | null
          billing_doc_type?: string | null
          billing_name?: string | null
          booking_code?: string
          booking_date?: string
          cancelled_at?: string | null
          client_dni?: string | null
          client_email?: string | null
          client_first_name?: string
          client_last_name?: string
          client_phone?: string | null
          completed_at?: string | null
          comprobante_numero?: number | null
          comprobante_serie?: string | null
          comprobante_tipo?: string | null
          confirmed_at?: string | null
          created_at?: string
          culqi_charge_id?: string | null
          culqi_order_id?: string | null
          end_time?: string
          expired_at?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string
          pdf_url?: string | null
          service_type?: string
          slot_lock_expires_at?: string | null
          slot_locked_at?: string | null
          start_time?: string
          total_duration_minutes?: number
          total_price_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      business_config: {
        Row: {
          advance_percentage: number
          business_name: string
          created_at: string
          facebook_url: string | null
          google_maps_url: string | null
          id: number
          instagram_url: string | null
          opening_hours: Json | null
          tiktok_url: string | null
          updated_at: string
          whatsapp_url: string | null
          youtube_url: string | null
        }
        Insert: {
          advance_percentage?: number
          business_name?: string
          created_at?: string
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: never
          instagram_url?: string | null
          opening_hours?: Json | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          advance_percentage?: number
          business_name?: string
          created_at?: string
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: never
          instagram_url?: string | null
          opening_hours?: Json | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      egresos: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string
          receipt_number: string | null
          receipt_type: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_number?: string | null
          receipt_type?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_number?: string | null
          receipt_type?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_attendances: {
        Row: {
          bonus_adjusted_at: string | null
          bonus_adjusted_by: string | null
          bonus_adjustment_reason: string | null
          bonus_calculation_type: string
          bonus_minutes: number
          check_in: string
          check_in_justified: boolean
          check_out: string | null
          check_out_justified: boolean
          created_at: string
          date: string
          employee_id: string
          entry_justification: string | null
          exit_justification: string | null
          id: string
          notes: string | null
          overtime_minutes: number | null
          status: string
          tardy_minutes: number | null
          updated_at: string
        }
        Insert: {
          bonus_adjusted_at?: string | null
          bonus_adjusted_by?: string | null
          bonus_adjustment_reason?: string | null
          bonus_calculation_type?: string
          bonus_minutes?: number
          check_in?: string
          check_in_justified?: boolean
          check_out?: string | null
          check_out_justified?: boolean
          created_at?: string
          date?: string
          employee_id: string
          entry_justification?: string | null
          exit_justification?: string | null
          id?: string
          notes?: string | null
          overtime_minutes?: number | null
          status?: string
          tardy_minutes?: number | null
          updated_at?: string
        }
        Update: {
          bonus_adjusted_at?: string | null
          bonus_adjusted_by?: string | null
          bonus_adjustment_reason?: string | null
          bonus_calculation_type?: string
          bonus_minutes?: number
          check_in?: string
          check_in_justified?: boolean
          check_out?: string | null
          check_out_justified?: boolean
          created_at?: string
          date?: string
          employee_id?: string
          entry_justification?: string | null
          exit_justification?: string | null
          id?: string
          notes?: string | null
          overtime_minutes?: number | null
          status?: string
          tardy_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_attendances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_blocks: {
        Row: {
          block_date: string
          created_at: string
          document_url: string | null
          employee_id: string
          end_date: string | null
          end_time: string | null
          id: string
          is_full_day: boolean | null
          leave_type: string | null
          reason: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          block_date: string
          created_at?: string
          document_url?: string | null
          employee_id: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          leave_type?: string | null
          reason?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          block_date?: string
          created_at?: string
          document_url?: string | null
          employee_id?: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          leave_type?: string | null
          reason?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_blocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          employee_id: string
          end_time: string
          id: string
          is_active: boolean
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          employee_id: string
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          employee_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skills: {
        Row: {
          assigned_at: string
          employee_id: string
          id: string
          service_id: string
        }
        Insert: {
          assigned_at?: string
          employee_id: string
          id?: string
          service_id: string
        }
        Update: {
          assigned_at?: string
          employee_id?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skills_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_url: string | null
          commission_percentage: number | null
          created_at: string
          dni: string | null
          email: string | null
          first_name: string
          handles_reception: boolean | null
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          profile_id: string | null
          rotation_order: number
          shift_end: string | null
          shift_start: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          commission_percentage?: number | null
          created_at?: string
          dni?: string | null
          email?: string | null
          first_name: string
          handles_reception?: boolean | null
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          profile_id?: string | null
          rotation_order?: number
          shift_end?: string | null
          shift_start?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          commission_percentage?: number | null
          created_at?: string
          dni?: string | null
          email?: string | null
          first_name?: string
          handles_reception?: boolean | null
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          profile_id?: string | null
          rotation_order?: number
          shift_end?: string | null
          shift_start?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          description: string
          employee_id: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_method: string
          receipt_url: string | null
          registered_by: string | null
          status: string
          supplier: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string
          description: string
          employee_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_url?: string | null
          registered_by?: string | null
          status?: string
          supplier?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          description?: string
          employee_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_url?: string | null
          registered_by?: string | null
          status?: string
          supplier?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          amount_cents: number | null
          booking_id: string | null
          cash_amount_cents: number
          created_at: string
          culqi_event_id: string | null
          currency: string | null
          event_type: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          paid_at: string | null
          payload: Json | null
          payment_method: string | null
          payment_type: string | null
          processing_result: string | null
          processing_time_ms: number | null
          proof_url: string | null
          registered_by: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          yape_amount_cents: number
        }
        Insert: {
          amount_cents?: number | null
          booking_id?: string | null
          cash_amount_cents?: number
          created_at?: string
          culqi_event_id?: string | null
          currency?: string | null
          event_type?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          paid_at?: string | null
          payload?: Json | null
          payment_method?: string | null
          payment_type?: string | null
          processing_result?: string | null
          processing_time_ms?: number | null
          proof_url?: string | null
          registered_by?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          yape_amount_cents?: number
        }
        Update: {
          amount_cents?: number | null
          booking_id?: string | null
          cash_amount_cents?: number
          created_at?: string
          culqi_event_id?: string | null
          currency?: string | null
          event_type?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          paid_at?: string | null
          payload?: Json | null
          payment_method?: string | null
          payment_type?: string | null
          processing_result?: string | null
          processing_time_ms?: number | null
          proof_url?: string | null
          registered_by?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          yape_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          description: string | null
          features: string[] | null
          id: string
          images: string[]
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          features?: string[] | null
          id?: string
          images?: string[]
          is_active?: boolean
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          features?: string[] | null
          id?: string
          images?: string[]
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dni: string | null
          first_name: string | null
          id: string
          is_profile_complete: boolean
          last_name: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dni?: string | null
          first_name?: string | null
          id: string
          is_profile_complete?: boolean
          last_name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dni?: string | null
          first_name?: string | null
          id?: string
          is_profile_complete?: boolean
          last_name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          attributes: Json | null
          capacity: number
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          images: string[]
          is_active: boolean
          is_public: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          staff_required: number
          type: string
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          capacity?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes: number
          id?: string
          images?: string[]
          is_active?: boolean
          is_public?: boolean
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          staff_required?: number
          type: string
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          capacity?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          images?: string[]
          is_active?: boolean
          is_public?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          staff_required?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          client_name: string
          content: string
          created_at: string
          id: string
          is_published: boolean
          rating: number
          sort_order: number
        }
        Insert: {
          client_name: string
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          sort_order?: number
        }
        Update: {
          client_name?: string
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          sort_order?: number
        }
        Relationships: []
      }
      ventas_mostrador: {
        Row: {
          cantidad: number
          cliente_nombre: string
          created_at: string
          fecha: string
          id: string
          metodo_pago: string
          notas: string | null
          precio_unitario: number
          producto_nombre: string
          registrado_por: string | null
          ticket_number: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cantidad?: number
          cliente_nombre: string
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string
          notas?: string | null
          precio_unitario: number
          producto_nombre: string
          registrado_por?: string | null
          ticket_number?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          cliente_nombre?: string
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string
          notas?: string | null
          precio_unitario?: number
          producto_nombre?: string
          registrado_por?: string | null
          ticket_number?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      wardrobe_items: {
        Row: {
          availability_status: string
          category: string | null
          code: string | null
          created_at: string
          deposit_cents: number
          description: string | null
          guarantee_cents: number
          id: string
          images: string[]
          is_active: boolean
          name: string
          price_cents: number
          section: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          availability_status?: string
          category?: string | null
          code?: string | null
          created_at?: string
          deposit_cents?: number
          description?: string | null
          guarantee_cents?: number
          id?: string
          images?: string[]
          is_active?: boolean
          name: string
          price_cents?: number
          section?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          availability_status?: string
          category?: string | null
          code?: string | null
          created_at?: string
          deposit_cents?: number
          description?: string | null
          guarantee_cents?: number
          id?: string
          images?: string[]
          is_active?: boolean
          name?: string
          price_cents?: number
          section?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      wardrobe_movements: {
        Row: {
          advance_cents: number
          attended_by: string | null
          client_dni: string | null
          client_first_name: string
          client_last_name: string
          client_phone: string | null
          created_at: string
          guarantee_cents: number
          id: string
          notes: string | null
          occasion: string | null
          price_cents: number
          return_date: string | null
          section: string | null
          status: string
          updated_at: string
          wardrobe_item_id: string
        }
        Insert: {
          advance_cents?: number
          attended_by?: string | null
          client_dni?: string | null
          client_first_name: string
          client_last_name: string
          client_phone?: string | null
          created_at?: string
          guarantee_cents?: number
          id?: string
          notes?: string | null
          occasion?: string | null
          price_cents?: number
          return_date?: string | null
          section?: string | null
          status?: string
          updated_at?: string
          wardrobe_item_id: string
        }
        Update: {
          advance_cents?: number
          attended_by?: string | null
          client_dni?: string | null
          client_first_name?: string
          client_last_name?: string
          client_phone?: string | null
          created_at?: string
          guarantee_cents?: number
          id?: string
          notes?: string | null
          occasion?: string | null
          price_cents?: number
          return_date?: string | null
          section?: string | null
          status?: string
          updated_at?: string
          wardrobe_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wardrobe_movements_attended_by_fkey"
            columns: ["attended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wardrobe_movements_wardrobe_item_id_fkey"
            columns: ["wardrobe_item_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_stale_bookings: { Args: never; Returns: undefined }
      recalculate_booking_payment: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      get_employee_agenda: {
        Args: {
          p_employee_id: string
          p_date?: string | null
        }
        Returns: {
          id: string
          booking_id: string
          booking_code: string
          client_name: string
          client_phone: string
          client_email: string
          booking_date: string
          service_id: string
          service_name: string
          service_price_cents: number
          duration_minutes: number
          start_time: string
          end_time: string
          status: string
          payment_status: string
        }[]
      }
      get_financial_balances: {
        Args: {
          p_date?: string | null
          p_start_date?: string | null
          p_end_date?: string | null
        }
        Returns: {
          ingresos_servicios_cents: number
          ventas_mostrador_cents: number
          total_ingresos_cents: number
          total_egresos_cents: number
          balance_neto_cents: number
          citas_count: number
          citas_confirmadas_count: number
          query_date: string | null
          timezone: string
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

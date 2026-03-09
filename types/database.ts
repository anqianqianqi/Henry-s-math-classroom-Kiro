// Database types will be generated from Supabase
// For now, using a placeholder type
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // More tables will be added as we implement the schema
      class_occurrences: {
        Row: {
          id: string
          class_id: string
          occurrence_date: string
          start_time: string
          end_time: string
          session_number: number
          topic: string | null
          status: 'upcoming' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          occurrence_date: string
          start_time: string
          end_time: string
          session_number: number
          topic?: string | null
          status?: 'upcoming' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          occurrence_date?: string
          start_time?: string
          end_time?: string
          session_number?: number
          topic?: string | null
          status?: 'upcoming' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      session_materials: {
        Row: {
          id: string
          occurrence_id: string
          uploaded_by: string
          title: string
          description: string | null
          file_url: string
          file_type: string
          file_size: number
          material_type: 'document' | 'link' | 'note' | 'recording'
          is_available: boolean
          uploaded_at: string
        }
        Insert: {
          id?: string
          occurrence_id: string
          uploaded_by: string
          title: string
          description?: string | null
          file_url: string
          file_type: string
          file_size: number
          material_type?: 'document' | 'link' | 'note' | 'recording'
          is_available?: boolean
          uploaded_at?: string
        }
        Update: {
          id?: string
          occurrence_id?: string
          uploaded_by?: string
          title?: string
          description?: string | null
          file_url?: string
          file_type?: string
          file_size?: number
          material_type?: 'document' | 'link' | 'note' | 'recording'
          is_available?: boolean
          uploaded_at?: string
        }
      }
      homework_assignments: {
        Row: {
          id: string
          occurrence_id: string
          created_by: string
          title: string
          description: string
          due_date: string
          points_possible: number
          submission_type: 'file' | 'text' | 'link'
          assignment_file_url: string | null
          allow_late: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          occurrence_id: string
          created_by: string
          title: string
          description: string
          due_date: string
          points_possible?: number
          submission_type?: 'file' | 'text' | 'link'
          assignment_file_url?: string | null
          allow_late?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          occurrence_id?: string
          created_by?: string
          title?: string
          description?: string
          due_date?: string
          points_possible?: number
          submission_type?: 'file' | 'text' | 'link'
          assignment_file_url?: string | null
          allow_late?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      homework_submissions: {
        Row: {
          id: string
          assignment_id: string
          student_id: string
          submission_type: 'file' | 'text' | 'link'
          file_url: string | null
          text_content: string | null
          link_url: string | null
          comments: string | null
          submitted_at: string
          is_late: boolean
          version: number
        }
        Insert: {
          id?: string
          assignment_id: string
          student_id: string
          submission_type: 'file' | 'text' | 'link'
          file_url?: string | null
          text_content?: string | null
          link_url?: string | null
          comments?: string | null
          submitted_at?: string
          is_late?: boolean
          version?: number
        }
        Update: {
          id?: string
          assignment_id?: string
          student_id?: string
          submission_type?: 'file' | 'text' | 'link'
          file_url?: string | null
          text_content?: string | null
          link_url?: string | null
          comments?: string | null
          submitted_at?: string
          is_late?: boolean
          version?: number
        }
      }
      homework_grades: {
        Row: {
          id: string
          submission_id: string
          graded_by: string
          points_earned: number
          feedback: string | null
          status: 'draft' | 'published'
          graded_at: string
          published_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          graded_by: string
          points_earned: number
          feedback?: string | null
          status?: 'draft' | 'published'
          graded_at?: string
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          graded_by?: string
          points_earned?: number
          feedback?: string | null
          status?: 'draft' | 'published'
          graded_at?: string
          published_at?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_has_permission: {
        Args: {
          p_user_id: string
          p_permission_name: string
          p_class_id?: string
        }
        Returns: boolean
      }
      user_has_submitted: {
        Args: {
          p_user_id: string
          p_challenge_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

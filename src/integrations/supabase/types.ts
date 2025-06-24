export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      course_enrollments: {
        Row: {
          course_id: string | null
          created_at: string | null
          enrolled_at: string | null
          id: string
          last_accessed_at: string | null
          progress: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          last_accessed_at?: string | null
          progress?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          last_accessed_at?: string | null
          progress?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          order: number
          title: string
          video_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title: string
          video_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sections_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "minio_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      key_points: {
        Row: {
          chapter_id: string | null
          created_at: string
          description: string | null
          id: string
          order: number
          title: string
          updated_at: string
          video_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title: string
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title?: string
          updated_at?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_points_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_points_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "minio_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          price: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          price?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          price?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      keep_alive: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          completed: boolean | null
          id: string
          last_watched_position: number | null
          progress: number | null
          updated_at: string
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          completed?: boolean | null
          id?: string
          last_watched_position?: number | null
          progress?: number | null
          updated_at?: string
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          completed?: boolean | null
          id?: string
          last_watched_position?: number | null
          progress?: number | null
          updated_at?: string
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      minio_videos: {
        Row: {
          content_type: string | null
          created_at: string
          description: string | null
          file_size: number | null
          id: string
          minio_object_name: string
          play_url: string | null
          play_url_expires_at: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          id?: string
          minio_object_name: string
          play_url?: string | null
          play_url_expires_at?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          id?: string
          minio_object_name?: string
          play_url?: string | null
          play_url_expires_at?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_expires_at: string
          created_at: string
          department: string | null
          full_name: string | null
          grade: string | null
          id: string
          major: string | null
          phone_number: string
          school: string | null
          updated_at: string
          user_type: string
          username: string
        }
        Insert: {
          access_expires_at?: string
          created_at?: string
          department?: string | null
          full_name?: string | null
          grade?: string | null
          id: string
          major?: string | null
          phone_number: string
          school?: string | null
          updated_at?: string
          user_type?: string
          username: string
        }
        Update: {
          access_expires_at?: string
          created_at?: string
          department?: string | null
          full_name?: string | null
          grade?: string | null
          id?: string
          major?: string | null
          phone_number?: string
          school?: string | null
          updated_at?: string
          user_type?: string
          username?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: number
          setting_key: string
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          setting_key?: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          completed_at: string | null
          course_id: string | null
          created_at: string | null
          current_position: number | null
          duration: number | null
          first_played_at: string | null
          id: string
          is_completed: boolean | null
          last_played_at: string | null
          progress_percentage: number | null
          section_id: string | null
          updated_at: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string | null
          current_position?: number | null
          duration?: number | null
          first_played_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_played_at?: string | null
          progress_percentage?: number | null
          section_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string | null
          current_position?: number | null
          duration?: number | null
          first_played_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_played_at?: string | null
          progress_percentage?: number | null
          section_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_progress_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "minio_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          duration: number | null
          id: string
          order: number | null
          title: string
          video_url: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          order?: number | null
          title: string
          video_url: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          order?: number | null
          title?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_permissions: {
        Args: { target_id: string }
        Returns: Json
      }
      check_username_exists: {
        Args: { username: string }
        Returns: boolean
      }
      get_course_study_data: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: Json
      }
      get_student_page_data: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_email_by_username: {
        Args: { username_input: string }
        Returns: string
      }
      get_login_email_by_username: {
        Args: { username_input: string }
        Returns: string
      }
      get_user_type: {
        Args: Record<PropertyKey, never>
        Returns: string
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

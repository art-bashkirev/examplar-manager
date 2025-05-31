export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      skill: {
        Row: {
          id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      level: {
        Row: {
          id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercise_type: {
        Row: {
          id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_tasks: {
        Row: {
          id: string
          name: string
          description: string
          skill_id: string | null
          level_id: string | null
          exercise_type_id: string | null
          design_instructions: string
          difficulty_instructions: string
          difficulty_calibration: string
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          skill_id?: string | null
          level_id?: string | null
          exercise_type_id?: string | null
          design_instructions: string
          difficulty_instructions: string
          difficulty_calibration: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          skill_id?: string | null
          level_id?: string | null
          exercise_type_id?: string | null
          design_instructions?: string
          difficulty_instructions?: string
          difficulty_calibration?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_tasks_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_tasks_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            referencedRelation: "exercise_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_tasks_level_id_fkey"
            columns: ["level_id"]
            referencedRelation: "level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_tasks_skill_id_fkey"
            columns: ["skill_id"]
            referencedRelation: "skill"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_task_parameters: {
        Row: {
          parameter_id: number // Changed from id to parameter_id to match actual DB column
          task_id: string // DDL: task_id text
          name: string
          placeholder: string
          description: string | null
          default_value: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number // DDL: parameter_id serial
          task_id: string // DDL: task_id text
          name: string
          placeholder: string
          description?: string | null
          default_value?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number // DDL: parameter_id serial
          task_id?: string // DDL: task_id text
          name?: string
          placeholder?: string
          description?: string | null
          default_value?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_task_parameters_task_id_fkey"
            columns: ["task_id"] // Mapped from task_id in DDL
            referencedRelation: "exam_tasks"
            referencedColumns: ["id"]
          },
        ]
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

// Custom types for app convenience
export type Skill = Database["public"]["Tables"]["skill"]["Row"]
export type Level = Database["public"]["Tables"]["level"]["Row"]
export type ExerciseType = Database["public"]["Tables"]["exercise_type"]["Row"]

export type ExamTask = Database["public"]["Tables"]["exam_tasks"]["Row"]
// Mapping DDL: parameter_id -> id
export type ExamTaskParameter = Omit<Database["public"]["Tables"]["exam_task_parameters"]["Row"], "parameter_id"> & {
  id: string // Client-side we'll treat serial as string after fetch or use string for new params before insert
}

export interface ExamTaskWithParameters extends ExamTask {
  parameters: ExamTaskParameter[]
}

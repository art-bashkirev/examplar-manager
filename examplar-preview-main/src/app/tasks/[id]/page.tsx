import { createSupabaseServerClient } from "@/lib/supabase/server"
import { TaskForm } from "@/components/tasks/TaskForm"
// import { redirect } from "next/navigation";
import type { ExamTaskWithParameters, ExamTask, ExamTaskParameter, Database } from "@/types/database.types"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface TaskDetailPageProps {
  params: { id: string }
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  console.log(`[TaskDetailPage] Rendering for Task ID from params:`, params.id)

  const supabase = await createSupabaseServerClient()
  console.log(`[TaskDetailPage/${params.id}] Supabase client created.`)

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    console.error(`[TaskDetailPage/${params.id}] Authentication error:`, authError?.message || "User data is null.")
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Authentication Failed</h1>
        <p className="mt-2 text-muted-foreground">
          Could not retrieve user session: {authError?.message || "Unknown error"}. Please try logging in again.
        </p>
        <Button asChild className="mt-4">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  const user = authData.user
  console.log(`[TaskDetailPage/${params.id}] Authenticated user retrieved. User ID:`, user.id)

  if (!user.id) {
    console.error(`[TaskDetailPage/${params.id}] User ID missing from session. User object:`, user)
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Authentication Error</h1>
        <p className="mt-2 text-muted-foreground">User ID is missing from your session. Please try logging in again.</p>
        <Button asChild className="mt-4">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  let examTask: ExamTask | null = null
  let parametersFromDb: Database["public"]["Tables"]["exam_task_parameters"]["Row"][] | null = null
  let examTaskError: any = null
  let paramsError: any = null

  console.log(
    `[TaskDetailPage/${params.id}] STEP 1: Attempting to fetch exam_task (ID: ${params.id}) for user_id: ${user.id}`,
  )
  try {
    const taskResult = await supabase
      .from("exam_tasks")
      .select("*, skill:skill_id(*), level:level_id(*), exercise_type:exercise_type_id(*)") // Fetch related data as well
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single()

    if (taskResult.error || !taskResult.data) {
      examTaskError = taskResult.error || new Error("Task not found or user mismatch")
      console.error(
        `[TaskDetailPage/${params.id}] Error fetching exam_task or task not found:`,
        examTaskError?.message,
        "Data:",
        taskResult.data,
      )
    } else {
      examTask = taskResult.data
      console.log(
        `[TaskDetailPage/${params.id}] Successfully fetched exam_task (raw data):`,
        JSON.stringify(examTask, null, 2),
      ) // Added log
    }

    if (examTask) {
      console.log(
        `[TaskDetailPage/${params.id}] STEP 2: exam_task found (ID: ${examTask.id}). Now attempting to fetch its parameters from 'exam_task_parameters' table where task_id = ${examTask.id}.`,
      )
      const paramsResult = await supabase.from("exam_task_parameters").select("*").eq("task_id", examTask.id) // Query by task_id foreign key referencing exam_tasks.id

      if (paramsResult.error) {
        paramsError = paramsResult.error
        console.error(
          `[TaskDetailPage/${params.id}] Error fetching parameters from 'exam_task_parameters' for task_id ${examTask.id}:`,
          paramsError.message,
        )
      } else {
        parametersFromDb = paramsResult.data
        console.log(
          `[TaskDetailPage/${params.id}] Successfully fetched parameters from 'exam_task_parameters' (raw data):`,
          JSON.stringify(parametersFromDb, null, 2),
        ) // Existing log
        if (parametersFromDb && parametersFromDb.length === 0) {
          console.log(
            `[TaskDetailPage/${params.id}] Parameter lookup in 'exam_task_parameters' for task_id ${examTask.id} was successful but returned an empty array (no parameters found for this task).`,
          )
        }
      }
    }
  } catch (err) {
    console.error(`[TaskDetailPage/${params.id}] Unexpected error during data fetching for task or parameters:`, err)
    examTaskError = err
  }

  if (examTaskError || !examTask) {
    console.error(
      `[TaskDetailPage/${params.id}] Final check: Error fetching exam_task with ID ${params.id} for user ${user.id}:`,
      examTaskError?.message || "Task is null after fetch attempt.",
    )
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Exam Task Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The exam task (ID: {params.id}) you are looking for either does not exist or you do not have permission to
          view it.
          {examTaskError && <span className="block mt-1 text-xs">Error: {examTaskError.message}</span>}
        </p>
        <Button asChild className="mt-4">
          <Link href="/tasks">Go to Tasks</Link>
        </Button>
      </div>
    )
  }

  if (paramsError) {
    console.warn(
      `[TaskDetailPage/${params.id}] Warning: Error occurred while fetching parameters for exam_task ${params.id}:`,
      paramsError.message,
      "Proceeding with parameters that might be incomplete or empty.",
    )
  }

  console.log(
    `[TaskDetailPage/${params.id}] STEP 3: Sanitizing task data before passing to form... Raw examTask data:`,
    JSON.stringify(examTask, null, 2),
  ) // Added log
  const sanitizedTask: ExamTask = {
    id: examTask!.id,
    name: examTask!.name ?? "",
    description: examTask!.description ?? "",
    skill_id: examTask!.skill_id,
    level_id: examTask!.level_id,
    exercise_type_id: examTask!.exercise_type_id,
    design_instructions: examTask!.design_instructions ?? "",
    difficulty_instructions: examTask!.difficulty_instructions ?? "",
    difficulty_calibration: examTask!.difficulty_calibration ?? "",
    user_id: examTask!.user_id,
    created_at: examTask!.created_at ?? new Date().toISOString(),
    updated_at: examTask!.updated_at ?? new Date().toISOString(),
  }
  console.log(`[TaskDetailPage/${params.id}] Sanitized task for form:`, JSON.stringify(sanitizedTask, null, 2)) // Existing log

  console.log(
    `[TaskDetailPage/${params.id}] STEP 4: Sanitizing parameter data... Original parametersFromDb to be sanitized (fetched from 'exam_task_parameters'):`,
    JSON.stringify(parametersFromDb, null, 2),
  ) // Existing log
  // Add this log to inspect a raw parameter object before mapping
  if (parametersFromDb && parametersFromDb.length > 0) {
    console.log(
      `[TaskDetailPage/${params.id}] Raw parameter object before sanitization:`,
      JSON.stringify(parametersFromDb[0], null, 2),
    )
  }
  const sanitizedParameters: ExamTaskParameter[] = (parametersFromDb || []).map((p) => ({
    id: String(p.parameter_id), // Change from p.id to p.parameter_id
    task_id: p.task_id,
    name: p.name ?? "",
    placeholder: p.placeholder ?? "",
    description: p.description ?? "",
    default_value: p.default_value ?? "",
    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),
  }))
  console.log(
    `[TaskDetailPage/${params.id}] Sanitized parameters for form (these will be part of the prop to TaskForm): ${JSON.stringify(sanitizedParameters, null, 2)}`,
  ) // Existing log

  const examTaskWithParameters: ExamTaskWithParameters = {
    ...sanitizedTask,
    parameters: sanitizedParameters,
  }
  console.log(
    `[TaskDetailPage/${params.id}] STEP 5: Final examTaskWithParameters object being passed to TaskForm: ${JSON.stringify(examTaskWithParameters, null, 2)}`,
  ) // Added log

  return (
    <div>
      <TaskForm task={examTaskWithParameters} userId={user.id} />
    </div>
  )
}

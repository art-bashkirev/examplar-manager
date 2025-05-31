"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import type { ExamTaskWithParameters, Skill, Level, ExerciseType, Database } from "@/types/database.types"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { combineAndExtractUniqueParameterNames, generateHelpForParameter } from "@/lib/parameters"
import { enhanceTaskInstructions } from "@/ai/flows/enhance-task-instructions"
import { debounce } from "@/lib/utils"
import { Trash2, Wand2, PlusCircle, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const parameterSchema = z.object({
  id: z.string().optional(),
  task_id: z.string().optional(),
  name: z.string().min(1, "Parameter name cannot be empty."),
  description: z.string().optional().default(""),
  placeholder: z.string().optional().default(""),
  default_value: z.string().optional().default(""),
})

const taskFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  description: z.string().min(1, { message: "Description is required." }),
  skill_id: z.string({ required_error: "Skill is required." }).min(1, "Skill is required."),
  level_id: z.string({ required_error: "Level is required." }).min(1, "Level is required."),
  exercise_type_id: z.string({ required_error: "Exercise type is required." }).min(1, "Exercise type is required."),
  design_instructions: z.string().min(1, { message: "Design instructions are required." }),
  difficulty_instructions: z.string().min(1, { message: "Difficulty instructions are required." }),
  difficulty_calibration: z.string().min(1, { message: "Difficulty calibration is required." }),
  parameters: z.array(parameterSchema),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

interface TaskFormProps {
  task?: ExamTaskWithParameters | null
  userId: string
}

const DEBOUNCE_DELAY = 750

function generateTaskId(
  name: string,
  skillId: string | null | undefined,
  levelId: string | null | undefined,
  exerciseTypeId: string | null | undefined,
  skills: Skill[],
  levels: Level[],
  exerciseTypes: ExerciseType[],
): string {
  const sanitize = (str: string) =>
    str
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")

  const skillName = skills.find((s) => s.id === skillId)?.name || "unknownskill"
  const levelName = levels.find((l) => l.id === levelId)?.name || "unknownlevel"
  const exerciseTypeName = exerciseTypes.find((et) => et.id === exerciseTypeId)?.name || "unknowntype"

  const namePart = sanitize(name).split("_").slice(0, 3).join("_").substring(0, 30) || "task"

  let baseId = `task_${sanitize(skillName)}_${sanitize(levelName)}_${sanitize(exerciseTypeName)}_${namePart}`
  baseId = baseId.replace(/__+/g, "_").substring(0, 128)
  return baseId
}

export function TaskForm({ task, userId }: TaskFormProps) {
  console.log(
    "[TaskForm] Component rendering/re-rendering. Received task prop (raw):",
    JSON.stringify(task, null, 2),
    "User ID:",
    userId,
  )
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGeneratingHelp, setIsGeneratingHelp] = useState<Record<number, boolean>>({})

  const [skills, setSkills] = useState<Skill[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [initialDbParamIds, setInitialDbParamIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    console.log("[TaskForm] Fetching lookups useEffect triggered.")
    const fetchLookups = async () => {
      setIsLoadingLookups(true)
      console.log("[TaskForm] Starting to fetch skills, levels, exercise types.")
      try {
        const [skillsRes, levelsRes, exerciseTypesRes] = await Promise.all([
          supabase.from("skill").select("*"),
          supabase.from("level").select("*"),
          supabase.from("exercise_type").select("*"),
        ])

        if (skillsRes.error) throw skillsRes.error
        if (levelsRes.error) throw levelsRes.error
        if (exerciseTypesRes.error) throw exerciseTypesRes.error

        setSkills(skillsRes.data || [])
        setLevels(levelsRes.data || [])
        setExerciseTypes(exerciseTypesRes.data || [])
        console.log("[TaskForm] Successfully fetched lookups:", {
          skillsCount: skillsRes.data?.length,
          levelsCount: levelsRes.data?.length,
          exerciseTypesCount: exerciseTypesRes.data?.length,
        })
      } catch (error: any) {
        console.error("[TaskForm] Error fetching lookup data:", error.message)
        toast({ title: "Error fetching lookup data", description: error.message, variant: "destructive" })
      }
      setIsLoadingLookups(false)
      console.log("[TaskForm] Finished fetching lookups.")
    }
    fetchLookups()
  }, [supabase, toast])

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: "",
      description: "",
      skill_id: undefined,
      level_id: undefined,
      exercise_type_id: undefined,
      design_instructions: "",
      difficulty_instructions: "",
      difficulty_calibration: "",
      parameters: [],
    },
  })

  const { fields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "parameters",
    keyName: "fieldId",
  })

  useEffect(() => {
    if (isLoadingLookups) {
      console.log("[TaskForm] Deferring form reset: Lookups are still loading.")
      return
    }
    console.log("[TaskForm] useEffect task check: task prop:", JSON.stringify(task, null, 2))
    console.log(
      "[TaskForm] Task prop change useEffect triggered. Current task prop (from parent):",
      JSON.stringify(task, null, 2),
    )
    if (task && task.id) {
      console.log(
        "[TaskForm] Existing task identified (ID:",
        task.id,
        "). Preparing to reset form with its data. task.parameters received from prop:",
        JSON.stringify(task.parameters, null, 2),
      )

      const mappedParameters =
        task.parameters?.map((p) => ({
          id: p.id ? String(p.id) : undefined, // Convert number ID to string
          task_id: p.task_id,
          name: p.name || "",
          description: p.description || "",
          placeholder: p.placeholder || "",
          default_value: p.default_value || "",
        })) || []

      console.log(
        "[TaskForm] Mapped parameters for existing task (this will be used in replace()):",
        JSON.stringify(mappedParameters, null, 2),
      )

      console.log("[TaskForm] Existing task skill_id:", task.skill_id)
      console.log("[TaskForm] Existing task level_id:", task.level_id)
      console.log("[TaskForm] Existing task exercise_type_id:", task.exercise_type_id)
      form.reset({
        name: task.name || "",
        description: task.description || "",
        skill_id: task.skill_id || undefined,
        level_id: task.level_id || undefined,
        exercise_type_id: task.exercise_type_id || undefined,
        design_instructions: task.design_instructions || "",
        difficulty_instructions: task.difficulty_instructions || "",
        difficulty_calibration: task.difficulty_calibration || "",
        parameters: [], // Initialize parameters as empty in reset, then explicitly use replace for field array
      })
      console.log(
        "[TaskForm] Called form.reset() for existing task's main fields. Now calling replace() for parameters with the mappedParameters shown above.",
      )
      replace(mappedParameters)
      console.log(
        "[TaskForm] Called replace() with mappedParameters. Current form 'fields' state (from useFieldArray) should reflect this update. Check UI.",
      )

      const dbIds = new Set(
        (task.parameters?.map((p) => (p.id ? String(p.id) : undefined)).filter((id) => !!id) as string[]) || [],
      )
      setInitialDbParamIds(dbIds)
      console.log("[TaskForm] Set initialDbParamIds for existing task:", Array.from(dbIds))
    } else {
      console.log("[TaskForm] New task identified (task prop is null or has no id). Resetting form to defaults.")
      form.reset({
        name: "",
        description: "",
        skill_id: undefined,
        level_id: undefined,
        exercise_type_id: undefined,
        design_instructions: "",
        difficulty_instructions: "",
        difficulty_calibration: "",
        parameters: [],
      })
      console.log("[TaskForm] Called form.reset() for new task. Now calling replace([]) for parameters.")
      replace([])
      console.log("[TaskForm] Called replace([]) for new task.")
      setInitialDbParamIds(new Set())
      console.log("[TaskForm] Set initialDbParamIds for new task to empty set.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, form.reset, replace, isLoadingLookups])

  const handleInstructionChange = useCallback(() => {
    // console.log("[TaskForm] handleInstructionChange triggered."); // Reduced verbosity
    const { design_instructions, difficulty_instructions, difficulty_calibration } = form.getValues()
    const detectedParameterNames = combineAndExtractUniqueParameterNames(
      design_instructions,
      difficulty_instructions,
      difficulty_calibration,
    )

    const currentParametersInForm = fields // 'fields' is the live array from useFieldArray

    const newParametersArray: Array<z.infer<typeof parameterSchema>> = []
    const formParameterMap = new Map(currentParametersInForm.map((p) => [p.name, p]))

    detectedParameterNames.forEach((name) => {
      const upperName = name.toUpperCase().replace(/[{}]/g, "")
      const existingParamFromForm = formParameterMap.get(upperName)
      if (existingParamFromForm) {
        newParametersArray.push(existingParamFromForm)
      } else {
        newParametersArray.push({ name: upperName, description: "", placeholder: "", default_value: "" })
      }
    })
    replace(newParametersArray)
  }, [form, fields, replace])

  const debouncedHandleInstructionChange = useMemo(
    () => debounce(handleInstructionChange, DEBOUNCE_DELAY),
    [handleInstructionChange],
  )

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "design_instructions" || name === "difficulty_instructions" || name === "difficulty_calibration") {
        debouncedHandleInstructionChange()
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [form.watch, debouncedHandleInstructionChange])

  const handleEnhanceInstructions = async () => {
    setIsEnhancing(true)
    const {
      name: taskName,
      description: taskDescriptionText,
      skill_id,
      level_id,
      exercise_type_id,
      design_instructions,
      difficulty_instructions,
      difficulty_calibration,
    } = form.getValues()

    const skillName = skills.find((s) => s.id === skill_id)?.name || "N/A"
    const levelName = levels.find((l) => l.id === level_id)?.name || "N/A"
    const exerciseTypeName = exerciseTypes.find((et) => et.id === exercise_type_id)?.name || "N/A"

    try {
      const result = await enhanceTaskInstructions({
        taskName,
        taskDescription: taskDescriptionText,
        skillName,
        levelName,
        exerciseTypeName,
        designInstructions: design_instructions || "",
        difficultyInstructions: difficulty_instructions || "",
        difficultyCalibration: difficulty_calibration || "",
      })
      form.setValue("design_instructions", result.enhancedDesignInstructions, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue("difficulty_instructions", result.enhancedDifficultyInstructions, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue("difficulty_calibration", result.enhancedDifficultyCalibration, {
        shouldDirty: true,
        shouldValidate: true,
      })
      debouncedHandleInstructionChange()
      toast({ title: "Instructions Enhanced", description: "AI has suggested improvements." })
    } catch (error) {
      console.error("[TaskForm] Error enhancing instructions:", error)
      toast({ title: "Enhancement Failed", description: "Could not enhance instructions.", variant: "destructive" })
    }
    setIsEnhancing(false)
  }

  const handleGenerateParameterHelp = async (index: number) => {
    const parameter = fields[index]
    if (!parameter || !parameter.name) {
      toast({ title: "Error", description: "Parameter name is missing.", variant: "destructive" })
      return
    }
    setIsGeneratingHelp((prev) => ({ ...prev, [index]: true }))
    try {
      const currentTaskValues = form.getValues()
      const contextDesc = `Parameter used in task "${currentTaskValues.name}". Design: ${currentTaskValues.design_instructions.substring(0, 100)}...`
      const help = await generateHelpForParameter(parameter.name, contextDesc)

      update(index, {
        ...parameter,
        description: help.description || "",
        placeholder: help.placeholder || "",
        default_value: help.default_value || "",
      })
      form.trigger(`parameters.${index}.description`)
      form.trigger(`parameters.${index}.placeholder`)
      form.trigger(`parameters.${index}.default_value`)
      toast({ title: `Help Generated for ${parameter.name}` })
    } catch (error) {
      console.error(`[TaskForm] Error generating help for ${parameter.name}:`, error)
      toast({ title: "Help Generation Failed", variant: "destructive" })
    }
    setIsGeneratingHelp((prev) => ({ ...prev, [index]: false }))
  }

  const onSubmit = async (values: TaskFormValues) => {
    setIsSubmitting(true)
    let examTaskId = task?.id

    if (!examTaskId) {
      examTaskId = generateTaskId(
        values.name,
        values.skill_id,
        values.level_id,
        values.exercise_type_id,
        skills,
        levels,
        exerciseTypes,
      )
    }

    const taskDataBase = {
      id: examTaskId,
      name: values.name,
      description: values.description,
      skill_id: values.skill_id,
      level_id: values.level_id,
      exercise_type_id: values.exercise_type_id,
      design_instructions: values.design_instructions,
      difficulty_instructions: values.difficulty_instructions,
      difficulty_calibration: values.difficulty_calibration,
      user_id: userId,
    }

    const { data: savedTask, error: taskError } = await supabase
      .from("exam_tasks")
      .upsert(taskDataBase)
      .select()
      .single()

    if (taskError || !savedTask) {
      console.error(
        "[TaskForm] Error saving exam task:",
        taskError?.message || "Unknown error or not authorized. Task Data:",
        savedTask,
      )
      toast({
        title: "Error saving exam task",
        description: taskError?.message || "Unknown error or not authorized",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }
    examTaskId = savedTask.id

    const submittedParametersFromForm = values.parameters
    console.log(
      "[TaskForm] onSubmit - values.parameters at start of upsert:",
      JSON.stringify(values.parameters, null, 2),
    )
    const currentParamIdsInForm = new Set(submittedParametersFromForm.filter((p) => p.id).map((p) => p.id as string))
    const paramsToDeleteIds = Array.from(initialDbParamIds).filter((id) => !currentParamIdsInForm.has(id))

    if (paramsToDeleteIds.length > 0) {
      const numericParamsToDeleteIds = paramsToDeleteIds
        .map((idStr) => Number.parseInt(idStr, 10))
        .filter((numId) => !isNaN(numId))

      if (numericParamsToDeleteIds.length > 0) {
        console.log("[TaskForm] Attempting to delete parameters with numeric IDs:", numericParamsToDeleteIds) // Added log
        const { error: deleteError } = await supabase
          .from("exam_task_parameters")
          .delete()
          .in("parameter_id", numericParamsToDeleteIds) // Change from "id" to "parameter_id"
        if (deleteError) {
          console.warn("[TaskForm] Error deleting old parameters:", deleteError.message)
          toast({
            title: "Warning",
            description: `Could not delete some old parameters: ${deleteError.message}`,
            variant: "default",
          })
        }
      } else if (paramsToDeleteIds.length > 0) {
        // This case means all string IDs failed to parse as numbers
        console.warn("[TaskForm] Parameter IDs scheduled for deletion were all invalid numbers:", paramsToDeleteIds)
        toast({
          title: "Warning",
          description: "Could not delete old parameters due to invalid ID format.",
          variant: "default",
        })
      }
    }

    const upsertPromises = submittedParametersFromForm.map((paramFromForm) => {
      console.log(
        "[TaskForm] onSubmit - processing paramFromForm for upsert:",
        JSON.stringify(paramFromForm, null, 2),
        "paramFromForm.id exists:",
        !!paramFromForm.id,
        "Value of id:",
        paramFromForm.id,
      )
      const paramDataForDb = {
        task_id: examTaskId!,
        name: paramFromForm.name.toUpperCase().replace(/[{}]/g, ""),
        description: paramFromForm.description,
        placeholder: paramFromForm.placeholder,
        default_value: paramFromForm.default_value,
      }
      if (paramFromForm.id) {
        const numericId = Number.parseInt(paramFromForm.id, 10)
        if (!isNaN(numericId)) {
          console.log(
            `[TaskForm] Attempting to update parameter. Form ID (string): ${paramFromForm.id}, Numeric ID for DB: ${numericId}`,
          ) // Added log
          return supabase
            .from("exam_task_parameters")
            .update({
              name: paramDataForDb.name,
              description: paramDataForDb.description,
              placeholder: paramDataForDb.placeholder,
              default_value: paramDataForDb.default_value,
            })
            .eq("parameter_id", numericId) // Change from "id" to "parameter_id"
            .eq("task_id", examTaskId!)
        } else {
          console.error(
            `[TaskForm] Invalid string ID for update, cannot convert to number: ${paramFromForm.id}. Parameter name: ${paramDataForDb.name}`,
          )
          return Promise.resolve({
            error: {
              message: `Invalid ID format for parameter '${paramDataForDb.name}': ${paramFromForm.id}. Update skipped.`,
            },
            data: null,
            status: 400,
            statusText: "Bad Request",
          })
        }
      } else {
        // Logic for insert remains the same
        console.log(`[TaskForm] Attempting to insert new parameter with name: ${paramDataForDb.name}`) // Added log
        const insertData: Database["public"]["Tables"]["exam_task_parameters"]["Insert"] = {
          task_id: examTaskId!,
          name: paramDataForDb.name,
          description: paramDataForDb.description,
          placeholder: paramDataForDb.placeholder || "",
          default_value: paramDataForDb.default_value,
        }
        return supabase.from("exam_task_parameters").insert(insertData)
      }
    })

    const results = await Promise.all(upsertPromises)
    let paramErrorOccurred = false
    results.forEach((result, index) => {
      if (result.error) {
        console.error(
          `[TaskForm] Error saving parameter (index ${index}, name ${submittedParametersFromForm[index].name}):`,
          result.error.message,
        )
        toast({
          title: `Error saving parameter: ${submittedParametersFromForm[index].name}`,
          description: result.error.message,
          variant: "destructive",
        })
        paramErrorOccurred = true
      }
    })

    if (!paramErrorOccurred) {
      toast({
        title: task && task.id ? "Exam Task Updated" : "Exam Task Created",
        description: "Successfully saved task and parameters.",
      })
    } else {
      toast({
        title: "Partial Success",
        description: "Task saved, but some parameters had issues.",
        variant: "default",
      })
    }

    router.push(`/tasks/${examTaskId}`)
    router.refresh()
    setIsSubmitting(false)
  }

  const handleDelete = async () => {
    if (!task || !task.id || !userId) {
      toast({
        title: "Error",
        description: "Task data is missing or user ID is not available.",
        variant: "destructive",
      })
      return
    }
    setIsDeleting(true)
    const { error } = await supabase.from("exam_tasks").delete().eq("id", task.id).eq("user_id", userId)

    setIsDeleting(false)
    if (error) {
      console.error(`[TaskForm] Error deleting exam task ${task.id}:`, error.message)
      toast({
        title: "Error deleting exam task",
        description: error.message || "Could not delete or not authorized.",
        variant: "destructive",
      })
    } else {
      toast({ title: "Exam Task Deleted", description: "The exam task has been successfully deleted." })
      router.push("/tasks")
      router.refresh()
    }
  }

  const handleParameterNameChange = (index: number, newName: string) => {
    const currentParam = fields[index]
    const sanitizedName = newName.toUpperCase().replace(/[{}]/g, "")
    if (sanitizedName !== currentParam.name) {
      update(index, { ...currentParam, name: sanitizedName })
      form.trigger(`parameters.${index}.name`)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{task && task.id ? "Edit Exam Task" : "Create New Exam Task"}</CardTitle>
            <CardDescription>
              {task && task.id
                ? "Update the details of your exam task."
                : "Fill in the details to create a new exam task."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Classify sentiment of tweets" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Provide a detailed description of the exam task." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="skill_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoadingLookups}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a skill" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {skills.map((skill) => (
                          <SelectItem key={skill.id} value={skill.id}>
                            {skill.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoadingLookups}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {levels.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="exercise_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exercise Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoadingLookups}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an exercise type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {exerciseTypes.map((et) => (
                          <SelectItem key={et.id} value={et.id}>
                            {et.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2 pt-4">
              <div className="flex justify-between items-center">
                <FormLabel className="text-lg font-semibold">Instructions Configuration</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEnhanceInstructions}
                  disabled={isEnhancing || isLoadingLookups}
                >
                  {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  Enhance with AI
                </Button>
              </div>
              <FormField
                control={form.control}
                name="design_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-normal text-muted-foreground">Design Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe how the task should be designed. Use {PARAMETER_NAME} for dynamic values."
                        {...field}
                        rows={5}
                      />
                    </FormControl>
                    <FormDescription>Parameters like {"{TOPIC}"} will be automatically detected.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-normal text-muted-foreground">Difficulty Instructions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Explain how task difficulty is determined." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty_calibration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-normal text-muted-foreground">Difficulty Calibration</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Provide examples for calibrating difficulty." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {fields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Task Parameters</CardTitle>
              <CardDescription>
                Define details for detected parameters. Parameter names will be uppercased and braces removed. Click the
                wand icon to use AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.fieldId} className="p-4 border rounded-md space-y-4 relative">
                  <div className="flex justify-between items-center">
                    <FormField
                      control={form.control}
                      name={`parameters.${index}.name`}
                      render={({ field: nameField }) => (
                        <FormItem className="flex-grow mr-2">
                          <FormLabel className="sr-only">Parameter Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="PARAMETER_NAME"
                              value={nameField.value}
                              onChange={(e) => nameField.onChange(e.target.value)}
                              onBlur={(e) => handleParameterNameChange(index, e.target.value)}
                              className="font-semibold text-lg border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleGenerateParameterHelp(index)}
                              disabled={isGeneratingHelp[index] || !fields[index]?.name}
                            >
                              {isGeneratingHelp[index] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Wand2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate Details with AI</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name={`parameters.${index}.description`}
                    render={({ field: descField }) => (
                      <FormItem>
                        <FormLabel>Description / Help Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={`Provide helpful guidance for the ${fields[index]?.name || "parameter"}.`}
                            {...descField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`parameters.${index}.placeholder`}
                    render={({ field: placeholderField }) => (
                      <FormItem>
                        <FormLabel>Placeholder</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`e.g., for ${fields[index]?.name || "parameter"}`}
                            {...placeholderField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`parameters.${index}.default_value`}
                    render={({ field: defaultValueField }) => (
                      <FormItem>
                        <FormLabel>Default Value</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`Optional default for ${fields[index]?.name || "parameter"}`}
                            {...defaultValueField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            console.log("[TaskForm] Manually adding a new parameter.")
            append({ name: "NEW_PARAM", description: "", placeholder: "", default_value: "" })
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Parameter Manually
        </Button>

        <div className="flex justify-end space-x-2">
          {task && task.id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete Task
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the exam task and all its associated
                    parameters (due to database cascade).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button type="submit" disabled={isSubmitting || isLoadingLookups}>
            {isSubmitting || isLoadingLookups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {task && task.id ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

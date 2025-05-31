
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit3, AlertTriangle, ListChecks, Briefcase, GraduationCap, Puzzle } from "lucide-react";
import type { ExamTask, Skill, Level, ExerciseType } from "@/types/database.types";
import { formatDistanceToNow } from 'date-fns';
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

const getFormattedDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return 'N/A';
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`[TasksPage] Invalid date string encountered: ${dateString}`);
      return 'Invalid date';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error(`[TasksPage] Error formatting date string "${dateString}":`, error);
    return 'Date unavailable';
  }
};

interface LookupTables {
  skills: Skill[];
  levels: Level[];
  exerciseTypes: ExerciseType[];
}

async function fetchLookupData(supabase: ReturnType<typeof createSupabaseServerClient>): Promise<LookupTables> {
  const [skillsRes, levelsRes, exerciseTypesRes] = await Promise.all([
    supabase.from('skill').select('id, name'),
    supabase.from('level').select('id, name'),
    supabase.from('exercise_type').select('id, name')
  ]);

  if (skillsRes.error) console.error("[TasksPage] Error fetching skills:", skillsRes.error.message);
  if (levelsRes.error) console.error("[TasksPage] Error fetching levels:", levelsRes.error.message);
  if (exerciseTypesRes.error) console.error("[TasksPage] Error fetching exercise types:", exerciseTypesRes.error.message);

  return {
    skills: skillsRes.data || [],
    levels: levelsRes.data || [],
    exerciseTypes: exerciseTypesRes.data || [],
  };
}

export default async function TasksPage() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    console.error("[TasksPage] Authentication error:", authError?.message || "User data is null.");
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Authentication Failed</h1>
        <p className="mt-2 text-muted-foreground">Could not retrieve user session: {authError?.message || "Unknown error"}. Please try logging in again.</p>
        <Button asChild className="mt-4">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  const user = authData.user;

  if (!user.id) {
    console.error("[TasksPage] User ID is missing from session. User object:", user);
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Authentication Error</h1>
        <p className="mt-2 text-muted-foreground">User ID is missing from your session. Please try logging in again.</p>
        <Button asChild className="mt-4">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  let examTasks: ExamTask[] | null = null;
  let fetchError: any = null;
  let lookupData: LookupTables = { skills: [], levels: [], exerciseTypes: [] };

  try {
    const [tasksResponse, lookups] = await Promise.all([
      supabase
        .from("exam_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      fetchLookupData(supabase)
    ]);

    if (tasksResponse.error) {
      fetchError = tasksResponse.error;
    } else {
      examTasks = tasksResponse.data;
    }
    lookupData = lookups;

  } catch (err) {
    console.error("[TasksPage] Unexpected error during data fetching:", err);
    fetchError = err; // Capture any unexpected error
  }
  
  const { skills, levels, exerciseTypes } = lookupData;

  const getNameById = <T extends { id: string; name: string }>(items: T[], id: string | null): string | null => {
    if (!id) return null;
    return items.find(item => item.id === id)?.name || null;
  };


  if (fetchError) {
    console.error("[TasksPage] Error fetching exam tasks for user", user.id, ":", fetchError.message);
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Error Fetching Exam Tasks</h1>
        <p className="mt-2 text-muted-foreground">Could not load your tasks: {fetchError.message}</p>
         <Button asChild className="mt-4">
          <Link href="/tasks">Try Again</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">My Exam Tasks</h1>
        <Button asChild>
          <Link href="/tasks/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Exam Task
          </Link>
        </Button>
      </div>
      <div className="p-2 mb-4 text-xs text-muted-foreground bg-muted rounded-md">
        <p>Displaying tasks for User ID: <span className="font-mono">{user.id}</span></p>
        <p>Number of tasks found: {examTasks?.length ?? 0}</p>
      </div>

      {examTasks && examTasks.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {examTasks.map((examTask: ExamTask) => {
            const skillName = getNameById(skills, examTask.skill_id);
            const levelName = getNameById(levels, examTask.level_id);
            const exerciseTypeName = getNameById(exerciseTypes, examTask.exercise_type_id);

            return (
              <Card key={examTask.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="truncate text-xl">{examTask.name || "Untitled Task"}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Last updated: {getFormattedDate(examTask.updated_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {examTask.description || "No description provided."}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {skillName && (
                      <span className="flex items-center rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                        <Briefcase className="mr-1 h-3 w-3" /> {skillName}
                      </span>
                    )}
                    {levelName && (
                       <span className="flex items-center rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                        <GraduationCap className="mr-1 h-3 w-3" /> {levelName}
                      </span>
                    )}
                    {exerciseTypeName && (
                      <span className="flex items-center rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                        <Puzzle className="mr-1 h-3 w-3" /> {exerciseTypeName}
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/tasks/${examTask.id}`}>
                      <Edit3 className="mr-2 h-4 w-4" /> View / Edit
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <ListChecks className="mx-auto h-16 w-16 text-muted-foreground" />
          <h2 className="mt-6 text-xl font-semibold">No Exam Tasks Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No exam tasks were found for User ID: <span className="font-mono">{user.id}</span>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you have existing tasks, please ensure their 'user_id' column in the database matches this ID exactly.
          </p>
          <Button asChild className="mt-6">
            <Link href="/tasks/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Exam Task
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

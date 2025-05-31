
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TaskForm } from "@/components/tasks/TaskForm";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await (await supabase).auth.getUser();

  if (authError || !authData?.user) {
    console.error("[NewTaskPage] Authentication error:", authError?.message || "User data is null.");
    // Although middleware should redirect, this is a safeguard.
    // For server components, redirecting is often better than showing an error page if auth simply fails.
    // However, if it's an unexpected error, an error page might be suitable.
    // Given this is /new, redirecting to login is usually the best UX.
    return redirect(`/login?message=${encodeURIComponent(authError?.message || "Authentication required.")}`);
  }

  const user = authData.user;

  if (!user.id) {
     console.error("[NewTaskPage] User ID missing from session. User object:", user);
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

  return (
    <div>
      <TaskForm userId={user.id} />
    </div>
  );
}

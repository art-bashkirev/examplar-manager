import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm"; // adjust import as needed

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center mb-4">
          <Zap className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome Back to Task Forge</CardTitle>
        <CardDescription>Sign in to manage your tasks.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
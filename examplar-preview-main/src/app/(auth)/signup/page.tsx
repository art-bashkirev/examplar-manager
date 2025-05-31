import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import SignupForm from "@/components/auth/SignupForm"; // adjust import as needed

export default function SignupPage() {
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center mb-4">
          <Zap className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Create your Task Forge Account</CardTitle>
        <CardDescription>Get started by creating a new account.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
import { Header } from "@/components/shared/Header";

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-8">
        {children}
      </main>
    </div>
  );
}

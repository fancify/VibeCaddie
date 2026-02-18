import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in — Vibe Caddie",
};

/** 登录页面 */
export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-1 mb-6">
          <h1 className="text-[1.5rem] font-semibold text-text">
            Vibe Caddie
          </h1>
          <p className="text-[0.875rem] text-secondary">
            Your calm golf companion
          </p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}

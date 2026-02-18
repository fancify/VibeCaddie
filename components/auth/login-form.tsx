"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 登录表单组件 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    setLoading(true);
    signIn("cognito", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="your@email.com"
      />
      <Button
        variant="primary"
        onClick={handleSignIn}
        disabled={loading}
        className="w-full"
      >
        {loading ? "Redirecting..." : "Sign in"}
      </Button>
    </div>
  );
}

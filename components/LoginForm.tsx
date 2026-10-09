"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "@/components/icons";
import { Button, Field, Note, TextInput } from "@/components/ui";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      username,
      password,
      rememberMe: rememberMe ? "true" : "false",
      redirect: false,
    });
    setLoading(false);

    if (!result || result.error) {
      setError("Username atau password salah.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Username" required>
        <TextInput value={username} onChange={setUsername} placeholder="teknisi1" />
      </Field>
      <Field label="Password" required>
        <TextInput type="password" value={password} onChange={setPassword} placeholder="••••••••" />
      </Field>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--color-brand)]"
        />
        Ingat saya
      </label>

      {error && <Note tone="bad">{error}</Note>}

      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        <LogIn className="h-4 w-4" />
        {loading ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}

"use client";
import React, { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { ApiError } from "@/app/lib/api";
import { AuthShell, Field, SubmitButton } from "@/app/components/AuthShell";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Admins go to the dashboard; anyone else is signed straight back out
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === "admin") {
      router.replace("/");
    } else {
      logout().then(() => setFormError("This account does not have admin access."));
    }
  }, [user, authLoading, router, logout]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      await login(email, password, remember);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (!Object.keys(err.errors).length) setFormError(err.message);
      } else {
        setFormError("Could not reach the server. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Admin login"
      subtitle="Sign in to manage VGT properties, enquiries and users."
      footer={<>Authorised staff only.</>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {formError && (
          <div className="bg-red-500/10 border border-red-400/40 text-red-300 text-[13px] rounded-[14px] px-4 py-3">
            {formError}
          </div>
        )}
        <Field label="Email address" type="email" value={email} onChange={setEmail} error={errors.email?.[0]} placeholder="admin@vgt.com" autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password?.[0]} placeholder="Enter your password" autoComplete="current-password" />
        <label className="flex items-center gap-2.5 text-[13px] text-neutral-300 cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-white" />
          Keep me logged in for 30 days
        </label>
        <SubmitButton loading={submitting}>{submitting ? "Logging in..." : "Log in"}</SubmitButton>
      </form>
    </AuthShell>
  );
}
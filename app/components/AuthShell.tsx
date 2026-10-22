"use client";
import React, { useState } from "react";
import Link from "next/link";

/* Full-screen hero-video backdrop + glass card, same look as the home page search bar */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen w-full bg-black text-white font-sans selection:bg-white selection:text-black flex items-center justify-center px-4 py-12 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-70"
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/40" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-neutral-300 hover:text-white transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

        <div className="bg-black/80 backdrop-blur-2xl rounded-[32px] p-7 sm:p-10 shadow-2xl border border-white/20">
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-[14px] text-neutral-300 mt-2 leading-relaxed">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>

        <p className="mt-6 text-center text-[13.5px] text-neutral-300">{footer}</p>
      </div>
    </main>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  required = true,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label className="block text-[13px] font-medium text-neutral-200 mb-2">{label}</label>
      <div
        className={`relative flex items-center bg-white/10 border rounded-[16px] px-4 transition focus-within:border-white ${
          error ? "border-red-400" : "border-white/20 hover:border-white/60"
        }`}
      >
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          className="bg-transparent text-[14px] font-medium w-full py-4 focus:outline-none text-white placeholder-neutral-500"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="text-[12px] font-semibold text-neutral-300 hover:text-white ml-3 cursor-pointer"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <p className="text-[12.5px] text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-[58px] bg-white text-black hover:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed rounded-[16px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-xl cursor-pointer"
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
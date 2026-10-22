"use client";
import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { navItems } from "@/app/components/Sidebar";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const title =
    navItems.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))?.label ?? "Dashboard";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = user?.name?.charAt(0).toUpperCase() ?? "A";

  return (
    <header className="sticky top-0 z-30 h-[76px] bg-white/80 backdrop-blur-xl border-b border-neutral-200 px-4 sm:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenu}
          className="lg:hidden w-11 h-11 rounded-full border border-black flex items-center justify-center hover:bg-black hover:text-white transition cursor-pointer"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-[14px] px-4 py-2.5 w-[280px] focus-within:border-black transition">
          <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-[13.5px] w-full focus:outline-none placeholder-neutral-500"
          />
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center font-bold text-[15px]">
              {initial}
            </span>
            <span className="hidden sm:block text-left leading-tight">
              <span className="block text-[13.5px] font-bold">{user?.name}</span>
              <span className="block text-[12px] text-neutral-500 capitalize">{user?.role}</span>
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-3 w-[230px] bg-black text-white rounded-[20px] border border-white/15 shadow-2xl py-2 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10">
                <p className="text-[13.5px] font-bold truncate">{user?.name}</p>
                <p className="text-[12px] text-neutral-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
                className="w-full text-left px-5 py-3 text-[13.5px] font-medium hover:bg-white/10 transition cursor-pointer"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const navItems = [
 { label: "Dashboard", href: "/", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { label: "Add Properties", href: "/properties", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { label: "Add Developers", href: "/developers", icon: "M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M2 21h20" },
  { label: "Add Communities", href: "/communities", icon: "M12 21s-7-5.686-7-11a7 7 0 1114 0c0 5.314-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" },
  { label: "Add Blogs", href: "/blogs", icon: "M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
  // { label: "Enquiries", href: "/enquiries", icon: "M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
  // { label: "Users", href: "/users", icon: "M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75" },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[272px] bg-black text-white flex flex-col border-r border-neutral-800 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-[76px] flex items-center justify-between px-7 border-b border-white/10">
          <Link href="/" className="text-[22px] font-bold tracking-tight">
            VGT <span className="text-neutral-400 font-medium">Admin</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-neutral-400 hover:text-white cursor-pointer" aria-label="Close menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1.5">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] text-[14px] font-medium transition ${
                  active
                    ? "bg-white text-black shadow-lg"
                    : "text-neutral-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-4 py-3.5 rounded-[14px] bg-white/10 hover:bg-white/20 text-[13.5px] font-medium transition"
          >
            View website
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </aside>
    </>
  );
}

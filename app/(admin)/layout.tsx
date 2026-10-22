"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import Topbar from "@/app/components/Topbar";

/* Every page inside the (admin) folder gets the sidebar + topbar and requires an admin login */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowed = !loading && !!user && user.role === "admin";

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.replace("/login");
  }, [user, loading, router]);

  return (
    <>
      {/* Covers the page while the login is being checked. The page itself is always
          rendered underneath, so Next.js can validate it. */}
      {!allowed && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center text-neutral-400 text-sm">
          Loading...
        </div>
      )}

      <div className="min-h-screen bg-neutral-100 text-black font-sans">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:pl-[272px]">
          <Topbar onMenu={() => setSidebarOpen(true)} />
          <main className="p-4 sm:p-8">{children}</main>
        </div>
      </div>
    </>
  );
}
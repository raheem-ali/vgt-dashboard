"use client";
import React from "react";
import { useAuth } from "@/app/context/AuthContext";

const stats = [
  { label: "Properties", value: "—" },
  { label: "New enquiries", value: "—" },
  { label: "Registered users", value: "—" },
  { label: "Listings for rent", value: "—" },
];

export default function OverviewPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
      <div className="bg-black text-white rounded-[32px] p-8 sm:p-10 shadow-2xl border border-neutral-800">
        <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight">Welcome back, {user?.name}</h2>
        <p className="text-[15px] text-neutral-300 mt-2 max-w-[520px] leading-relaxed">
          Manage listings, answer enquiries and keep an eye on your users from here.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-neutral-200 rounded-[24px] p-6 shadow-sm">
            <p className="text-[13px] text-neutral-500 font-medium">{s.label}</p>
            <p className="text-[34px] font-bold tracking-tight mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      <p className="text-[13px] text-neutral-500">
        Figures will appear here once the properties and enquiries APIs are connected.
      </p>
    </div>
  );
}
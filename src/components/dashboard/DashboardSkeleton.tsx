import React from 'react';
import { Loader2 } from 'lucide-react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-pulse">
      {/* 1. Header Skeleton */}
      <div className="bg-[#141414] border border-neutral-800/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800/60" />
              <div className="h-7 w-48 sm:w-64 bg-neutral-800/70 rounded-lg" />
            </div>
            <div className="h-3.5 w-60 sm:w-96 bg-neutral-800/40 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-28 bg-neutral-800/50 rounded-xl" />
            <div className="h-9 w-32 bg-[#C8A45C]/15 border border-[#C8A45C]/20 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. Metric KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-neutral-800/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-neutral-800/60 rounded" />
              <div className="w-5 h-5 rounded-full bg-neutral-800/40" />
            </div>
            <div className="h-8 w-24 bg-neutral-800/80 rounded-lg" />
            <div className="h-2.5 w-16 bg-neutral-800/30 rounded" />
          </div>
        ))}
      </div>

      {/* 3. Main Data Panel Skeleton */}
      <div className="bg-[#141414] border border-neutral-800/80 rounded-2xl p-6 space-y-5 shadow-xl">
        {/* Subheader / Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
          <div className="space-y-1.5">
            <div className="h-5 w-44 bg-neutral-800/70 rounded-lg" />
            <div className="h-3 w-64 bg-neutral-800/30 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-36 bg-neutral-800/50 rounded-xl" />
            <div className="h-8 w-48 bg-neutral-800/40 rounded-xl" />
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="space-y-3 pt-2">
          <div className="h-9 bg-[#181818] rounded-xl border border-neutral-800/50" />
          {[...Array(5)].map((_, idx) => (
            <div
              key={idx}
              className="h-12 bg-neutral-900/40 rounded-xl border border-neutral-800/30 flex items-center px-4 justify-between"
            >
              <div className="h-4 w-24 bg-neutral-800/50 rounded" />
              <div className="h-4 w-36 bg-neutral-800/40 rounded hidden sm:block" />
              <div className="h-4 w-20 bg-neutral-800/50 rounded hidden md:block" />
              <div className="h-4 w-16 bg-[#C8A45C]/20 rounded" />
            </div>
          ))}
        </div>

        {/* Loading Indicator Footer */}
        <div className="flex items-center justify-center gap-2 pt-4 text-xs text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#C8A45C]" />
          <span>Sincronizando datos con Supabase en tiempo real...</span>
        </div>
      </div>
    </div>
  );
};

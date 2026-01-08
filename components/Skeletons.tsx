import React from 'react';

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style}></div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Stats Cards Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="w-full">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
          <div className="mt-4 flex items-center">
             <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>

    {/* Charts Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="flex justify-center items-center h-64">
             <div className="w-48 h-48 rounded-full border-8 border-gray-100 animate-pulse"></div>
          </div>
       </div>
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="flex items-end justify-between h-64 gap-2 px-4">
             {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="w-full rounded-t" style={{ height: `${Math.random() * 60 + 20}%` }} />
             ))}
          </div>
       </div>
    </div>
  </div>
);

export const AgentTableSkeleton = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
           <Skeleton className="h-6 w-64" />
           <Skeleton className="h-4 w-24" />
        </div>
        <div className="divide-y divide-gray-100">
            <div className="p-4 grid grid-cols-5 gap-4 bg-gray-50">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
            </div>
            {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 grid grid-cols-5 gap-4">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-12" />
                </div>
            ))}
        </div>
    </div>
);
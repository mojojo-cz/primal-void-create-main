import React from 'react';
import { Skeleton } from './skeleton';
import { TableRow, TableCell } from './table';

interface ScheduleSkeletonProps {
  rows?: number;
}

export function ScheduleSkeleton({ rows = 3 }: ScheduleSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index} className="border-l-4 border-l-blue-100">
          <TableCell>
            <div className="space-y-2 ml-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function PlanScheduleSkeleton() {
  return (
    <div className="space-y-1 pl-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-xs text-muted-foreground">
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
} 
import { Card, Skeleton } from "@/components/ui";

// Instant placeholder for the stock/home page while products load from the DB.
export default function HomeLoading() {
  return (
    <div className="space-y-4">
      {/* Search + category filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>

      {/* Product rows */}
      <Card className="p-0">
        <div className="divide-y divide-edge/60">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { Card, Skeleton } from "@/components/ui";

// Shown instantly on any dashboard navigation while the server render streams
// in. The DashboardTabs live in the layout, so they stay put — only this
// content area flashes a skeleton, which makes tab switches feel immediate.
export default function DashboardLoading() {
  return (
    <div>
      {/* PageHeader placeholder */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table placeholder */}
      <Card className="p-0">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

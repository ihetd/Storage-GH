import { Card, Skeleton } from "@/components/ui";

// This page waits on Shopify's API, not just the database, so it is the
// slowest in the dashboard — the skeleton matters more here than elsewhere.
export default function ShopifyLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-full sm:w-80" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

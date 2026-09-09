import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  CancelScheduledButton,
  ReceiveButton,
  ScheduledCreateForm,
  type VariantOption,
} from "./scheduled-forms";

export const metadata = { title: "Scheduled · Dashboard" };

function dueLabel(expectedAt: Date | null): { text: string; overdue: boolean } {
  if (!expectedAt) return { text: "no date", overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    text: expectedAt.toLocaleDateString(),
    overdue: expectedAt < today,
  };
}

export default async function ScheduledPage() {
  await requireRole(["ADMIN"]);

  const [pending, received, variants] = await Promise.all([
    prisma.scheduledItem.findMany({
      where: { receivedAt: null },
      // Undated items last: a delivery with a date is one you can plan around.
      orderBy: [{ expectedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      select: {
        id: true,
        quantity: true,
        expectedAt: true,
        note: true,
        productVariant: {
          select: { label: true, quantity: true, product: { select: { name: true } } },
        },
      },
    }),
    prisma.scheduledItem.findMany({
      where: { receivedAt: { not: null } },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: {
        id: true,
        quantity: true,
        receivedAt: true,
        productVariant: {
          select: { label: true, product: { select: { name: true } } },
        },
      },
    }),
    prisma.productVariant.findMany({
      orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
      select: { id: true, label: true, product: { select: { name: true } } },
    }),
  ]);

  const options: VariantOption[] = variants.map((v) => ({
    id: v.id,
    product: v.product.name,
    label: v.label,
  }));

  const incoming = pending.reduce((n, p) => n + p.quantity, 0);

  return (
    <div>
      <PageHeader
        title="Scheduled"
        description="Stock ordered but not arrived. It is not counted anywhere until you mark it received."
      />

      <Card className="mb-6">
        <ScheduledCreateForm options={options} />
      </Card>

      {pending.length === 0 ? (
        <EmptyState>
          Nothing on order. Add a delivery above and it will wait here until it arrives.
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="font-display text-sm font-semibold tracking-wide text-gold">
              On the way
            </h2>
            <span className="text-xs text-cream/45">
              {incoming} {incoming === 1 ? "piece" : "pieces"} across {pending.length}{" "}
              {pending.length === 1 ? "delivery" : "deliveries"}
            </span>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-cream/45">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Coming</th>
                <th className="px-4 py-2 font-medium">In stock now</th>
                <th className="px-4 py-2 font-medium">Expected</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pending.map((item) => {
                const due = dueLabel(item.expectedAt);
                return (
                  <tr key={item.id} className="border-t border-edge/60">
                    <td className="px-4 py-2 text-cream/85">
                      {item.productVariant.product.name}
                      <span className="text-cream/50"> · {item.productVariant.label}</span>
                    </td>
                    <td className="px-4 py-2 text-cream/85">+{item.quantity}</td>
                    <td className="px-4 py-2 text-cream/50">{item.productVariant.quantity}</td>
                    <td
                      className={
                        due.overdue ? "px-4 py-2 text-amber-300" : "px-4 py-2 text-cream/60"
                      }
                    >
                      {due.text}
                      {due.overdue && " · late"}
                    </td>
                    <td className="px-4 py-2 text-cream/50">{item.note ?? ""}</td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        <ReceiveButton id={item.id} quantity={item.quantity} />
                        <CancelScheduledButton id={item.id} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {received.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-sm font-semibold tracking-wide text-gold">
            Recently received
          </h2>
          <ul className="mt-3 divide-y divide-edge/60 text-sm">
            {received.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-cream/75">
                  {item.productVariant.product.name}
                  <span className="text-cream/45"> · {item.productVariant.label}</span>
                  <span className="text-emerald-400"> +{item.quantity}</span>
                </span>
                <span className="text-xs text-cream/40">
                  {item.receivedAt?.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

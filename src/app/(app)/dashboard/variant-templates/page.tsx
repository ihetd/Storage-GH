import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { TemplateCreateForm, TemplateRow } from "./template-forms";

export const metadata = { title: "Variant templates · Dashboard" };

export default async function VariantTemplatesPage() {
  const templates = await prisma.variantTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Variant templates"
        description="Reusable option sets (e.g. sizes, colors) you can apply when creating a product."
      />

      <Card className="mb-6">
        <TemplateCreateForm />
      </Card>

      {templates.length === 0 ? (
        <EmptyState>No templates yet. Create one above.</EmptyState>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={{
                id: t.id,
                name: t.name,
                attributeLabel: t.attributeLabel,
                options: t.options,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

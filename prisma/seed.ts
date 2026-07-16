import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD || "password123";

async function upsertUser(
  username: string,
  name: string,
  role: Role,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { username },
    update: { name, role, active: true },
    create: { username, name, role, passwordHash, active: true },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // --- Accounts (one per role) ---
  await upsertUser("admin", "Alex Admin", "ADMIN", passwordHash);
  await upsertUser("editor", "Erin Editor", "EDITOR", passwordHash);
  await upsertUser("viewer", "Val Viewer", "VIEWER", passwordHash);

  // --- Categories ---
  const categories = [
    { name: "T-Shirts", sortOrder: 1 },
    { name: "Hoodies", sortOrder: 2 },
    { name: "Accessories", sortOrder: 3 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: { sortOrder: c.sortOrder },
      create: c,
    });
  }
  const tshirts = await prisma.category.findUniqueOrThrow({
    where: { name: "T-Shirts" },
  });
  const hoodies = await prisma.category.findUniqueOrThrow({
    where: { name: "Hoodies" },
  });
  const accessories = await prisma.category.findUniqueOrThrow({
    where: { name: "Accessories" },
  });

  // --- Variant template ---
  const sizes = await prisma.variantTemplate.upsert({
    where: { name: "Clothing Sizes" },
    update: { attributeLabel: "Size", options: ["S", "M", "L", "XL"] },
    create: {
      name: "Clothing Sizes",
      attributeLabel: "Size",
      options: ["S", "M", "L", "XL"],
    },
  });

  // --- Demo products (idempotent by name+category) ---
  async function upsertProduct(opts: {
    name: string;
    categoryId: string;
    attributeLabel: string;
    variantTemplateId?: string;
    variants: { label: string; quantity: number }[];
  }) {
    const existing = await prisma.product.findFirst({
      where: { name: opts.name, categoryId: opts.categoryId },
    });
    if (existing) return existing;
    return prisma.product.create({
      data: {
        name: opts.name,
        categoryId: opts.categoryId,
        attributeLabel: opts.attributeLabel,
        variantTemplateId: opts.variantTemplateId,
        variants: {
          create: opts.variants.map((v, i) => ({
            label: v.label,
            quantity: v.quantity,
            sortOrder: i,
          })),
        },
      },
    });
  }

  await upsertProduct({
    name: "Classic Logo Tee",
    categoryId: tshirts.id,
    attributeLabel: "Size",
    variantTemplateId: sizes.id,
    variants: [
      { label: "S", quantity: 12 },
      { label: "M", quantity: 8 },
      { label: "L", quantity: 5 },
      { label: "XL", quantity: 3 },
    ],
  });

  await upsertProduct({
    name: "Zip Hoodie",
    categoryId: hoodies.id,
    attributeLabel: "Size",
    variantTemplateId: sizes.id,
    variants: [
      { label: "S", quantity: 4 },
      { label: "M", quantity: 6 },
      { label: "L", quantity: 2 },
      { label: "XL", quantity: 0 },
    ],
  });

  await upsertProduct({
    name: "Canvas Tote Bag",
    categoryId: accessories.id,
    attributeLabel: "Color",
    variants: [
      { label: "Natural", quantity: 20 },
      { label: "Black", quantity: 14 },
    ],
  });

  console.log("Seed complete:");
  console.log("  admin / editor / viewer  (password:", SEED_PASSWORD + ")");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

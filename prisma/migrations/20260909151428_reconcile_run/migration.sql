-- CreateTable
CREATE TABLE "ReconcileRun" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked" INTEGER NOT NULL,
    "drifted" INTEGER NOT NULL,
    "missing" INTEGER NOT NULL,
    "details" JSONB,
    "error" TEXT,

    CONSTRAINT "ReconcileRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconcileRun_ranAt_idx" ON "ReconcileRun"("ranAt");


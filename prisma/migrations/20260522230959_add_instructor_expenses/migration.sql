-- AddTable: InstructorExpense
-- Safe additive migration — creates a new table, touches nothing existing

CREATE TABLE "InstructorExpense" (
    "id"           TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "date"         TIMESTAMP(3) NOT NULL,
    "category"     TEXT NOT NULL,
    "description"  TEXT NOT NULL,
    "amount"       DOUBLE PRECISION NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstructorExpense"
    ADD CONSTRAINT "InstructorExpense_instructorId_fkey"
    FOREIGN KEY ("instructorId")
    REFERENCES "Instructor"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

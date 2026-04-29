-- Cascade-delete child UnderwritingRun rows when their parent is deleted.
-- Replaces the previous ON DELETE SET NULL behavior so that deleting a run
-- removes its full re-run thread.

-- DropForeignKey
ALTER TABLE "UnderwritingRun" DROP CONSTRAINT "UnderwritingRun_parentRunId_fkey";

-- AddForeignKey
ALTER TABLE "UnderwritingRun" ADD CONSTRAINT "UnderwritingRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "UnderwritingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

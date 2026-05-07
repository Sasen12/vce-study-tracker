import { prisma } from "./prismaClient.js";
import { inferSchoolNameFromEmail } from "../utils/schoolEmail.js";

export const ensureDatabaseSchema = async () => {
  await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_name TEXT`;

  const usersMissingSchool = await prisma.user.findMany({
    where: {
      OR: [{ schoolName: null }, { schoolName: "" }]
    },
    select: {
      id: true,
      email: true
    }
  });

  const updates = usersMissingSchool
    .map((user) => ({
      id: user.id,
      schoolName: inferSchoolNameFromEmail(user.email)
    }))
    .filter((user): user is { id: string; schoolName: string } => Boolean(user.schoolName));

  if (updates.length) {
    await prisma.$transaction(
      updates.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: { schoolName: user.schoolName }
        })
      )
    );
    console.log(`Backfilled school names for ${updates.length} users.`);
  }
};

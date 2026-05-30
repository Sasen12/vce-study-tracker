import "dotenv/config";
import { sendWeeklyDigestToAllUsers } from "../services/weeklyDigestService.js";
import { prisma } from "../db/prismaClient.js";
const readArg = (name) => {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);
const targetEmail = readArg("email")?.trim().toLowerCase();
const force = hasFlag("force") || Boolean(targetEmail);
const includeAdmins = hasFlag("include-admins") || Boolean(targetEmail);
try {
    const result = await sendWeeklyDigestToAllUsers({ targetEmail, force, includeAdmins });
    console.log(`Weekly digest complete: attempted ${result.attempted}, sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}${result.reason ? `, reason ${result.reason}` : ""}.`);
}
finally {
    await prisma.$disconnect();
}

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./prismaClient.js";
const demoEmail = "demo@vcestudy.app";
const starterSubjects = [
    { subjectName: "English", unit: "3/4", targetScore: null, color: "#7C6EFF" },
    { subjectName: "Software Development", unit: "3/4", targetScore: null, color: "#4ADE80" },
    { subjectName: "Data Analytics", unit: "3/4", targetScore: null, color: "#22D3EE" },
    { subjectName: "Business Management", unit: "3/4", targetScore: null, color: "#F59E0B" },
    { subjectName: "General Mathematics", unit: "3/4", targetScore: null, color: "#60A5FA" }
];
async function main() {
    const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (existing) {
        await prisma.user.delete({ where: { id: existing.id } });
    }
    await prisma.user.create({
        data: {
            email: demoEmail,
            passwordHash: await bcrypt.hash("password123", 12),
            displayName: "Sasen",
            schoolName: "Demo School",
            gamification: { create: {} },
            subjects: { create: starterSubjects }
        }
    });
    console.log("Seeded clean starter account:");
    console.log(`  Email: ${demoEmail}`);
    console.log("  Password: password123");
    console.log("  Subjects: English, Software Development, Data Analytics, Business Management, General Mathematics");
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});

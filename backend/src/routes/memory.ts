import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { rebuildStudentMemoryMaps } from "../services/studentMemoryService.js";
import { asyncHandler } from "../utils/http.js";

export const memoryRouter = Router();
memoryRouter.use(requireAuth);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

memoryRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const query = listQuerySchema.parse(req.query);
    const events = await prisma.studentMemoryEvent.findMany({
      where: { userId: authReq.user.id },
      include: {
        subject: true,
        signals: {
          orderBy: { createdAt: "desc" },
          take: 4
        }
      },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });

    res.json({ events });
  })
);

memoryRouter.get(
  "/signals",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const query = listQuerySchema.parse(req.query);
    const signals = await prisma.learningSignal.findMany({
      where: { userId: authReq.user.id },
      include: { subject: true },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });

    res.json({ signals });
  })
);

memoryRouter.get(
  "/student-map",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const subjectMemories = await prisma.studentSubjectMemory.findMany({
      where: {
        userId: authReq.user.id,
        OR: [{ subjectId: null }, { subject: { archivedAt: null } }]
      },
      include: { subject: true },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ subjectMemories });
  })
);

memoryRouter.post(
  "/student-map/rebuild",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const subjectMemories = await rebuildStudentMemoryMaps(authReq.user.id);
    res.json({ subjectMemories });
  })
);

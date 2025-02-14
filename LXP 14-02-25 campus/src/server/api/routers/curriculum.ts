import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { ActivityType, CurriculumResourceType } from "@prisma/client";
import { NodeType, ResourceFileInfo, NodeLearningContext, NodeResourceContext, NodeAssessmentContext } from "@/types/curriculum";

export const curriculumRouter = createTRPCRouter({
	// Node operations
	getNodes: protectedProcedure
		.input(z.object({
			subjectId: z.string()
		}))
		.query(async ({ ctx, input }) => {
			return ctx.prisma.curriculumNode.findMany({
				where: { subjectId: input.subjectId },
				include: {
					resources: true,
					activities: true
				},
				orderBy: { order: 'asc' }
			});
		}),

	getNode: protectedProcedure
		.input(z.object({
			nodeId: z.string()
		}))
		.query(async ({ ctx, input }) => {
			return ctx.prisma.curriculumNode.findUnique({
				where: { id: input.nodeId },
				include: {
					resources: true,
					activities: true
				}
			});
		}),

	createNode: protectedProcedure
		.input(z.object({
			title: z.string(),
			description: z.string().optional(),
			type: z.enum(["CHAPTER", "TOPIC", "SUBTOPIC"] as const),
			parentId: z.string().optional(),
			order: z.number(),
			subjectId: z.string()
		}))
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.curriculumNode.create({
				data: input,
				include: {
					resources: true,
					activities: true
				}
			});
		}),

	updateNode: protectedProcedure
		.input(z.object({
			id: z.string(),
			title: z.string().optional(),
			description: z.string().optional(),
			type: z.enum(["CHAPTER", "TOPIC", "SUBTOPIC"]).optional(),
			parentId: z.string().optional(),
			order: z.number().optional(),
			learningContext: z.object({
				objectives: z.array(z.string()).optional(),
				duration: z.string().optional(),
				prerequisites: z.array(z.string()).optional(),
				keyTerms: z.array(z.string()).optional(),
				outcomes: z.array(z.string()).optional(),
			}).optional(),
			resourceContext: z.object({
				materials: z.object({
					primary: z.array(z.string()).optional(),
					supplementary: z.array(z.string()).optional(),
				}).optional(),
				references: z.array(z.string()).optional(),
			}).optional(),
			assessmentContext: z.object({
				methods: z.array(z.string()).optional(),
				criteria: z.array(z.string()).optional(),
				weightage: z.number().optional(),
			}).optional(),
		}))
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.prisma.curriculumNode.update({
				where: { id },
				data,
				include: {
					resources: true,
					activities: true
				}
			});
		}),

	deleteNode: protectedProcedure
		.input(z.string())
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.curriculumNode.delete({
				where: { id: input }
			});
		}),

	// Resource operations
	createResource: protectedProcedure
		.input(z.object({
			title: z.string().min(1, "Title is required"),
			type: z.nativeEnum(CurriculumResourceType),
			content: z.string().min(1, "Content is required"),
			nodeId: z.string(),
			fileInfo: z.object({
				size: z.number(),
				mimeType: z.string(),
				createdAt: z.date(),
				updatedAt: z.date(),
				publicUrl: z.string()
			}).optional()
		}))
		.mutation(async ({ ctx, input }) => {
			try {
				const node = await ctx.prisma.curriculumNode.findUnique({
					where: { id: input.nodeId }
				});

				if (!node) {
					throw new Error("Node not found");
				}

				const resource = await ctx.prisma.curriculumResource.create({
					data: {
						title: input.title,
						type: input.type,
						content: input.content,
						nodeId: input.nodeId,
						fileInfo: input.fileInfo
					},
					include: {
						node: true
					}
				});

				return resource;
			} catch (error) {
				console.error("Error creating resource:", error);
				throw error;
			}
		}),


	updateResource: protectedProcedure
		.input(z.object({
			id: z.string(),
			title: z.string().optional(),
			type: z.nativeEnum(CurriculumResourceType).optional(),
			content: z.string().optional(),
			fileInfo: z.record(z.any()).optional()
		}))
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.prisma.curriculumResource.update({
				where: { id },
				data
			});
		}),

	deleteResource: protectedProcedure
		.input(z.string())
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.curriculumResource.delete({
				where: { id: input }
			});
		}),

	// Activity operations
	getActivities: protectedProcedure
		.input(z.object({
			nodeId: z.string()
		}))
		.query(async ({ ctx, input }) => {
			return ctx.prisma.curriculumActivity.findMany({
				where: { nodeId: input.nodeId },
				orderBy: { createdAt: 'desc' }
			});
		}),

	createActivity: protectedProcedure
		.input(z.object({
			title: z.string(),
			type: z.nativeEnum(ActivityType),
			content: z.record(z.any()),
			isGraded: z.boolean(),
			nodeId: z.string()
		}))
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.curriculumActivity.create({
				data: {
					title: input.title,
					type: input.type,
					content: input.content,
					isGraded: input.isGraded,
					nodeId: input.nodeId
				}
			});
		}),

	updateActivity: protectedProcedure
		.input(z.object({
			id: z.string(),
			title: z.string().optional(),
			type: z.nativeEnum(ActivityType).optional(),
			content: z.record(z.any()).optional(),
			isGraded: z.boolean().optional()
		}))
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.prisma.curriculumActivity.update({
				where: { id },
				data
			});
		}),

	deleteActivity: protectedProcedure
		.input(z.string())
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.curriculumActivity.delete({
				where: { id: input }
			});
		})
});
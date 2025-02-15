import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { roomSchema, roomIdSchema, updateRoomSchema } from "../validation/room";
import { TRPCError } from "@trpc/server";
import { RoomStatus, RoomType } from "@prisma/client";

export const roomRouter = createTRPCRouter({
	create: protectedProcedure
		.input(roomSchema)
		.mutation(async ({ ctx, input }) => {
			const room = await ctx.prisma.room.create({
				data: input,
			});
			return room;
		}),

	getAll: protectedProcedure
		.input(z.object({ 
			wingId: z.string().optional(),
			type: z.nativeEnum(RoomType).optional(),
			status: z.nativeEnum(RoomStatus).optional(),
		}))
		.query(async ({ ctx, input }) => {
			const where = {
				...(input.wingId && { wingId: input.wingId }),
				...(input.type && { type: input.type }),
				...(input.status && { status: input.status }),
			};
			
			return ctx.prisma.room.findMany({
				where,
				include: {
					wing: {
						include: {
							floor: {
								include: {
									building: true,
								},
							},
						},
					},
				},
				orderBy: {
					number: 'asc',
				},
			});
		}),

	getById: protectedProcedure
		.input(roomIdSchema)
		.query(async ({ ctx, input }) => {
			const room = await ctx.prisma.room.findUnique({
				where: { id: input.id },
				include: {
					wing: {
						include: {
							floor: {
								include: {
									building: true,
								},
							},
						},
					},
				},
			});

			if (!room) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Room not found",
				});
			}

			return room;
		}),

	update: protectedProcedure
		.input(z.object({
			id: z.string(),
			data: updateRoomSchema,
		}))
		.mutation(async ({ ctx, input }) => {
			const room = await ctx.prisma.room.update({
				where: { id: input.id },
				data: input.data,
			});
			return room;
		}),

	updateStatus: protectedProcedure
		.input(z.object({
			id: z.string(),
			status: z.nativeEnum(RoomStatus),
		}))
		.mutation(async ({ ctx, input }) => {
			const room = await ctx.prisma.room.update({
				where: { id: input.id },
				data: { status: input.status },
			});
			return room;
		}),

	delete: protectedProcedure
		.input(roomIdSchema)
		.mutation(async ({ ctx, input }) => {
			await ctx.prisma.room.delete({
				where: { id: input.id },
			});
			return { success: true };
		}),
});
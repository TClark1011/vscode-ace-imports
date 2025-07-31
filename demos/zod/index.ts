import * as z from "zod/mini";

const todoSchema = z.object({
	id: z.string(),
	title: z.string(),
	completed: z.boolean(),
});

const createTodoInputSchema = z.object({
	title: z.string(),
	completed: z.optional(z.boolean()),
});

import { z } from 'zod';

export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  completed: z.boolean().default(false),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
});

export const todoResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoResponse = z.infer<typeof todoResponseSchema>;

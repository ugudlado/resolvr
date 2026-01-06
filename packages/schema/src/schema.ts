import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

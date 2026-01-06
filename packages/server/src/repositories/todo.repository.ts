import { eq } from 'drizzle-orm';
import { todos, type Todo, type NewTodo } from '@todos/schema';
import type { Database } from '../config/database';

export class TodoRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Todo[]> {
    return this.db.select().from(todos);
  }

  async findById(id: string): Promise<Todo | undefined> {
    const result = await this.db.select().from(todos).where(eq(todos.id, id));
    return result[0];
  }

  async create(data: NewTodo): Promise<Todo> {
    const result = await this.db.insert(todos).values(data).returning();
    return result[0];
  }

  async update(
    id: string,
    data: Partial<Omit<Todo, 'id' | 'createdAt'>>,
  ): Promise<Todo | undefined> {
    const result = await this.db
      .update(todos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(todos.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(todos).where(eq(todos.id, id));
    return result.count > 0;
  }
}

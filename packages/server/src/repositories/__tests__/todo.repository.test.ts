import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { TodoRepository } from '../todo.repository';
import type { Database } from '../../config/database';
import type { Todo } from '@todos/schema';

describe('TodoRepository', () => {
  let repository: TodoRepository;
  let mockDb: ReturnType<typeof mock<Database>>;

  beforeEach(() => {
    mockDb = mock<Database>();
    repository = new TodoRepository(mockDb);
  });

  describe('findAll', () => {
    it('should return all todos', async () => {
      const mockTodos: Todo[] = [
        {
          id: '1',
          title: 'Test Todo',
          description: 'Test description',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValue({
        from: () => Promise.resolve(mockTodos),
      } as any);

      const result = await repository.findAll();
      expect(result).toEqual(mockTodos);
    });
  });

  describe('findById', () => {
    it('should return todo when found', async () => {
      const mockTodo: Todo = {
        id: '1',
        title: 'Test Todo',
        description: 'Test description',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([mockTodo]),
        }),
      } as any);

      const result = await repository.findById('1');
      expect(result).toEqual(mockTodo);
    });

    it('should return undefined when todo not found', async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      } as any);

      const result = await repository.findById('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create and return new todo', async () => {
      const newTodo = {
        title: 'New Todo',
        description: 'New description',
        completed: false,
      };

      const createdTodo: Todo = {
        id: '2',
        ...newTodo,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: () => ({
          returning: () => Promise.resolve([createdTodo]),
        }),
      } as any);

      const result = await repository.create(newTodo);
      expect(result).toEqual(createdTodo);
      expect(result.title).toBe(newTodo.title);
    });
  });
});

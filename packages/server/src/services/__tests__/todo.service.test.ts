import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { TodoService } from '../todo.service';
import { TodoRepository } from '../../repositories/todo.repository';
import type { Todo } from '@todos/schema';

describe('TodoService', () => {
  let service: TodoService;
  let mockRepository: ReturnType<typeof mock<TodoRepository>>;

  const mockTodo: Todo = {
    id: '1',
    title: 'Test Todo',
    description: 'Test description',
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepository = mock<TodoRepository>();
    service = new TodoService(mockRepository);
  });

  describe('getAllTodos', () => {
    it('should return all todos from repository', async () => {
      mockRepository.findAll.mockResolvedValue([mockTodo]);

      const result = await service.getAllTodos();
      expect(result).toEqual([mockTodo]);
      expect(mockRepository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe('getTodoById', () => {
    it('should return todo when found', async () => {
      mockRepository.findById.mockResolvedValue(mockTodo);

      const result = await service.getTodoById('1');
      expect(result).toEqual(mockTodo);
    });

    it('should throw error when todo not found', async () => {
      mockRepository.findById.mockResolvedValue(undefined);

      await expect(service.getTodoById('nonexistent')).rejects.toThrow(
        'Todo not found',
      );
    });
  });

  describe('createTodo', () => {
    it('should create todo', async () => {
      const newTodoData = {
        title: 'New Todo',
        description: 'New description',
        completed: false,
      };

      mockRepository.create.mockResolvedValue({
        ...mockTodo,
        ...newTodoData,
        id: '2',
      });

      const result = await service.createTodo(newTodoData);
      expect(result.title).toBe(newTodoData.title);
      expect(mockRepository.create).toHaveBeenCalledWith(newTodoData);
    });
  });

  describe('updateTodo', () => {
    it('should update todo when exists', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedTodo = { ...mockTodo, title: 'Updated Title' };

      mockRepository.findById.mockResolvedValue(mockTodo);
      mockRepository.update.mockResolvedValue(updatedTodo);

      const result = await service.updateTodo('1', updateData);
      expect(result.title).toBe('Updated Title');
    });

    it('should throw error when todo not found', async () => {
      mockRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.updateTodo('nonexistent', { title: 'Test' }),
      ).rejects.toThrow('Todo not found');
    });
  });

  describe('toggleTodo', () => {
    it('should toggle completed status', async () => {
      const toggledTodo = { ...mockTodo, completed: true };

      mockRepository.findById.mockResolvedValue(mockTodo);
      mockRepository.update.mockResolvedValue(toggledTodo);

      const result = await service.toggleTodo('1');
      expect(result.completed).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        completed: true,
      });
    });

    it('should throw error when todo not found', async () => {
      mockRepository.findById.mockResolvedValue(undefined);

      await expect(service.toggleTodo('nonexistent')).rejects.toThrow(
        'Todo not found',
      );
    });
  });

  describe('deleteTodo', () => {
    it('should delete todo when exists', async () => {
      mockRepository.findById.mockResolvedValue(mockTodo);
      mockRepository.delete.mockResolvedValue(true);

      await service.deleteTodo('1');
      expect(mockRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should throw error when todo not found', async () => {
      mockRepository.findById.mockResolvedValue(undefined);

      await expect(service.deleteTodo('nonexistent')).rejects.toThrow(
        'Todo not found',
      );
    });
  });
});

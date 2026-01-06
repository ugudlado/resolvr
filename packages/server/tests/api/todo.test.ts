import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { mock } from 'vitest-mock-extended';
import { TodoController } from '../../src/controllers/todo.controller';
import { createTodoRouter } from '../../src/routes/todo.routes';
import { TodoService } from '../../src/services/todo.service';
import type { Todo } from '@todos/schema';

describe('Todo API', () => {
  let app: Express;
  let mockService: ReturnType<typeof mock<TodoService>>;

  const mockTodo: Todo = {
    id: '1',
    title: 'Test Todo',
    description: 'Test description',
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockService = mock<TodoService>();
    const controller = new TodoController(mockService);
    const router = createTodoRouter(controller);

    app = express();
    app.use(express.json());
    app.use('/api/todos', router);
  });

  describe('GET /api/todos', () => {
    it('should return all todos', async () => {
      mockService.getAllTodos.mockResolvedValue([mockTodo]);

      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Test Todo');
    });

    it('should return empty array when no todos', async () => {
      mockService.getAllTodos.mockResolvedValue([]);

      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return todo when found', async () => {
      mockService.getTodoById.mockResolvedValue(mockTodo);

      const response = await request(app).get('/api/todos/1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('1');
      expect(response.body.title).toBe('Test Todo');
    });

    it('should return 404 when todo not found', async () => {
      mockService.getTodoById.mockRejectedValue(new Error('Todo not found'));

      const response = await request(app).get('/api/todos/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Todo not found');
    });
  });

  describe('POST /api/todos', () => {
    it('should create todo with valid data', async () => {
      const newTodo = {
        title: 'New Todo',
        description: 'New description',
        completed: false,
      };

      mockService.createTodo.mockResolvedValue({
        ...mockTodo,
        ...newTodo,
        id: '2',
      });

      const response = await request(app).post('/api/todos').send(newTodo);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Todo');
    });

    it('should return 400 with invalid data', async () => {
      const invalidTodo = {
        title: '',
      };

      const response = await request(app).post('/api/todos').send(invalidTodo);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update todo with valid data', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedTodo = { ...mockTodo, title: 'Updated Title' };

      mockService.updateTodo.mockResolvedValue(updatedTodo);

      const response = await request(app)
        .put('/api/todos/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should return 404 when todo not found', async () => {
      mockService.updateTodo.mockRejectedValue(new Error('Todo not found'));

      const response = await request(app)
        .put('/api/todos/nonexistent')
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/todos/:id/toggle', () => {
    it('should toggle todo completion status', async () => {
      const toggledTodo = { ...mockTodo, completed: true };
      mockService.toggleTodo.mockResolvedValue(toggledTodo);

      const response = await request(app).patch('/api/todos/1/toggle');

      expect(response.status).toBe(200);
      expect(response.body.completed).toBe(true);
    });

    it('should return 404 when todo not found', async () => {
      mockService.toggleTodo.mockRejectedValue(new Error('Todo not found'));

      const response = await request(app).patch('/api/todos/nonexistent/toggle');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete todo when exists', async () => {
      mockService.deleteTodo.mockResolvedValue();

      const response = await request(app).delete('/api/todos/1');

      expect(response.status).toBe(204);
    });

    it('should return 404 when todo not found', async () => {
      mockService.deleteTodo.mockRejectedValue(new Error('Todo not found'));

      const response = await request(app).delete('/api/todos/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});

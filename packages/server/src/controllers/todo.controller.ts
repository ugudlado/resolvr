import type { Request, Response, NextFunction } from 'express';
import type { TodoService } from '../services/todo.service';
import {
  createTodoSchema,
  updateTodoSchema,
  type CreateTodoInput,
  type UpdateTodoInput,
} from '@todos/schema';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware';

export class TodoController {
  constructor(private todoService: TodoService) {}

  async getAllTodos(req: Request, res: Response, next: NextFunction) {
    try {
      logger.debug('Fetching all todos');
      const todos = await this.todoService.getAllTodos();
      logger.debug(`Found ${todos.length} todos`);
      res.json({ success: true, data: todos });
    } catch (error) {
      next(error);
    }
  }

  async getTodoById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      logger.debug('Fetching todo', { id });
      const todo = await this.todoService.getTodoById(id);
      res.json({ success: true, data: todo });
    } catch (error) {
      if (error instanceof Error && error.message === 'Todo not found') {
        next(ApiError.notFound(error.message, 'TODO_NOT_FOUND'));
      } else {
        next(error);
      }
    }
  }

  async createTodo(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateTodoInput = createTodoSchema.parse(req.body);
      logger.debug('Creating todo', { title: data.title });
      const todo = await this.todoService.createTodo(data);
      logger.info('Todo created', { id: todo.id, title: todo.title });
      res.status(201).json({ success: true, data: todo });
    } catch (error) {
      next(error);
    }
  }

  async updateTodo(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateTodoInput = updateTodoSchema.parse(req.body);
      logger.debug('Updating todo', { id, updates: Object.keys(data) });
      const todo = await this.todoService.updateTodo(id, data);
      logger.info('Todo updated', { id: todo.id });
      res.json({ success: true, data: todo });
    } catch (error) {
      if (error instanceof Error && error.message === 'Todo not found') {
        next(ApiError.notFound(error.message, 'TODO_NOT_FOUND'));
      } else {
        next(error);
      }
    }
  }

  async toggleTodo(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      logger.debug('Toggling todo', { id });
      const todo = await this.todoService.toggleTodo(id);
      logger.info('Todo toggled', { id: todo.id, completed: todo.completed });
      res.json({ success: true, data: todo });
    } catch (error) {
      if (error instanceof Error && error.message === 'Todo not found') {
        next(ApiError.notFound(error.message, 'TODO_NOT_FOUND'));
      } else {
        next(error);
      }
    }
  }

  async deleteTodo(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      logger.debug('Deleting todo', { id });
      await this.todoService.deleteTodo(id);
      logger.info('Todo deleted', { id });
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Todo not found') {
        next(ApiError.notFound(error.message, 'TODO_NOT_FOUND'));
      } else {
        next(error);
      }
    }
  }
}

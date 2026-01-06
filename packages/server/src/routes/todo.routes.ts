import { Router } from 'express';
import type { TodoController } from '../controllers/todo.controller';

export function createTodoRouter(todoController: TodoController): Router {
  const router = Router();

  router.get('/', (req, res, next) => todoController.getAllTodos(req, res, next));
  router.get('/:id', (req, res, next) => todoController.getTodoById(req, res, next));
  router.post('/', (req, res, next) => todoController.createTodo(req, res, next));
  router.put('/:id', (req, res, next) => todoController.updateTodo(req, res, next));
  router.patch('/:id/toggle', (req, res, next) => todoController.toggleTodo(req, res, next));
  router.delete('/:id', (req, res, next) => todoController.deleteTodo(req, res, next));

  return router;
}

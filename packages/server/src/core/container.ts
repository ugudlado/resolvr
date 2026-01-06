import { createContainer, asClass, asFunction, InjectionMode } from 'awilix';
import { createDatabase, type Database } from '../config/database';
import { TodoRepository } from '../repositories/todo.repository';
import { TodoService } from '../services/todo.service';
import { TodoController } from '../controllers/todo.controller';

export function setupContainer(databaseUrl: string) {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC,
  });

  container.register({
    // Database
    db: asFunction(() => createDatabase(databaseUrl)).singleton(),

    // Repositories
    todoRepository: asClass(TodoRepository).singleton(),

    // Services
    todoService: asClass(TodoService).singleton(),

    // Controllers
    todoController: asClass(TodoController).singleton(),
  });

  return container;
}

export type AppContainer = ReturnType<typeof setupContainer>;

export interface ContainerCradle {
  db: Database;
  todoRepository: TodoRepository;
  todoService: TodoService;
  todoController: TodoController;
}

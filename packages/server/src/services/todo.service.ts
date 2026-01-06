import type { TodoRepository } from '../repositories/todo.repository';
import type { CreateTodoInput, UpdateTodoInput } from '@todos/schema';
import type { Todo } from '@todos/schema';

export class TodoService {
  constructor(private todoRepository: TodoRepository) {}

  async getAllTodos(): Promise<Todo[]> {
    return this.todoRepository.findAll();
  }

  async getTodoById(id: string): Promise<Todo> {
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new Error('Todo not found');
    }
    return todo;
  }

  async createTodo(data: CreateTodoInput): Promise<Todo> {
    return this.todoRepository.create(data);
  }

  async updateTodo(id: string, data: UpdateTodoInput): Promise<Todo> {
    const existingTodo = await this.todoRepository.findById(id);
    if (!existingTodo) {
      throw new Error('Todo not found');
    }

    const updated = await this.todoRepository.update(id, data);
    if (!updated) {
      throw new Error('Failed to update todo');
    }
    return updated;
  }

  async toggleTodo(id: string): Promise<Todo> {
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new Error('Todo not found');
    }

    const updated = await this.todoRepository.update(id, {
      completed: !todo.completed,
    });
    if (!updated) {
      throw new Error('Failed to toggle todo');
    }
    return updated;
  }

  async deleteTodo(id: string): Promise<void> {
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new Error('Todo not found');
    }

    const deleted = await this.todoRepository.delete(id);
    if (!deleted) {
      throw new Error('Failed to delete todo');
    }
  }
}

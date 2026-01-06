import express from 'express';
import { setupContainer } from './core/container';
import { createTodoRouter } from './routes/todo.routes';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler, requestLogger } from './middleware';

const PORT = process.env.PORT || 3001;
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://localhost:5432/template_dev';

const app = express();

// Request logging (before routes)
app.use(requestLogger);

// Body parsing
app.use(express.json());

// Setup DI container
logger.info('Setting up DI container', { database: DATABASE_URL.split('@')[1] || 'local' });
const container = setupContainer(DATABASE_URL);

// Routes
const todoController = container.resolve('todoController');
app.use('/api/todos', createTodoRouter(todoController));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler (after routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });
});

export { app, container };

export const config = {
  port: process.env.PORT || 3000,
  jwt: {
    secret: process.env.JWT_SECRET || 'eduscope-jwt-secret-key-change-in-production',
    expiresIn: '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123456',
    database: process.env.MYSQL_DATABASE || 'eduscope',
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
};

/// <reference types="node" />

import { env } from 'node:process';

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      env.DATABASE_URL || 'postgresql://intelli_user:intelli_pass@localhost:5432/intelli_factory',
  },
};

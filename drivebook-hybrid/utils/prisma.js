'use strict';

/**
 * Shared Prisma client — single instance for the entire hybrid service.
 *
 * Using one instance prevents connection pool exhaustion caused by creating
 * multiple PrismaClient instances in the same Node process.
 *
 * In development the client is attached to the global object so hot-reload
 * (nodemon) doesn't create a new pool on every file change.
 */

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;

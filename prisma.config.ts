import path from 'node:path'
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set (see .env.example)')
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
})

import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',                  // from your DATABASE_URL
  host: 'localhost',
  database: 'inventory',
  password: '123456',    // same as in .env
  port: 5432,
});

export default pool;

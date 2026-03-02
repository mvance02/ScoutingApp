import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from './db.js'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', '019_add_home_state.sql')
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8')
    console.log('Running migration: 019_add_home_state.sql')
    
    await pool.query(sql)
    console.log('Migration completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

runMigration()

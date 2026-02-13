import pool from './db.js'

async function testConnection() {
  console.log('Testing database connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET')
  
  try {
    const client = await pool.connect()
    console.log('✓ Successfully connected to database')
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as version')
    console.log('✓ Database query successful')
    console.log('  Current time:', result.rows[0].current_time)
    console.log('  PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1])
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    console.log(`✓ Found ${tablesResult.rows.length} tables in database`)
    if (tablesResult.rows.length > 0) {
      console.log('  Tables:', tablesResult.rows.map(r => r.table_name).join(', '))
    }
    
    client.release()
    console.log('\n✓ Database connection test passed!')
    process.exit(0)
  } catch (err) {
    console.error('✗ Database connection failed!')
    console.error('Error:', err.message)
    if (err.code === 'ECONNREFUSED') {
      console.error('\nPossible issues:')
      console.error('  - PostgreSQL server is not running')
      console.error('  - Wrong host/port in DATABASE_URL')
    } else if (err.code === '28P01') {
      console.error('\nPossible issues:')
      console.error('  - Invalid username or password')
    } else if (err.code === '3D000') {
      console.error('\nPossible issues:')
      console.error('  - Database does not exist')
    } else if (!process.env.DATABASE_URL) {
      console.error('\nPossible issues:')
      console.error('  - DATABASE_URL environment variable is not set')
      console.error('  - Create a .env file in the server/ directory with:')
      console.error('    DATABASE_URL=postgresql://user:password@host:port/database')
    }
    process.exit(1)
  }
}

testConnection()

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
    // First, connect to default 'postgres' database to create our database
    const adminClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        console.log('🔄 Connecting to PostgreSQL...');
        await adminClient.connect();
        console.log('✅ Connected to PostgreSQL');

        const dbName = process.env.DB_NAME || 'bizmind_ai';

        // Check if database exists
        const result = await adminClient.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );

        if (result.rows.length === 0) {
            console.log(`📦 Creating database: ${dbName}`);
            await adminClient.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Database ${dbName} created`);
        } else {
            console.log(`✅ Database ${dbName} already exists`);
        }

        await adminClient.end();
        // Now connect to our database and run schema
        const dbClient = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: dbName,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
        });

        console.log(`🔄 Connecting to database: ${dbName}`);
        await dbClient.connect();

        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Running schema migration...');
        await dbClient.query(schema);
        console.log('✅ Schema migration completed successfully');

        await dbClient.end();

        console.log('\n🎉 Database setup completed!');
        console.log(`📊 Database: ${dbName}`);
        console.log('🚀 You can now start the server with: npm run dev\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Make sure PostgreSQL is running');
        console.error('   2. Check your .env file credentials');
        console.error('   3. Verify database user has CREATE DATABASE permission\n');
        process.exit(1);
    }
}

runMigration();
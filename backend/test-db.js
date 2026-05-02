require('dotenv').config();
const prisma = require('./config/prisma');

async function main() {
  try {
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    console.log(`Using DATABASE_URL: ${dbUrl.replace(/:([^@]+)@/, ':****@')}`);
    
    console.log('Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`Database connected successfully. User count: ${userCount}`);
  } catch (error) {
    console.error('Database connection failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

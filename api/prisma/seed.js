const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Forced Seeding script...');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const userEmail = 'user@example.com';

    // Hash passwords using env or defaults
    const adminPass = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'AdminPass123!', 10);
    const userPass = bcrypt.hashSync('UserPass123!', 10);

    console.log('Updating/Creating admin user...');
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            password: adminPass,
            role: 'admin'
        },
        create: {
            email: adminEmail,
            password: adminPass,
            role: 'admin'
        }
    });

    console.log('Updating/Creating test user...');
    await prisma.user.upsert({
        where: { email: userEmail },
        update: {
            password: userPass,
            role: 'user'
        },
        create: {
            email: userEmail,
            password: userPass,
            role: 'user'
        }
    });

    console.log('✅ Forced seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

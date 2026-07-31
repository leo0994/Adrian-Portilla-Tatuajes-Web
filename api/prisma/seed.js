const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding script...');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.error('❌ Faltan variables de entorno ADMIN_EMAIL y/o ADMIN_PASSWORD en tu .env.');
        console.error('   Defínelas antes de correr el seed. No se usarán credenciales por defecto.');
        process.exit(1);
    }

    if (adminPassword.length < 8) {
        console.error('❌ ADMIN_PASSWORD debe tener al menos 8 caracteres.');
        process.exit(1);
    }

    const adminPass = bcrypt.hashSync(adminPassword, 12);

    console.log(`Updating/Creating admin user (${adminEmail})...`);
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

    console.log('✅ Seeding complete! (no test/demo user created)');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

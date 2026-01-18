const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubscription() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: 'cmkgpr6uy0000z5ykk1q8c499' },
      include: { subscription: true }
    });
    
    console.log('User found:', user?.email);
    console.log('Subscription:', JSON.stringify(user?.subscription, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscription();

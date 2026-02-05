import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test organization
  const org = await prisma.organization.upsert({
    where: { id: 'org_34cUVXYdLPmUUb6ijvXohVYEi1V' },
    update: {},
    create: {
      id: 'org_34cUVXYdLPmUUb6ijvXohVYEi1V',
      name: '23123123',
      slug: 'test-org',
    },
  });
  console.log('✅ Organization created:', org.name);

  // Create/update your user
  const user = await prisma.user.upsert({
    where: { id: 'user_2zssasQgWPFWcwIWnJbnVSputvM' },
    update: {
      organizationId: org.id,
      email: 'isaac@frontstep.ai',
      firstName: 'Test',
      lastName: 'Tester',
    },
    create: {
      id: 'user_2zssasQgWPFWcwIWnJbnVSputvM',
      email: 'isaac@frontstep.ai',
      firstName: 'Test',
      lastName: 'Tester',
      organizationId: org.id,
    },
  });
  console.log('✅ User created:', user.email);

  // Create test assets
  const asset1 = await prisma.asset.upsert({
    where: { normalizedAddress: '123 MAIN ST, NEW YORK, NY, USA' },
    update: {},
    create: {
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      normalizedAddress: '123 MAIN ST, NEW YORK, NY, USA',
    },
  });

  const asset2 = await prisma.asset.upsert({
    where: { normalizedAddress: '456 BROADWAY, NEW YORK, NY, USA' },
    update: {},
    create: {
      address: '456 Broadway',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      normalizedAddress: '456 BROADWAY, NEW YORK, NY, USA',
    },
  });

  const asset3 = await prisma.asset.upsert({
    where: { normalizedAddress: '789 PARK AVE, NEW YORK, NY, USA' },
    update: {},
    create: {
      address: '789 Park Ave',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      normalizedAddress: '789 PARK AVE, NEW YORK, NY, USA',
    },
  });

  console.log('✅ Assets created');

  // Create test contacts
  const contact1 = await prisma.contact.upsert({
    where: { email: 'broker1@example.com' },
    update: {},
    create: {
      email: 'broker1@example.com',
      firstName: 'John',
      lastName: 'Smith',
    },
  });

  const contact2 = await prisma.contact.upsert({
    where: { email: 'broker2@example.com' },
    update: {},
    create: {
      email: 'broker2@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    },
  });

  console.log('✅ Contacts created');

  // Create test deals
  const deals = [
    {
      id: 'deal_1',
      organizationId: org.id,
      receivedByUserId: user.id,
      sourceMessageId: 'msg_123',
      sourceFrom: 'broker1@example.com',
      sourceSubject: 'Off-Market Opportunity - 123 Main St Multifamily',
      sourceReceivedAt: new Date('2026-01-15T10:00:00Z'),
      initialScreeningDecision: 'YES' as const,
      initialScreeningSummary: 'Strong cash-flowing multifamily in prime location. 6.5% cap rate, stable tenancy.',
      detectionConfidence: 'high',
      detectionReason: 'Email contains acquisition details and offering memorandum',
      assetId: asset1.id,
      contactId: contact1.id,
    },
    {
      id: 'deal_2',
      organizationId: org.id,
      receivedByUserId: user.id,
      sourceMessageId: 'msg_456',
      sourceFrom: 'broker2@example.com',
      sourceSubject: 'Exclusive - 456 Broadway Office Building',
      sourceReceivedAt: new Date('2026-01-20T14:30:00Z'),
      initialScreeningDecision: 'NO' as const,
      initialScreeningSummary: 'Office building with high vacancy. Below market cap rate but requires significant capex.',
      detectionConfidence: 'high',
      detectionReason: 'Email contains teaser and property details',
      folderMovedTo: 'Passed Deals',
      assetId: asset2.id,
      contactId: contact2.id,
    },
    {
      id: 'deal_3',
      organizationId: org.id,
      receivedByUserId: user.id,
      sourceMessageId: 'msg_789',
      sourceFrom: 'broker1@example.com',
      sourceSubject: 'New Listing - 789 Park Ave Luxury Condo',
      sourceReceivedAt: new Date('2026-01-25T09:15:00Z'),
      initialScreeningDecision: 'YES' as const,
      initialScreeningSummary: 'Premium residential with strong demographics. 5.8% cap rate, trophy asset.',
      detectionConfidence: 'high',
      detectionReason: 'Email contains offering memorandum and financial details',
      assetId: asset3.id,
      contactId: contact1.id,
    },
  ];

  for (const dealData of deals) {
    await prisma.deal.upsert({
      where: { id: dealData.id },
      update: dealData,
      create: dealData,
    });
  }

  console.log(`✅ Created ${deals.length} test deals`);

  // Create screening preferences
  await prisma.screeningPreferences.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      companyName: 'Test Company',
      brandColor: '#3ECFA0',
      passedFolderName: 'Passed Deals',
      dealCriteria: 'Must be in New York, cap rate > 5%, multifamily or office preferred',
      digestSchedule: '0 9 * * *',
      digestTimeZone: 'America/New_York',
    },
  });

  console.log('✅ Screening preferences created');
  console.log('\n🎉 Seeding complete!');
  console.log('\nYou can now:');
  console.log('  - Sign in at http://localhost:3000/sign-in');
  console.log('  - View dashboard at http://localhost:3000/dashboard');
  console.log('  - View deals via API at http://localhost:3001/deals');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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
      email: 'isaac@dealwire.ai',
      firstName: 'Test',
      lastName: 'Tester',
    },
    create: {
      id: 'user_2zssasQgWPFWcwIWnJbnVSputvM',
      email: 'isaac@dealwire.ai',
      firstName: 'Test',
      lastName: 'Tester',
      organizationId: org.id,
    },
  });
  console.log('✅ User created:', user.email);

  // Create test assets
  const assetData = [
    { address: '123 Main St', city: 'New York', state: 'NY', country: 'USA' },
    { address: '456 Broadway', city: 'New York', state: 'NY', country: 'USA' },
    { address: '789 Park Ave', city: 'New York', state: 'NY', country: 'USA' },
    { address: '100 Wall St', city: 'New York', state: 'NY', country: 'USA' },
    { address: '55 Water St', city: 'New York', state: 'NY', country: 'USA' },
    {
      address: '200 Lexington Ave',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
    { address: '350 5th Ave', city: 'New York', state: 'NY', country: 'USA' },
    { address: '1 Penn Plaza', city: 'New York', state: 'NY', country: 'USA' },
    {
      address: '30 Hudson Yards',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
    { address: '425 Park Ave', city: 'New York', state: 'NY', country: 'USA' },
    { address: '1745 Broadway', city: 'New York', state: 'NY', country: 'USA' },
    { address: '601 W 26th St', city: 'New York', state: 'NY', country: 'USA' },
    { address: '85 Broad St', city: 'New York', state: 'NY', country: 'USA' },
    { address: '250 Vesey St', city: 'New York', state: 'NY', country: 'USA' },
    { address: '11 Times Sq', city: 'New York', state: 'NY', country: 'USA' },
    { address: '101 Collins Ave', city: 'Miami', state: 'FL', country: 'USA' },
    { address: '500 Brickell Ave', city: 'Miami', state: 'FL', country: 'USA' },
    {
      address: '900 Biscayne Blvd',
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
    {
      address: '333 Las Olas Way',
      city: 'Fort Lauderdale',
      state: 'FL',
      country: 'USA',
    },
    {
      address: '8701 Collins Ave',
      city: 'Miami Beach',
      state: 'FL',
      country: 'USA',
    },
  ];

  const assets: { id: string }[] = [];
  for (const a of assetData) {
    const normalized = `${a.address.toUpperCase()}, ${a.city.toUpperCase()}, ${a.state}, ${a.country}`;
    const asset = await prisma.asset.upsert({
      where: { normalizedAddress: normalized },
      update: {},
      create: { ...a, normalizedAddress: normalized },
    });
    assets.push(asset);
  }
  console.log(`✅ ${assets.length} assets created`);

  // Create test contacts
  const contactData = [
    { email: 'broker1@example.com', firstName: 'John', lastName: 'Smith' },
    { email: 'broker2@example.com', firstName: 'Jane', lastName: 'Doe' },
    { email: 'deals@cbre.com', firstName: 'Michael', lastName: 'Chen' },
    { email: 'acquisitions@jll.com', firstName: 'Sarah', lastName: 'Johnson' },
    {
      email: 'listings@cushwake.com',
      firstName: 'David',
      lastName: 'Williams',
    },
    {
      email: 'broker@marcusmillichap.com',
      firstName: 'Robert',
      lastName: 'Garcia',
    },
    { email: 'deals@eastdil.com', firstName: 'Emily', lastName: 'Martinez' },
    { email: 'offers@hff.com', firstName: 'Daniel', lastName: 'Brown' },
    { email: 'sales@colliers.com', firstName: 'Amanda', lastName: 'Wilson' },
    { email: 'teaser@newmark.com', firstName: 'Chris', lastName: 'Taylor' },
  ];

  const contacts: { id: string }[] = [];
  for (const c of contactData) {
    const contact = await prisma.contact.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    });
    contacts.push(contact);
  }
  console.log(`✅ ${contacts.length} contacts created`);

  // Create 35 test deals to exercise pagination (default page size = 20)
  const dealTemplates = [
    {
      subject: 'Off-Market Opportunity - 123 Main St Multifamily',
      decision: 'YES' as const,
      summary:
        'Strong cash-flowing multifamily in prime location. 6.5% cap rate, stable tenancy.',
    },
    {
      subject: 'Exclusive - 456 Broadway Office Building',
      decision: 'NO' as const,
      summary:
        'Office building with high vacancy. Below market cap rate but requires significant capex.',
      folder: 'Passed Deals',
    },
    {
      subject: 'New Listing - 789 Park Ave Luxury Condo',
      decision: 'YES' as const,
      summary:
        'Premium residential with strong demographics. 5.8% cap rate, trophy asset.',
    },
    {
      subject: 'Distressed Sale - 100 Wall St Mixed-Use',
      decision: 'YES' as const,
      summary:
        'Below replacement cost. Needs renovation but strong fundamentals. 7.2% cap rate.',
    },
    {
      subject: 'Portfolio Sale - 55 Water St Office Complex',
      decision: 'NO' as const,
      summary:
        'Large office complex with declining occupancy. Not aligned with current strategy.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Investment Opportunity - 200 Lexington Ave Retail',
      decision: 'YES' as const,
      summary:
        'Prime retail with long-term NNN leases. 5.5% cap rate, minimal management required.',
    },
    {
      subject: 'Offering Memorandum - 350 5th Ave Office Tower',
      decision: 'NO' as const,
      summary:
        'Iconic location but cap rate too low at 3.8%. Does not meet minimum yield requirements.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Teaser - 1 Penn Plaza Redevelopment',
      decision: 'YES' as const,
      summary:
        'Significant value-add potential. Current 4.5% cap rate with path to 7%+ after repositioning.',
    },
    {
      subject: 'Confidential - 30 Hudson Yards Class A Office',
      decision: 'YES' as const,
      summary:
        'Trophy asset in Hudson Yards. Strong tenant roster, 95% occupied. 5.2% cap rate.',
    },
    {
      subject: 'Price Reduction - 425 Park Ave Boutique Office',
      decision: 'NO' as const,
      summary:
        'Price reduced 15% but still above market. Tenant rollover risk in 2027.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Just Listed - 1745 Broadway Mixed-Use',
      decision: 'YES' as const,
      summary:
        'Retail and office combo with below-market rents. 6.0% cap rate, mark-to-market upside.',
    },
    {
      subject: 'Pocket Listing - 601 W 26th St Creative Office',
      decision: 'YES' as const,
      summary:
        'Chelsea creative office with tech tenants. 5.9% cap rate, strong rent growth trajectory.',
    },
    {
      subject: 'Offering - 85 Broad St FiDi Office',
      decision: 'NO' as const,
      summary:
        'FiDi office with dated finishes. Would require $50M+ in capex to reposition.',
      folder: 'Passed Deals',
    },
    {
      subject: 'For Sale - 250 Vesey St Waterfront Office',
      decision: 'YES' as const,
      summary:
        'Class A waterfront with views. 5.4% cap rate, long-term government tenant.',
    },
    {
      subject: 'Exclusive Listing - 11 Times Sq Flagship Retail',
      decision: 'NO' as const,
      summary:
        'Retail in Times Sq faces headwinds. Tourism recovery uncertain, high ask price.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Miami Opportunity - 101 Collins Ave Beachfront',
      decision: 'NO' as const,
      summary:
        'Outside target market (New York only). Pass per investment criteria.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Brickell Tower - 500 Brickell Ave Luxury Resi',
      decision: 'NO' as const,
      summary: 'Miami market - does not meet geographic criteria.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Waterfront Development - 900 Biscayne Blvd',
      decision: 'NO' as const,
      summary: 'Development deal in Miami. Outside geographic focus area.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Fort Lauderdale Mixed-Use - 333 Las Olas Way',
      decision: 'NO' as const,
      summary: 'South Florida mixed-use. Not in target geography.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Beachfront Condo - 8701 Collins Ave Miami Beach',
      decision: 'NO' as const,
      summary:
        'Luxury condo in Miami Beach. Automatic no per NY-only criteria.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Follow-Up: 123 Main St Updated Financials',
      decision: 'YES' as const,
      summary:
        'Updated pro forma confirms 6.8% stabilized cap rate. Recommend proceeding.',
    },
    {
      subject: 'RE: 789 Park Ave - Revised Offer Terms',
      decision: 'YES' as const,
      summary:
        'Seller accepted revised terms. Price now at $45M, 6.0% cap rate.',
    },
    {
      subject: 'New OM - 200 Lexington Ave Full Package',
      decision: 'YES' as const,
      summary:
        'Full OM received. Financials confirm 5.5% in-place, 6.2% pro forma cap rate.',
    },
    {
      subject: 'Price Update - 350 5th Ave Repriced',
      decision: 'NO' as const,
      summary:
        'Repriced at $120M but still 4.0% cap rate. Below our 5% minimum.',
      folder: 'Passed Deals',
    },
    {
      subject: 'BOV Request - 30 Hudson Yards Competitive Process',
      decision: 'YES' as const,
      summary:
        'Best and final round. Our analysis supports $95M valuation at 5.3% cap rate.',
    },
    {
      subject: 'RE: 1745 Broadway - Environmental Report',
      decision: 'YES' as const,
      summary:
        'Phase I environmental came back clean. No issues identified. Proceed with due diligence.',
    },
    {
      subject: 'Urgent: 601 W 26th St Multiple Offers',
      decision: 'YES' as const,
      summary:
        'Competitive situation developing. Broker confirms 3 offers in. Recommend aggressive bid.',
    },
    {
      subject: 'Update: 250 Vesey St Tenant Renewal Confirmed',
      decision: 'YES' as const,
      summary:
        'Government tenant renewed for 10 years. Cap rate now effectively 5.6% with certainty.',
    },
    {
      subject: 'Withdrawn - 425 Park Ave Off Market',
      decision: 'NO' as const,
      summary: 'Seller has withdrawn the listing. No longer available.',
      folder: 'Passed Deals',
    },
    {
      subject: 'RE: 85 Broad St - Counter Proposal',
      decision: 'NO' as const,
      summary:
        'Seller countered at $80M. Still too high given required capex. Passing.',
      folder: 'Passed Deals',
    },
    {
      subject: 'New Deal - 15 Central Park West Ultra-Luxury',
      decision: 'YES' as const,
      summary:
        'Rare opportunity at 15 CPW. Trophy residential, 4.8% cap rate but irreplaceable location.',
    },
    {
      subject: 'Teaser - 60 Wall St Conversion Opportunity',
      decision: 'YES' as const,
      summary:
        'Office-to-resi conversion play. Attractive basis at $200/SF. Strong residential demand.',
    },
    {
      subject: 'Off-Market - 220 Central Park South Penthouse',
      decision: 'YES' as const,
      summary:
        'Ultra-luxury penthouse unit. Comparable sales support 5.2% yield. Trophy asset.',
    },
    {
      subject: 'Portfolio - Midtown 5-Building Office Package',
      decision: 'NO' as const,
      summary:
        'Portfolio too large at $500M. Would exceed single-asset concentration limits.',
      folder: 'Passed Deals',
    },
    {
      subject: 'Teaser - SoHo Retail Portfolio (3 Properties)',
      decision: 'YES' as const,
      summary:
        'SoHo retail with below-market rents. Avg 5.7% cap rate with significant mark-to-market upside.',
    },
  ];

  for (let i = 0; i < dealTemplates.length; i++) {
    const t = dealTemplates[i];
    const assetIdx = i % assets.length;
    const contactIdx = i % contacts.length;
    // Spread deals across Jan-Feb 2026
    const dayOffset = i;
    const receivedAt = new Date(
      2026,
      0,
      5 + dayOffset,
      8 + (i % 12),
      (i * 17) % 60,
    );

    const dealId = `deal_seed_${i + 1}`;
    await prisma.deal.upsert({
      where: { id: dealId },
      update: {
        sourceSubject: t.subject,
        folderMovedTo: t.folder || null,
        assetId: assets[assetIdx].id,
        contactId: contacts[contactIdx].id,
        sourceReceivedAt: receivedAt,
      },
      create: {
        id: dealId,
        organizationId: org.id,
        receivedByUserId: user.id,
        sourceMessageId: `msg_seed_${i + 1}`,
        sourceFrom: contactData[contactIdx].email,
        sourceSubject: t.subject,
        sourceReceivedAt: receivedAt,
        detectionConfidence: 'high',
        detectionReason:
          'Email contains acquisition details and deal information',
        folderMovedTo: t.folder || null,
        assetId: assets[assetIdx].id,
        contactId: contacts[contactIdx].id,
      },
    });

    // Create InitialScreening record (the proper relation)
    await prisma.initialScreening.upsert({
      where: { dealId },
      update: {
        decision: t.decision,
        reason: t.summary,
      },
      create: {
        dealId,
        decision: t.decision,
        reason: t.summary,
      },
    });
  }

  // Clean up old seed deals with legacy IDs
  for (const legacyId of ['deal_1', 'deal_2', 'deal_3']) {
    await prisma.deal.deleteMany({ where: { id: legacyId } });
  }

  console.log(`✅ Created ${dealTemplates.length} test deals`);

  // Create screening preferences
  await prisma.screeningPreferences.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      companyName: 'Test Company',
      brandColor: '#3ECFA0',
      passedFolderName: 'Passed Deals',
      dealCriteria:
        'Must be in New York, cap rate > 5%, multifamily or office preferred',
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

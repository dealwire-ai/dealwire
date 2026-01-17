import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface JsonPreferences {
  deal_criteria?: string | null;
  logo_url?: string | null;
  company_name?: string | null;
  brand_color?: string | null;
  passedFolderName?: string | null;
}

async function migratePreferences() {
  console.log('Starting preferences migration...');

  // Load JSON preferences
  const preferencesPath = join(__dirname, '../src/data/preferences.json');
  const rawData = readFileSync(preferencesPath, 'utf-8');
  const jsonPreferences: Record<string, JsonPreferences> = JSON.parse(rawData);

  // Get all users with organizationId
  const usersWithOrg = await prisma.user.findMany({
    where: {
      organizationId: { not: null },
    },
    select: {
      id: true,
      email: true,
      organizationId: true,
    },
  });

  console.log(`Found ${usersWithOrg.length} users with organizations`);

  // Map email -> organizationId
  const emailToOrgId = new Map<string, string>();
  for (const user of usersWithOrg) {
    if (user.email && user.organizationId) {
      emailToOrgId.set(user.email.toLowerCase(), user.organizationId);
    }
  }

  // Get default preferences
  const defaultPrefs = jsonPreferences['_default'] || {};

  // Track which organizations we've processed
  const processedOrgs = new Set<string>();

  // Migrate preferences for users with matching emails
  for (const [email, prefs] of Object.entries(jsonPreferences)) {
    if (email === '_default') continue;

    const emailLower = email.toLowerCase();
    const orgId = emailToOrgId.get(emailLower);

    if (!orgId) {
      console.log(`Skipping ${email} - user not found or has no organizationId`);
      continue;
    }

    if (processedOrgs.has(orgId)) {
      console.log(`Skipping ${email} - organization ${orgId} already processed`);
      continue;
    }

    // Check if preferences already exist
    const existing = await prisma.screeningPreferences.findUnique({
      where: { organizationId: orgId },
    });

    if (existing) {
      console.log(`Updating preferences for org ${orgId} (from ${email})`);
      await prisma.screeningPreferences.update({
        where: { organizationId: orgId },
        data: {
          companyName: prefs.company_name || null,
          brandColor: prefs.brand_color || null,
          passedFolderName: prefs.passedFolderName || null,
          dealCriteria: prefs.deal_criteria || null,
          logoUrl: prefs.logo_url || null,
          alwaysSkip: null, // New field, no migration data
        },
      });
    } else {
      console.log(`Creating preferences for org ${orgId} (from ${email})`);
      await prisma.screeningPreferences.create({
        data: {
          organizationId: orgId,
          companyName: prefs.company_name || null,
          brandColor: prefs.brand_color || null,
          passedFolderName: prefs.passedFolderName || null,
          dealCriteria: prefs.deal_criteria || null,
          logoUrl: prefs.logo_url || null,
          alwaysSkip: null, // New field, no migration data
        },
      });
    }

    processedOrgs.add(orgId);
  }

  // Create default preferences for organizations without any
  const allOrgs = await prisma.organization.findMany({
    select: { id: true },
  });

  for (const org of allOrgs) {
    if (processedOrgs.has(org.id)) continue;

    const existing = await prisma.screeningPreferences.findUnique({
      where: { organizationId: org.id },
    });

    if (!existing) {
      console.log(`Creating default preferences for org ${org.id}`);
      await prisma.screeningPreferences.create({
        data: {
          organizationId: org.id,
          companyName: defaultPrefs.company_name || null,
          brandColor: defaultPrefs.brand_color || null,
          passedFolderName: defaultPrefs.passedFolderName || null,
          dealCriteria: defaultPrefs.deal_criteria || null,
          logoUrl: defaultPrefs.logo_url || null,
          alwaysSkip: null,
        },
      });
    }
  }

  console.log('Migration complete!');
}

migratePreferences()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

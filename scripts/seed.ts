import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { 
  users, 
  instructors, 
  classTemplates, 
  classSessions, 
  bookings, 
  creditPackages, 
  creditTransactions,
  creditPurchases,
  studios
} from '../src/db/schema';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Resolve the default studio for seeded data.
    const [studio] = await db.select({ id: studios.id }).from(studios).orderBy(studios.createdAt).limit(1);
    if (!studio) {
      throw new Error('No studio found in the database. Create a studio before running this seed script.');
    }

    // Clean existing data (in order of dependencies)
    console.log('🧹 Cleaning existing data...');
    await db.delete(bookings);
    await db.delete(classSessions);
    await db.delete(classTemplates);
    await db.delete(creditTransactions);
    await db.delete(creditPurchases);
    await db.delete(creditPackages);
    await db.delete(instructors);
    await db.delete(users);

    // Create users
    console.log('👥 Creating users...');
    const adminUser = await db.insert(users).values({
      email: 'admin@pilatesos.com',
      name: 'Admin User',
      role: 'admin',
      studioId: studio.id,
      passwordHash: await bcrypt.hash('password123', 10),
    }).returning();

    const instructorUsers = await db.insert(users).values([
      {
        email: 'sarah@pilatesos.com',
        name: 'Sarah Johnson',
        role: 'instructor',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
      },
      {
        email: 'mike@pilatesos.com',
        name: 'Mike Chen',
        role: 'instructor',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
      },
    ]).returning();

    const studentUsers = await db.insert(users).values([
      {
        email: 'alice@example.com',
        name: 'Alice Smith',
        role: 'student',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
      },
      {
        email: 'bob@example.com',
        name: 'Bob Wilson',
        role: 'student',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
      },
      {
        email: 'carol@example.com',
        name: 'Carol Davis',
        role: 'student',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
      },
    ]).returning();

    // Create instructors
    console.log('👨‍🏫 Creating instructors...');
    const instructorRecords = await db.insert(instructors).values([
      {
        userId: instructorUsers[0].id,
        bio: 'Certified Pilates instructor with 10+ years experience. Specializing in reformer and mat Pilates.',
        intensityLevel: 'medium',
        specialties: ['Reformer', 'Mat Pilates', 'Pre/Postnatal'],
        vibeTags: ['energetic', 'motivating', 'precise'],
        avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      },
      {
        userId: instructorUsers[1].id,
        bio: 'Former dancer turned Pilates instructor. Focus on core strength and flexibility.',
        intensityLevel: 'high',
        specialties: ['Advanced Reformer', 'Core Conditioning', 'Flexibility'],
        vibeTags: ['challenging', 'dynamic', 'fun'],
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      },
    ]).returning();

    // Create credit packages
    console.log('💳 Creating credit packages...');
    await db.insert(creditPackages).values([
      {
        name: 'Mat Starter Pack',
        studioId: studio.id,
        description: 'Perfect for beginners - 5 group mat classes',
        creditsAmount: 5,
        creditType: 'pass',
        priceCents: 7500, // €75 in cents
        currency: 'eur',
        isActive: true,
      },
      {
        name: 'Mat Regular Pack',
        studioId: studio.id,
        description: 'Most popular - 10 group mat classes',
        creditsAmount: 10,
        creditType: 'pass',
        priceCents: 14000, // €140 in cents
        currency: 'eur',
        isActive: true,
      },
      {
        name: 'Reformer Starter Pack',
        studioId: studio.id,
        description: 'Start your reformer journey - 5 classes',
        creditsAmount: 5,
        creditType: 'pass',
        priceCents: 10000, // €100 in cents
        currency: 'eur',
        isActive: true,
      },
      {
        name: 'Reformer Regular Pack',
        studioId: studio.id,
        description: '10 reformer group classes',
        creditsAmount: 10,
        creditType: 'pass',
        priceCents: 18000, // €180 in cents
        currency: 'eur',
        isActive: true,
      },
      {
        name: 'Reformer Private Pack',
        studioId: studio.id,
        description: '3 private reformer sessions (1:1 or 1:2)',
        creditsAmount: 3,
        creditType: 'session',
        priceCents: 24000, // €240 in cents
        currency: 'eur',
        isActive: true,
      },
    ]);

    // Create class templates
    console.log('📋 Creating class templates...');
    const classTemplatesData = await db.insert(classTemplates).values([
      {
        name: 'Beginner Mat Pilates',
        description: 'Perfect introduction to Pilates fundamentals on the mat',
        classType: 'mat_group',
        durationMinutes: 45,
        maxCapacity: 12,
        creditCost: 1,
        creditType: 'pass',
        instructorId: instructorRecords[0].id,
        vibeTags: ['beginner-friendly', 'foundational', 'slow-paced'],
        location: 'Studio A',
      },
      {
        name: 'Reformer Flow',
        description: 'Dynamic reformer workout for all levels',
        classType: 'reformer_group',
        durationMinutes: 55,
        maxCapacity: 6,
        creditCost: 3,
        creditType: 'pass',
        instructorId: instructorRecords[1].id,
        vibeTags: ['dynamic', 'full-body', 'energetic'],
        location: 'Studio B',
      },
      {
        name: 'Advanced Mat Challenge',
        description: 'Intense core-focused mat workout',
        classType: 'mat_group',
        durationMinutes: 60,
        maxCapacity: 10,
        creditCost: 1,
        creditType: 'pass',
        instructorId: instructorRecords[1].id,
        vibeTags: ['intense', 'core-focused', 'advanced'],
        location: 'Studio A',
      },
      {
        name: 'Prenatal Mat Pilates',
        description: 'Safe and effective mat workout for expecting mothers',
        classType: 'mat_group',
        durationMinutes: 50,
        maxCapacity: 8,
        creditCost: 1,
        creditType: 'pass',
        instructorId: instructorRecords[0].id,
        vibeTags: ['gentle', 'prenatal', 'supportive'],
        location: 'Studio C',
      },
      {
        name: 'Reformer Private (1:1 or 1:2)',
        description: 'Personalized private reformer session - book as 1:1 or bring a partner (1:2)',
        classType: 'reformer_private',
        durationMinutes: 60,
        maxCapacity: 2,
        creditCost: 5,
        creditType: 'session',
        instructorId: instructorRecords[0].id,
        vibeTags: ['personalized', 'focused', 'flexible'],
        location: 'Private Studio',
      },
    ]).returning();

    // Create upcoming class sessions (next 7 days)
    console.log('📅 Creating class sessions...');
    const now = new Date();
    const sessions: typeof classSessions.$inferInsert[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      
      // Morning sessions
      sessions.push({
        templateId: classTemplatesData[0].id,
        instructorId: instructorRecords[0].id,
        startsAt: new Date(date.setHours(9, 0, 0, 0)),
        endsAt: new Date(date.setHours(9, 45, 0, 0)),
        maxCapacity: 12,
        status: 'scheduled',
      });

      sessions.push({
        templateId: classTemplatesData[1].id,
        instructorId: instructorRecords[1].id,
        startsAt: new Date(date.setHours(10, 30, 0, 0)),
        endsAt: new Date(date.setHours(11, 25, 0, 0)),
        maxCapacity: 6,
        status: 'scheduled',
      });

      // Evening sessions
      sessions.push({
        templateId: classTemplatesData[2].id,
        instructorId: instructorRecords[1].id,
        startsAt: new Date(date.setHours(18, 0, 0, 0)),
        endsAt: new Date(date.setHours(18, 30, 0, 0)),
        maxCapacity: 10,
        status: 'scheduled',
      });

      if (i % 2 === 0) { // Every other day
        sessions.push({
          templateId: classTemplatesData[3].id,
          instructorId: instructorRecords[0].id,
          startsAt: new Date(date.setHours(12, 0, 0, 0)),
          endsAt: new Date(date.setHours(12, 50, 0, 0)),
          maxCapacity: 8,
          status: 'scheduled',
        });
      }
    }

    const createdSessions = await db.insert(classSessions).values(sessions).returning();

    // Create credit transactions for students (ledger entries)
    console.log('💰 Creating credit transactions...');
    await db.insert(creditTransactions).values([
      {
        userId: studentUsers[0].id,
        creditType: 'pass',
        type: 'purchase',
        amount: 8,
        description: 'Seed: initial pass credits',
      },
      {
        userId: studentUsers[0].id,
        creditType: 'pass',
        type: 'purchase',
        amount: 3,
        description: 'Seed: additional pass credits',
      },
      {
        userId: studentUsers[1].id,
        creditType: 'pass',
        type: 'purchase',
        amount: 5,
        description: 'Seed: initial pass credits',
      },
      {
        userId: studentUsers[2].id,
        creditType: 'pass',
        type: 'purchase',
        amount: 2,
        description: 'Seed: initial pass credits',
      },
    ]);

    // Create some sample bookings
    console.log('📝 Creating sample bookings...');
    const bookingsData: typeof bookings.$inferInsert[] = [];

    // Alice books mat classes
    bookingsData.push({
      userId: studentUsers[0].id,
      sessionId: createdSessions[0].id, // Beginner Mat Pilates
      status: 'confirmed',
      creditsSpent: 1,
      creditType: 'pass',
    });

    bookingsData.push({
      userId: studentUsers[0].id,
      sessionId: createdSessions[2].id, // Advanced Mat Challenge
      status: 'confirmed',
      creditsSpent: 1,
      creditType: 'pass',
    });

    // Bob books a reformer class
    bookingsData.push({
      userId: studentUsers[1].id,
      sessionId: createdSessions[1].id, // Reformer Flow
      status: 'confirmed',
      creditsSpent: 3,
      creditType: 'pass',
    });

    await db.insert(bookings).values(bookingsData);

    // Create credit purchases for testing admin payment functionality
    console.log('💳 Creating credit purchases...');
    const createdPackages = await db.select().from(creditPackages);
    
    const purchasesData = await db.insert(creditPurchases).values([
      {
        userId: studentUsers[0].id, // Alice
        packageId: createdPackages[0].id, // Mat Starter Pack
        creditsAmount: 5,
        creditType: 'pass',
        priceCents: 7500,
        currency: 'eur',
        paymentMethod: 'pay_at_studio',
        paymentStatus: 'pending',
        paymentDueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        adminNotes: null,
      },
      {
        userId: studentUsers[1].id, // Bob
        packageId: createdPackages[1].id, // Mat Regular Pack
        creditsAmount: 10,
        creditType: 'pass',
        priceCents: 14000,
        currency: 'eur',
        paymentMethod: 'pay_at_studio',
        paymentStatus: 'overdue',
        paymentDueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (overdue)
        adminNotes: 'Customer contacted twice',
      },
      {
        userId: studentUsers[0].id, // Alice
        packageId: createdPackages[2].id, // Reformer Starter Pack
        creditsAmount: 5,
        creditType: 'pass',
        priceCents: 10000,
        currency: 'eur',
        paymentMethod: 'pay_at_studio',
        paymentStatus: 'paid',
        paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        adminNotes: 'Paid in cash',
      },
      {
        userId: studentUsers[2].id, // Carol
        packageId: createdPackages[4].id, // Private Session Pack
        creditsAmount: 3,
        creditType: 'pass',
        priceCents: 24000,
        currency: 'eur',
        paymentMethod: 'stripe',
        paymentStatus: 'failed',
        adminNotes: 'Stripe payment failed - insufficient funds',
      },
      {
        userId: studentUsers[1].id, // Bob
        packageId: createdPackages[3].id, // Reformer Regular Pack
        creditsAmount: 10,
        creditType: 'pass',
        priceCents: 18000,
        currency: 'eur',
        paymentMethod: 'pay_at_studio',
        paymentStatus: 'pending',
        paymentDueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        adminNotes: null,
      },
    ]).returning();

    // Create credit transactions for paid purchases
    console.log('📊 Creating credit transactions...');
    await db.insert(creditTransactions).values([
      {
        userId: studentUsers[0].id, // Alice
        packageId: createdPackages[2].id, // Reformer Starter Pack
        type: 'purchase',
        creditType: 'pass',
        amount: 5,
        balanceAfter: 5,
        description: 'Credits from Reformer Starter Pack',
        processedBy: adminUser[0].id,
      },
    ]);

    // Update session booked counts
    console.log('🔢 Updating session booked counts...');
    for (const session of createdSessions) {
      const bookingCount = bookingsData.filter(b => b.sessionId === session.id).length;
      if (bookingCount > 0) {
        await db.update(classSessions)
          .set({ bookedCount: bookingCount })
          .where(eq(classSessions.id, session.id));
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('👤 Admin user: admin@pilatesos.com');
    console.log('👨‍🏫 Instructors: sarah@pilatesos.com, mike@pilatesos.com');
    console.log('👥 Students: alice@example.com, bob@example.com, carol@example.com');
    console.log('');
    console.log('📊 Created:');
    console.log(`   - ${studentUsers.length + instructorUsers.length + 1} users`);
    console.log(`   - ${instructorRecords.length} instructors`);
    console.log(`   - ${classTemplatesData.length} class templates`);
    console.log(`   - ${createdSessions.length} class sessions`);
    console.log(`   - ${bookingsData.length} bookings`);
    console.log(`   - ${createdPackages.length} credit packages`);
    console.log(`   - ${purchasesData.length} credit purchases`);
    console.log(`   - 1 credit transaction`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Import eq for the update query
import { eq } from 'drizzle-orm';

if (require.main === module) {
  seed().catch(console.error);
}

export { seed };

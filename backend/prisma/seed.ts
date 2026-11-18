import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prismaDatabaseClient = new PrismaClient();

function readRequiredEnvironmentVariable(environmentVariableName: string): string {
  const environmentVariableValue = process.env[environmentVariableName];
  if (!environmentVariableValue) {
    throw new Error(`Missing required environment variable: ${environmentVariableName}`);
  }
  return environmentVariableValue;
}

async function createOrUpdateUserAccount(accountDetails: {
  fullName: string;
  emailAddress: string;
  plainTextPassword: string;
  userRole: UserRole;
}) {
  const hashedPassword = await bcrypt.hash(accountDetails.plainTextPassword, 12);

  return prismaDatabaseClient.user.upsert({
    where: { emailAddress: accountDetails.emailAddress },
    update: { fullName: accountDetails.fullName, userRole: accountDetails.userRole },
    create: {
      fullName: accountDetails.fullName,
      emailAddress: accountDetails.emailAddress,
      hashedPassword,
      userRole: accountDetails.userRole,
    },
  });
}

async function seedDatabase() {
  const initialAdminEmailAddress = readRequiredEnvironmentVariable('INITIAL_ADMIN_EMAIL_ADDRESS');
  const initialAdminPassword = readRequiredEnvironmentVariable('INITIAL_ADMIN_PASSWORD');
  const demoAccountPassword = readRequiredEnvironmentVariable('DEMO_ACCOUNT_PASSWORD');

  await createOrUpdateUserAccount({
    fullName: 'Platform Administrator',
    emailAddress: initialAdminEmailAddress,
    plainTextPassword: initialAdminPassword,
    userRole: UserRole.ADMIN,
  });

  const demoInstructorUser = await createOrUpdateUserAccount({
    fullName: 'Demo Instructor',
    emailAddress: 'instructor@selahtechacademy.com',
    plainTextPassword: demoAccountPassword,
    userRole: UserRole.INSTRUCTOR,
  });

  await createOrUpdateUserAccount({
    fullName: 'Demo Student',
    emailAddress: 'student@selahtechacademy.com',
    plainTextPassword: demoAccountPassword,
    userRole: UserRole.STUDENT,
  });

  const existingDemoCourse = await prismaDatabaseClient.course.findFirst({
    where: { instructorUserId: demoInstructorUser.id, title: 'Introduction to Web Development' },
  });

  if (!existingDemoCourse) {
    await prismaDatabaseClient.course.create({
      data: {
        instructorUserId: demoInstructorUser.id,
        title: 'Introduction to Web Development',
        description: 'A starter course so the catalogue is not empty. Add real lessons from the instructor dashboard.',
        priceInKobo: 500000, // 5,000.00 NGN
        isPublished: true,
        courseModules: {
          create: [
            {
              title: 'Getting Started',
              sequenceOrderNumber: 1,
              lessons: {
                create: [
                  { title: 'How the web works', sequenceOrderNumber: 1 },
                  { title: 'Your first HTML page', sequenceOrderNumber: 2 },
                ],
              },
            },
            {
              // Demonstrates the scholarship rule: this section is only for full-price students.
              title: 'Capstone Project (full course only)',
              sequenceOrderNumber: 2,
              isIncludedInScholarship: false,
              lessons: { create: [{ title: 'Build and deploy your portfolio', sequenceOrderNumber: 1 }] },
            },
          ],
        },
      },
    });
  }

  console.log('Database seeded: administrator, demo instructor, demo student and demo course are ready.');
}

seedDatabase()
  .catch((seedingError) => {
    console.error('Seeding failed:', seedingError);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaDatabaseClient.$disconnect();
  });

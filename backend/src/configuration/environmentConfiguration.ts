import 'dotenv/config';
import { z } from 'zod';

/** docker-compose passes unset variables as empty text, so treat "" as "not provided". */
const emptyTextToUndefined = z
  .string()
  .optional()
  .transform((providedText) => (providedText && providedText.trim() !== '' ? providedText.trim() : undefined));

const environmentVariablesSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JSON_WEB_TOKEN_SECRET: z.string().min(16, 'JSON_WEB_TOKEN_SECRET must be at least 16 characters'),
  JSON_WEB_TOKEN_EXPIRES_IN: z.string().default('7d'),
  CLOUDINARY_CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'CLOUDINARY_CREDENTIALS_ENCRYPTION_KEY must be 64 hexadecimal characters'),
  PAYSTACK_SECRET_KEY: z.string().min(1, 'PAYSTACK_SECRET_KEY is required'),
  FRONTEND_BASE_URL: z.string().url(),
  ALLOWED_CORS_ORIGIN: z.string().min(1),
  COURSE_ACCESS_DURATION_IN_MONTHS: z.coerce.number().int().positive().default(3),
  COURSE_ACCESS_GRACE_PERIOD_IN_MONTHS: z.coerce.number().int().nonnegative().default(1),
  SCHOLARSHIP_DISCOUNT_PERCENTAGE: z.coerce.number().int().min(1).max(99).default(50),
  // E-mail (nodemailer). Leave SMTP_HOST empty to switch e-mail off.
  SMTP_HOST: emptyTextToUndefined,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USERNAME: emptyTextToUndefined,
  SMTP_PASSWORD: emptyTextToUndefined,
  EMAIL_SENDER_NAME: z.string().min(1).default('Selah Tech Academy'),
  EMAIL_SENDER_ADDRESS: z.string().email().default('no-reply@selahtechacademy.com.ng'),
});

const parsedEnvironmentVariables = environmentVariablesSchema.safeParse(process.env);

if (!parsedEnvironmentVariables.success) {
  console.error('Invalid environment configuration:');
  console.error(JSON.stringify(parsedEnvironmentVariables.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const validatedEnvironmentVariables = parsedEnvironmentVariables.data;

export const environmentConfiguration = {
  nodeEnvironment: validatedEnvironmentVariables.NODE_ENV,
  isProductionEnvironment: validatedEnvironmentVariables.NODE_ENV === 'production',
  serverPortNumber: validatedEnvironmentVariables.PORT,
  jsonWebTokenSecret: validatedEnvironmentVariables.JSON_WEB_TOKEN_SECRET,
  jsonWebTokenExpiresIn: validatedEnvironmentVariables.JSON_WEB_TOKEN_EXPIRES_IN,
  cloudinaryCredentialsEncryptionKeyAsHexadecimal: validatedEnvironmentVariables.CLOUDINARY_CREDENTIALS_ENCRYPTION_KEY,
  paystackSecretKey: validatedEnvironmentVariables.PAYSTACK_SECRET_KEY,
  frontendBaseUrl: validatedEnvironmentVariables.FRONTEND_BASE_URL.replace(/\/$/, ''),
  allowedCorsOrigins: validatedEnvironmentVariables.ALLOWED_CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  courseAccessDurationInMonths: validatedEnvironmentVariables.COURSE_ACCESS_DURATION_IN_MONTHS,
  courseAccessGracePeriodInMonths: validatedEnvironmentVariables.COURSE_ACCESS_GRACE_PERIOD_IN_MONTHS,
  scholarshipDiscountPercentage: validatedEnvironmentVariables.SCHOLARSHIP_DISCOUNT_PERCENTAGE,
  emailDelivery: {
    smtpHostName: validatedEnvironmentVariables.SMTP_HOST,
    smtpPortNumber: validatedEnvironmentVariables.SMTP_PORT,
    isSmtpConnectionSecure: validatedEnvironmentVariables.SMTP_SECURE === 'true',
    smtpUsername: validatedEnvironmentVariables.SMTP_USERNAME,
    smtpPassword: validatedEnvironmentVariables.SMTP_PASSWORD,
    senderName: validatedEnvironmentVariables.EMAIL_SENDER_NAME,
    senderEmailAddress: validatedEnvironmentVariables.EMAIL_SENDER_ADDRESS,
  },
} as const;

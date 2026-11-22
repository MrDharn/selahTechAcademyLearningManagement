# SelahTech Academy LMS

Full-stack implementation of the "Overall Architecture & End-to-End Flow" diagram.

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + plain CSS (Vite), hls.js for adaptive streaming |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 via Prisma ORM |
| Payments | Paystack (initialize, verify, signed webhook) |
| Video | Cloudinary, one account per instructor, private ("authenticated") HLS streaming |
| Packaging | Docker + docker-compose (Postgres, API, nginx-served frontend) |

## Run with Docker

```bash
cp .env.example .env          # then edit the values (see comments inside)
docker compose up --build -d
docker compose exec backend_api npx prisma db seed   # creates admin + demo accounts
```

- Web app: http://localhost:8080
- API health check: http://localhost:4000/api/health
- Seeded logins (password = the values in your `.env`):
  - Admin: `INITIAL_ADMIN_EMAIL_ADDRESS` / `INITIAL_ADMIN_PASSWORD`
  - Instructor: `instructor@selahtechacademy.com` / `DEMO_ACCOUNT_PASSWORD`
  - Student: `student@selahtechacademy.com` / `DEMO_ACCOUNT_PASSWORD`

## Run for development (hot reload)

```bash
docker compose up -d postgres_database

cd backend
cp .env.example .env
npm install
npx prisma db push          # creates the tables
npx prisma db seed
npm run dev                 # http://localhost:4000

cd ../frontend
npm install
npm run dev                 # http://localhost:5173  (proxies /api to the backend)
```

When you are ready for versioned migrations, run `npx prisma migrate dev --name init` once and change the
`command` in `docker-compose.yml` from `prisma db push` to `prisma migrate deploy`.

## How the diagram maps to the code

| Diagram box | Where it lives |
|---|---|
| Auth Middleware (Verify JWT) | `backend/src/middleware/authenticationMiddleware.ts` |
| RBAC (Student / Instructor / Admin) | `backend/src/middleware/roleBasedAccessControlMiddleware.ts` |
| Access Expiry Guard (`access_expires_at`) | `backend/src/middleware/courseAccessExpiryGuardMiddleware.ts` + `services/enrollmentAccessService.ts` |
| Cloudinary Integration (Upload & Access) | `services/cloudinaryMultiAccountService.ts`, `controllers/cloudinaryIntegrationController.ts` |
| Course Management | `controllers/courseManagementController.ts` |
| Enrollment & Payments (Paystack) | `controllers/enrollmentPaymentController.ts`, `services/paystackPaymentService.ts`, `services/paymentFulfillmentService.ts` |
| Progress Engine | `services/courseProgressService.ts`, `controllers/learningController.ts` |
| Assessment Controller (Grade & Certify) | `controllers/assessmentController.ts`, `controllers/certificateController.ts`, `services/certificateService.ts` |
| PostgreSQL tables | `backend/prisma/schema.prisma` |

## Business rules implemented

- **3 months + 1 month grace.** A successful payment sets `accessExpiresAt` (+3 months) and `gracePeriodEndsAt` (+1 month). Status is `ACTIVE`, `GRACE_PERIOD` (still watchable, with a renewal banner) or `EXPIRED` (blocked). Both durations are set in `.env`. Renewing adds time on top of any remaining paid time.
- **Sequential lessons.** Lesson N unlocks only after lesson N-1 is completed. Enforced on the server, not just hidden in the UI.
- **Completion.** A lesson with a quiz is completed by passing it (pass mark set per quiz). A lesson without a quiz is completed when the video ends or the student clicks "Mark complete".
- **Certificate.** Issued automatically when every lesson is complete; downloadable as a PDF, even after access expires.
- **Multi-account Cloudinary.** Each instructor saves their own Cloudinary credentials. The API secret is encrypted with AES-256-GCM (`CLOUDINARY_CREDENTIALS_ENCRYPTION_KEY`). Videos upload straight from the browser using a signature from the API, and are stored as `authenticated` assets, so only a signed URL issued after all guards pass can play them.
- **Payments are idempotent.** The browser callback and Paystack's webhook can both arrive; only the first one that flips `PENDING` to `SUCCESSFUL` grants access. The amount is checked against the course price.

## Landing page and scholarship program

- **Discount visibility.** The discounted price is never shown publicly: not in the header, the catalogue or on a course page. It appears only on `/scholarship` (reached from the button at the bottom of the landing page) and, to an approved applicant, on that course. That bottom button only shows while at least one course has the scholarship switched on.
- **Entry point.** `/` is now the SelahTech Academy landing page (`frontend/src/pages/LandingPage.tsx`, styles in `styles/landingPageStyles.css`). The course catalogue moved to `/courses`. The last element of the page is the **Apply for Scholarship** button.
- **Hero photo.** Put your own photo at `frontend/public/hero-background.jpg`. Until then the hero shows a blue gradient. The blue overlay keeps the text readable on any photo.
- **Scholarship price.** `SCHOLARSHIP_DISCOUNT_PERCENTAGE` in `.env` (default 50), so approved students pay half the normal price.
- **How a student gets it.** Apply at `/scholarship` (needs a student account) -> an administrator approves or rejects it under Admin -> Scholarship applications -> the student sees "Enroll with scholarship" on that course and pays the discounted amount through Paystack.
- **Instructor control.** In the course editor, each course has an "Offer in the scholarship program" switch and each module has an "In scholarship" checkbox. Scholarship students only see and stream ticked modules. The server enforces this (`NOT_INCLUDED_IN_SCHOLARSHIP`), not just the UI. Sequential unlocking and the certificate use only the included modules.
- **Upgrading.** A scholarship student can pay the full price later. They keep their progress and unlock the remaining modules. A scholarship payment never downgrades a full-price student.
- **After pulling these changes** run `npx prisma db push` (or rebuild the Docker backend, which does it on start) because the schema gained new columns and the `scholarship_applications` table.

## Course cover images

Each instructor uploads their own cover image per course (course editor -> Course details -> Upload image; JPG/PNG/WebP up to 5 MB). The browser sends it straight to that instructor's Cloudinary account using a signed ticket from the API, and the API only accepts an address inside that same Cloudinary account. Courses without an image get a unique colour tile with the course initials. The instructor must connect their Cloudinary account first (Instructor Studio -> Cloudinary).

## E-mail notifications (nodemailer)

Students get a welcome e-mail after registering and a receipt after a successful payment (also for free and scholarship enrollments). The payment e-mail is sent once per payment, even though both the browser callback and the Paystack webhook can confirm it. Sending never blocks or breaks a registration or payment: failures are only logged.

Set the `SMTP_*` and `EMAIL_SENDER_*` variables in `.env`. Leave `SMTP_HOST` empty to switch e-mail off; the backend then just logs `[email skipped ...]`. For Gmail use an App Password (Google Account -> Security -> 2-Step Verification -> App passwords), not your normal password. For testing without sending real mail, a free Mailtrap or Ethereal inbox works. New dependency: run `npm install` in `backend` (Docker does it on `--build`).

## Sign in with Google

"Continue with Google" appears on the Sign in and Sign up pages once `GOOGLE_CLIENT_ID` is set in `.env` (leave it empty to hide the button).

1. Google Cloud Console -> create/select a project -> APIs & Services -> OAuth consent screen (External; add your app name and e-mail).
2. Credentials -> Create credentials -> OAuth client ID -> **Web application**.
3. Under **Authorized JavaScript origins** add every address the site is served from, e.g. `http://localhost:8080` (Docker), `http://localhost:5173` (Vite dev) and your real domain. No redirect URI is needed.
4. Copy the client ID into `GOOGLE_CLIENT_ID` and restart the backend. (There is no client secret to store.)

How it behaves: the first Google sign-in creates a STUDENT account (and sends the welcome e-mail). If an account with the same verified e-mail already exists, Google is linked to it, including instructor and admin accounts. The backend verifies Google's token signature, expiry and audience itself, and rejects unverified Google e-mails. Google-only accounts have no password; the password form shows a hint to use the Google button. Schema change: `users.hashedPassword` is now optional and `users.googleSubjectId` was added. Run `npx prisma db push` (Docker does this on start). New dependency: `google-auth-library` (`npm install` in `backend`).

## Paystack webhook

In the Paystack dashboard (Settings, API Keys & Webhooks) set the webhook URL to
`https://YOUR-DOMAIN/api/payments/paystack-webhook`. For local testing use a tunnel such as ngrok.
The browser callback also verifies the payment, so the webhook is a safety net rather than a requirement.

## Things to know

- Cloudinary "authenticated" signed URLs are not time-limited on standard plans. Time-limited tokens need Cloudinary's token-based authentication (Enterprise). The API only hands out the URL after the access checks pass.
- Uploaded videos use the eager transformation `sp_auto/m3u8` (HLS adaptive streaming). Processing happens in the background, so a freshly uploaded video can take a minute before it plays.
- The Bunny Stream backup box is represented by the optional `backupBunnyStreamVideoId` column only. No Bunny integration is wired up.
- Lessons are ordered by creation. Drag-and-drop reordering is not built (the API already accepts `sequenceOrderNumber` on modules and lessons).
- Google/Facebook login is not included.

## API summary

```
POST /api/authentication/register | /login        GET /api/authentication/me
GET  /api/courses | /api/courses/:courseId
POST /api/payments/courses/:courseId/initialize   (body: { isScholarshipPurchase?: boolean })   GET /api/payments/verify/:reference
POST /api/payments/paystack-webhook               GET /api/payments/me | /api/payments/enrollments/me
GET  /api/learning/courses/:courseId/progress
GET  /api/learning/lessons/:lessonId/stream       (JWT -> expiry guard -> unlock guard)
PUT  /api/learning/lessons/:lessonId/watch-position
POST /api/learning/lessons/:lessonId/complete
GET  /api/learning/lessons/:lessonId/assessment   POST .../assessment/attempts
GET  /api/learning/certificates/me | /certificates/courses/:courseId/download
/api/instructor/...  (courses, modules, lessons, video upload signature, assessments, cloudinary-account)
/api/admin/...       (statistics, users, payments, scholarship-applications)
GET  /api/scholarship/courses (public)   POST /api/scholarship/applications   GET /api/scholarship/applications/me
```

## Certificate design

The certificate PDF follows the academy's printed certificate (navy and gold frame, "CERTIFICATE OF COMPLETION" banner, gold seal, signature block). The layout is in `backend/src/services/certificatePdfRenderer.ts`; the company name, RC number and signatory are at the top of that file. To use the real emblem and signature, put `certificate-logo.png` and `certificate-signature.png` in `backend/assets/` (see the README there) and rebuild the backend.

## Deleting draft courses

An instructor (own courses) or an admin (any course) can delete a course that is a **draft**: use "Delete draft" on the course card or on the course editor page. Modules, lessons, assessments and scholarship applications go with it. A published course cannot be deleted (unpublish it first), and neither can a course that already has enrollments or payments (the API answers 409). Videos and the cover image already uploaded stay in the instructor's own Cloudinary account.

## Forgot password, expiry reminders and certificate verification

- **Forgot password**: "Forgot your password?" on the sign-in page -> e-mail with a one-time link (valid 1 hour) -> `/reset-password`. Only a hash of the token is stored. The page never reveals whether an e-mail address is registered. Google-only accounts can use it to add a password. Needs SMTP (see E-mail notifications); without `SMTP_HOST` the link is not sent.
- **Background worker** (`backend/src/services/backgroundWorker.ts`): runs inside the API process, first run 20 seconds after start and then every 60 minutes. Jobs: (1) access-expiry reminders, (2) clean-up of old reset tokens. Every job is safe to run twice or on two server copies at once, so the worker can later be moved into its own process or service. No Redis is needed.
- **Access-expiry reminders**: one e-mail 7 days before paid access ends, and one 7 days before the grace period closes, each with a renew link to the course page. Each is sent once per enrollment; renewing resets them. Skipped (and not marked as sent) when `SMTP_HOST` is empty.
- **Certificate verification**: public page `/verify` and `/verify/<certificate number>` (no sign-in). It shows only the holder's name, course and date. The certificate PDF now prints "Verify this certificate at <link>" under the certificate number.

These changes add two columns to `enrollments` and a `password_reset_tokens` table: run `npx prisma db push` (Docker does it on start). Nothing is deleted.

## Settings page and certificate verification link

- **Settings** (`/settings`, click your name or picture in the header; every role): upload or remove a profile picture, edit your name and phone number, change your password (Google-only accounts can set one), and see your enrolled courses with their access status and a Renew/Open button. The picture is cropped to a square, shrunk to 256 px in the browser and stored in the database, so nobody needs a Cloudinary account for it.
- **Verify a certificate** (public, no sign-in): `/verify` (for example http://localhost:5173/verify), linked at the bottom of the landing page and on the "My certificates" page. Each certificate also has its own link, `/verify/<certificate number>`, printed on the PDF.

Needs `npx prisma db push` (adds `phoneNumber` and `profilePictureDataUrl` to users).

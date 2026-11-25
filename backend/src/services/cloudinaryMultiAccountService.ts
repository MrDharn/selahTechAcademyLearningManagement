import { v2 as cloudinaryClient } from 'cloudinary';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { decryptSensitiveText } from '../utilities/credentialEncryptionUtilities';

/**
 * Each instructor connects their OWN Cloudinary account ("Multi-Account" in the diagram).
 * We never call cloudinaryClient.config(): credentials are passed per call so accounts never leak into each other.
 */
export interface InstructorCloudinaryCredentials {
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
}

export async function getInstructorCloudinaryCredentials(instructorUserId: string): Promise<InstructorCloudinaryCredentials> {
  const storedCloudinaryAccount = await prismaDatabaseClient.instructorCloudinaryAccount.findUnique({
    where: { instructorUserId },
  });

  if (!storedCloudinaryAccount) {
    throw new ApplicationError(
      409,
      'The instructor has not connected a Cloudinary account yet.',
      'CLOUDINARY_ACCOUNT_NOT_CONNECTED',
    );
  }

  return {
    cloudinaryCloudName: storedCloudinaryAccount.cloudinaryCloudName,
    cloudinaryApiKey: storedCloudinaryAccount.cloudinaryApiKey,
    cloudinaryApiSecret: decryptSensitiveText(storedCloudinaryAccount.encryptedCloudinaryApiSecret),
  };
}

/** Asks Cloudinary to confirm the credentials work before we save them. */
export async function assertCloudinaryCredentialsAreValid(credentials: InstructorCloudinaryCredentials) {
  try {
    await cloudinaryClient.api.ping({
      cloud_name: credentials.cloudinaryCloudName,
      api_key: credentials.cloudinaryApiKey,
      api_secret: credentials.cloudinaryApiSecret,
    });
  } catch {
    throw new ApplicationError(400, 'Cloudinary rejected these credentials. Check the cloud name, API key and API secret.', 'CLOUDINARY_CREDENTIALS_INVALID');
  }
}

/**
 * The browser uploads the video straight to the instructor's Cloudinary (the API server never touches the bytes).
 * Videos are stored as type "authenticated", so a plain URL does not work - only a URL signed by our backend does.
 * The "eager" setting asks Cloudinary to prepare adaptive HLS streaming in the background.
 */
export function createSignedVideoUploadParameters(credentials: InstructorCloudinaryCredentials, destinationFolderPath: string) {
  const uploadTimestampInSeconds = Math.round(Date.now() / 1000);

  const parametersIncludedInSignature = {
    timestamp: uploadTimestampInSeconds,
    folder: destinationFolderPath,
    type: 'authenticated',
    eager: 'sp_auto/m3u8',
    eager_async: 'true',
  };

  const uploadSignature = cloudinaryClient.utils.api_sign_request(parametersIncludedInSignature, credentials.cloudinaryApiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${credentials.cloudinaryCloudName}/video/upload`,
    cloudinaryApiKey: credentials.cloudinaryApiKey,
    uploadSignature,
    signedFormFields: parametersIncludedInSignature,
  };
}

/**
 * Course cover images are public (the catalogue is visible before sign-in), so they are stored as ordinary "upload" images
 * in the course owner's Cloudinary account. Every upload reuses the public_id "thumbnail" and overwrites the previous
 * image, so replacing a cover never leaves orphaned files behind.
 */
export function createSignedCourseThumbnailUploadParameters(credentials: InstructorCloudinaryCredentials, destinationFolderPath: string) {
  const uploadTimestampInSeconds = Math.round(Date.now() / 1000);

  const parametersIncludedInSignature = {
    timestamp: uploadTimestampInSeconds,
    folder: destinationFolderPath,
    public_id: 'thumbnail',
    overwrite: 'true',
    invalidate: 'true',
    allowed_formats: 'jpg,jpeg,png,webp',
  };

  const uploadSignature = cloudinaryClient.utils.api_sign_request(parametersIncludedInSignature, credentials.cloudinaryApiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${credentials.cloudinaryCloudName}/image/upload`,
    cloudinaryApiKey: credentials.cloudinaryApiKey,
    uploadSignature,
    signedFormFields: parametersIncludedInSignature,
  };
}

/** Stops an instructor from saving an arbitrary web address as a cover image: it must live in the course owner's own Cloudinary. */
export function isImageUrlHostedOnCloudinaryAccount(imageUrl: string, cloudinaryCloudName: string): boolean {
  return imageUrl.startsWith(`https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/`);
}

/** Signed HLS (.m3u8) manifest URL for an authenticated video. Only issued after the access guards pass. */
export function createAuthorizedHlsStreamingUrl(credentials: InstructorCloudinaryCredentials, cloudinaryVideoPublicId: string): string {
  return cloudinaryClient.url(cloudinaryVideoPublicId, {
    cloud_name: credentials.cloudinaryCloudName,
    api_key: credentials.cloudinaryApiKey,
    api_secret: credentials.cloudinaryApiSecret,
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    streaming_profile: 'auto',
    format: 'm3u8',
  });
}

/**
 * Lesson files (slides, PDFs...) are uploaded as "raw" files of type "authenticated": a plain URL does not work,
 * only a URL signed by our backend does, and we only sign it for students who pass the lesson access guards.
 */
export function createSignedLessonResourceUploadParameters(credentials: InstructorCloudinaryCredentials, destinationFolderPath: string) {
  const uploadTimestampInSeconds = Math.round(Date.now() / 1000);

  const parametersIncludedInSignature = {
    timestamp: uploadTimestampInSeconds,
    folder: destinationFolderPath,
    type: 'authenticated',
    use_filename: 'true',
    unique_filename: 'true',
  };

  const uploadSignature = cloudinaryClient.utils.api_sign_request(parametersIncludedInSignature, credentials.cloudinaryApiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${credentials.cloudinaryCloudName}/raw/upload`,
    cloudinaryApiKey: credentials.cloudinaryApiKey,
    uploadSignature,
    signedFormFields: parametersIncludedInSignature,
  };
}

/** Signed download link for a private lesson file; it forces the browser to download instead of opening. */
export function createAuthorizedResourceDownloadUrl(credentials: InstructorCloudinaryCredentials, cloudinaryPublicId: string): string {
  return cloudinaryClient.url(cloudinaryPublicId, {
    cloud_name: credentials.cloudinaryCloudName,
    api_key: credentials.cloudinaryApiKey,
    api_secret: credentials.cloudinaryApiSecret,
    resource_type: 'raw',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    flags: 'attachment',
  });
}

/** Best effort: a leftover file in the instructor's own Cloudinary is harmless, so failures are ignored. */
export async function deleteLessonResourceFromCloudinary(credentials: InstructorCloudinaryCredentials, cloudinaryPublicId: string) {
  try {
    await cloudinaryClient.uploader.destroy(cloudinaryPublicId, {
      cloud_name: credentials.cloudinaryCloudName,
      api_key: credentials.cloudinaryApiKey,
      api_secret: credentials.cloudinaryApiSecret,
      resource_type: 'raw',
      type: 'authenticated',
    });
  } catch {
    /* ignore */
  }
}

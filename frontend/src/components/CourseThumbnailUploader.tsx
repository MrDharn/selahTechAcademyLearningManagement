import { useState, type ChangeEvent } from 'react';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { SignedImageUploadParameters } from '../types/applicationTypes';
import { CourseThumbnail } from './CourseThumbnail';
import { LoadingButtonContent } from './LoadingButtonContent';
import { StatusMessage } from './StatusMessage';

const MAXIMUM_COVER_IMAGE_SIZE_IN_BYTES = 5 * 1024 * 1024;
const ACCEPTED_COVER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CourseThumbnailUploaderProps {
  courseId: string;
  courseTitle: string;
  currentThumbnailImageUrl: string | null;
  onThumbnailChanged: () => void;
}

/**
 * Flow: (1) ask our API for a signed upload ticket for the course owner's Cloudinary account,
 * (2) send the image straight from the browser to Cloudinary, (3) tell our API the resulting address.
 */
export function CourseThumbnailUploader({ courseId, courseTitle, currentThumbnailImageUrl, onThumbnailChanged }: CourseThumbnailUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageFileSelected = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const selectedImageFile = changeEvent.target.files?.[0];
    changeEvent.target.value = '';
    if (!selectedImageFile) return;

    if (!ACCEPTED_COVER_IMAGE_TYPES.includes(selectedImageFile.type)) {
      setErrorMessage('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (selectedImageFile.size > MAXIMUM_COVER_IMAGE_SIZE_IN_BYTES) {
      setErrorMessage('The image is larger than 5 MB. Please choose a smaller one.');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    try {
      const signedUploadParameters = await sendApiRequest<SignedImageUploadParameters>(`/instructor/courses/${courseId}/thumbnail-upload-signature`, {
        httpMethod: 'POST',
      });

      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedImageFile);
      uploadFormData.append('api_key', signedUploadParameters.cloudinaryApiKey);
      uploadFormData.append('signature', signedUploadParameters.uploadSignature);
      Object.entries(signedUploadParameters.signedFormFields).forEach(([fieldName, fieldValue]) => uploadFormData.append(fieldName, String(fieldValue)));

      const cloudinaryResponse = await fetch(signedUploadParameters.uploadUrl, { method: 'POST', body: uploadFormData });
      const cloudinaryResponseBody = await cloudinaryResponse.json().catch(() => null);
      if (!cloudinaryResponse.ok || !cloudinaryResponseBody?.secure_url) {
        throw new Error(cloudinaryResponseBody?.error?.message ?? 'Cloudinary rejected the image upload.');
      }

      await sendApiRequest(`/instructor/courses/${courseId}/thumbnail`, { httpMethod: 'PUT', jsonBody: { thumbnailImageUrl: cloudinaryResponseBody.secure_url } });
      onThumbnailChanged();
    } catch (uploadError) {
      setErrorMessage(extractErrorMessage(uploadError));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImageClick = async () => {
    setErrorMessage(null);
    try {
      await sendApiRequest(`/instructor/courses/${courseId}/thumbnail`, { httpMethod: 'DELETE' });
      onThumbnailChanged();
    } catch (removeError) {
      setErrorMessage(extractErrorMessage(removeError));
    }
  };

  return (
    <div className="thumbnail-uploader">
      <CourseThumbnail courseTitle={courseTitle} thumbnailImageUrl={currentThumbnailImageUrl} sizeVariant="card" />
      <div className="thumbnail-uploader__controls">
        <strong>Course cover image</strong>
        <p className="muted-text">Shown in the course catalogue and on the course page. JPG, PNG or WebP, up to 5 MB. A wide image (16:9) works best.</p>
        <div className="button-row">
          <label className="button button--secondary button--small">
            <LoadingButtonContent isLoading={isUploading} loadingText="Uploading..." spinnerTone="brand">
              {currentThumbnailImageUrl ? 'Replace image' : 'Upload image'}
            </LoadingButtonContent>
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImageFileSelected} disabled={isUploading} />
          </label>
          {currentThumbnailImageUrl && (
            <button type="button" className="button button--danger button--small" onClick={handleRemoveImageClick} disabled={isUploading}>
              Remove
            </button>
          )}
        </div>
        <StatusMessage messageKind="error" messageText={errorMessage} />
      </div>
    </div>
  );
}

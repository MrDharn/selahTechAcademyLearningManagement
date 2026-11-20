import { useState, type ChangeEvent } from 'react';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { SignedVideoUploadParameters } from '../types/applicationTypes';
import { SelahTechSpinner } from './SelahTechSpinner';
import { StatusMessage } from './StatusMessage';

interface LessonVideoUploaderProps {
  lessonId: string;
  hasExistingVideo: boolean;
  onVideoUploaded: () => void;
}

interface CloudinaryUploadResponse {
  public_id: string;
  duration?: number;
}

/**
 * Flow: (1) ask our API for a signed upload ticket for THIS instructor's Cloudinary account,
 * (2) send the file straight from the browser to Cloudinary, (3) tell our API which public_id was created.
 */
export function LessonVideoUploader({ lessonId, hasExistingVideo, onVideoUploaded }: LessonVideoUploaderProps) {
  const [uploadProgressPercentage, setUploadProgressPercentage] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadFileToCloudinary = (selectedVideoFile: File, signedUploadParameters: SignedVideoUploadParameters) =>
    new Promise<CloudinaryUploadResponse>((resolveUpload, rejectUpload) => {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedVideoFile);
      uploadFormData.append('api_key', signedUploadParameters.cloudinaryApiKey);
      uploadFormData.append('signature', signedUploadParameters.uploadSignature);
      Object.entries(signedUploadParameters.signedFormFields).forEach(([fieldName, fieldValue]) => {
        uploadFormData.append(fieldName, String(fieldValue));
      });

      const uploadRequest = new XMLHttpRequest();
      uploadRequest.open('POST', signedUploadParameters.uploadUrl);

      uploadRequest.upload.onprogress = (progressEvent) => {
        if (progressEvent.lengthComputable) setUploadProgressPercentage(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      };

      uploadRequest.onload = () => {
        if (uploadRequest.status >= 200 && uploadRequest.status < 300) {
          resolveUpload(JSON.parse(uploadRequest.responseText) as CloudinaryUploadResponse);
        } else {
          let cloudinaryErrorMessage = 'Cloudinary rejected the upload.';
          try {
            cloudinaryErrorMessage = JSON.parse(uploadRequest.responseText)?.error?.message ?? cloudinaryErrorMessage;
          } catch {
            /* keep the default message */
          }
          rejectUpload(new Error(cloudinaryErrorMessage));
        }
      };
      uploadRequest.onerror = () => rejectUpload(new Error('Network error while uploading the video.'));

      uploadRequest.send(uploadFormData);
    });

  const handleVideoFileSelected = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const selectedVideoFile = changeEvent.target.files?.[0];
    if (!selectedVideoFile) return;

    setErrorMessage(null);
    setUploadProgressPercentage(0);

    try {
      const signedUploadParameters = await sendApiRequest<SignedVideoUploadParameters>(`/instructor/lessons/${lessonId}/video-upload-signature`, {
        httpMethod: 'POST',
      });

      const cloudinaryUploadResponse = await uploadFileToCloudinary(selectedVideoFile, signedUploadParameters);

      await sendApiRequest(`/instructor/lessons/${lessonId}/video`, {
        httpMethod: 'PUT',
        jsonBody: {
          cloudinaryVideoPublicId: cloudinaryUploadResponse.public_id,
          videoDurationInSeconds: cloudinaryUploadResponse.duration !== undefined ? Math.round(cloudinaryUploadResponse.duration) : null,
        },
      });

      onVideoUploaded();
    } catch (uploadError) {
      setErrorMessage(extractErrorMessage(uploadError));
    } finally {
      setUploadProgressPercentage(null);
      changeEvent.target.value = '';
    }
  };

  return (
    <div className="video-uploader">
      <label className="button button--secondary button--small">
        {hasExistingVideo ? 'Replace video' : 'Upload video'}
        <input type="file" accept="video/*" hidden onChange={handleVideoFileSelected} disabled={uploadProgressPercentage !== null} />
      </label>
      {uploadProgressPercentage !== null && (
        <span className="muted-text loading-button-content">
          <SelahTechSpinner spinnerSize="small" />
          <span>{uploadProgressPercentage}%</span>
        </span>
      )}
      <StatusMessage messageKind="error" messageText={errorMessage} />
    </div>
  );
}

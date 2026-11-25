import type { SignedVideoUploadParameters } from '../types/applicationTypes';

export interface CloudinaryUploadResult {
  public_id: string;
  bytes?: number;
}

/** Sends a file straight from the browser to Cloudinary using a ticket signed by our API. */
export function uploadFileToCloudinary(selectedFile: File, signedUploadParameters: SignedVideoUploadParameters, onProgressPercentage: (percentage: number) => void) {
  return new Promise<CloudinaryUploadResult>((resolveUpload, rejectUpload) => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', selectedFile);
    uploadFormData.append('api_key', signedUploadParameters.cloudinaryApiKey);
    uploadFormData.append('signature', signedUploadParameters.uploadSignature);
    Object.entries(signedUploadParameters.signedFormFields).forEach(([fieldName, fieldValue]) => uploadFormData.append(fieldName, String(fieldValue)));

    const uploadRequest = new XMLHttpRequest();
    uploadRequest.open('POST', signedUploadParameters.uploadUrl);
    uploadRequest.upload.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) onProgressPercentage(Math.round((progressEvent.loaded / progressEvent.total) * 100));
    };
    uploadRequest.onload = () => {
      if (uploadRequest.status >= 200 && uploadRequest.status < 300) {
        resolveUpload(JSON.parse(uploadRequest.responseText) as CloudinaryUploadResult);
        return;
      }
      let cloudinaryErrorMessage = 'Cloudinary rejected the upload.';
      try {
        cloudinaryErrorMessage = JSON.parse(uploadRequest.responseText)?.error?.message ?? cloudinaryErrorMessage;
      } catch {
        /* keep the default message */
      }
      rejectUpload(new Error(cloudinaryErrorMessage));
    };
    uploadRequest.onerror = () => rejectUpload(new Error('Network error while uploading the file.'));
    uploadRequest.send(uploadFormData);
  });
}

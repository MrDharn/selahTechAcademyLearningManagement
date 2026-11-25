import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { SelahTechSpinner } from './SelahTechSpinner';
import { StatusMessage } from './StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { LessonResourceSummary, SignedVideoUploadParameters } from '../types/applicationTypes';
import { uploadFileToCloudinary } from '../utilities/cloudinaryDirectUpload';
import { formatFileSize } from '../utilities/formattingUtilities';

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'zip', 'png', 'jpg', 'jpeg'];
const MAXIMUM_FILE_SIZE_IN_BYTES = 25 * 1024 * 1024;

/** Instructor view for one lesson: upload, list and delete downloadable files. (The server re-checks every rule.) */
export function LessonResourcesEditor({ lessonId, onResourcesChanged }: { lessonId: string; onResourcesChanged: () => void }) {
  const [resources, setResources] = useState<LessonResourceSummary[] | null>(null);
  const [uploadProgressPercentage, setUploadProgressPercentage] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    try {
      const loaded = await sendApiRequest<{ resources: LessonResourceSummary[] }>(`/instructor/lessons/${lessonId}/resources`);
      setResources(loaded.resources);
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, [lessonId]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const handleFileSelected = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = changeEvent.target.files?.[0];
    changeEvent.target.value = '';
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) return setErrorMessage(`Allowed file types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`);
    if (selectedFile.size > MAXIMUM_FILE_SIZE_IN_BYTES) return setErrorMessage('Files can be at most 25 MB.');

    setErrorMessage(null);
    setUploadProgressPercentage(0);
    try {
      const signedUploadParameters = await sendApiRequest<SignedVideoUploadParameters>(`/instructor/lessons/${lessonId}/resources/upload-signature`, { httpMethod: 'POST' });
      const uploadResult = await uploadFileToCloudinary(selectedFile, signedUploadParameters, setUploadProgressPercentage);
      await sendApiRequest(`/instructor/lessons/${lessonId}/resources`, {
        httpMethod: 'POST',
        jsonBody: {
          cloudinaryPublicId: uploadResult.public_id,
          originalFileName: selectedFile.name,
          displayName: selectedFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || selectedFile.name,
          fileSizeInBytes: selectedFile.size,
        },
      });
      await loadResources();
      onResourcesChanged();
    } catch (uploadError) {
      setErrorMessage(extractErrorMessage(uploadError));
    } finally {
      setUploadProgressPercentage(null);
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!window.confirm('Delete this file? Students will no longer be able to download it.')) return;
    try {
      await sendApiRequest(`/instructor/lessons/${lessonId}/resources/${resourceId}`, { httpMethod: 'DELETE' });
      await loadResources();
      onResourcesChanged();
    } catch (deleteError) {
      setErrorMessage(extractErrorMessage(deleteError));
    }
  };

  return (
    <div className="resource-editor">
      <StatusMessage messageKind="error" messageText={errorMessage} />
      {resources?.length === 0 && <p className="muted-text">No files yet. Add slides, notes or source code (max 25 MB each).</p>}
      <ul className="resource-list">
        {resources?.map((resource) => (
          <li key={resource.resourceId} className="resource-list__item">
            <span>
              📎 {resource.displayName} <span className="muted-text">({formatFileSize(resource.fileSizeInBytes)})</span>
            </span>
            <button type="button" className="button button--danger button--small" onClick={() => handleDelete(resource.resourceId)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <label className="button button--secondary button--small">
        Add file
        <input type="file" hidden onChange={handleFileSelected} disabled={uploadProgressPercentage !== null} accept={ALLOWED_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')} />
      </label>{' '}
      {uploadProgressPercentage !== null && (
        <span className="muted-text loading-button-content">
          <SelahTechSpinner spinnerSize="small" />
          <span>{uploadProgressPercentage}%</span>
        </span>
      )}
    </div>
  );
}

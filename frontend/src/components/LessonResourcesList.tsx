import { useEffect, useState } from 'react';
import { StatusMessage } from './StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { LessonResourceSummary } from '../types/applicationTypes';
import { formatFileSize } from '../utilities/formattingUtilities';

/** Student view: files attached to the lesson. Each download link is signed by the server just before the click. */
export function LessonResourcesList({ lessonId }: { lessonId: string }) {
  const [resources, setResources] = useState<LessonResourceSummary[]>([]);
  const [downloadingResourceId, setDownloadingResourceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setResources([]);
    sendApiRequest<{ resources: LessonResourceSummary[] }>(`/learning/lessons/${lessonId}/resources`)
      .then((loaded) => setResources(loaded.resources))
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, [lessonId]);

  const handleDownload = async (resourceId: string) => {
    setErrorMessage(null);
    setDownloadingResourceId(resourceId);
    try {
      const { downloadUrl } = await sendApiRequest<{ downloadUrl: string }>(`/learning/lessons/${lessonId}/resources/${resourceId}/download`);
      window.location.href = downloadUrl;
    } catch (downloadError) {
      setErrorMessage(extractErrorMessage(downloadError));
    } finally {
      setDownloadingResourceId(null);
    }
  };

  if (resources.length === 0 && !errorMessage) return null;

  return (
    <section className="lesson-resources">
      <h2>Lesson files</h2>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      <ul className="resource-list">
        {resources.map((resource) => (
          <li key={resource.resourceId} className="resource-list__item">
            <span>
              📎 <strong>{resource.displayName}</strong> <span className="muted-text">({formatFileSize(resource.fileSizeInBytes)})</span>
            </span>
            <button type="button" className="button button--secondary button--small" onClick={() => handleDownload(resource.resourceId)} disabled={downloadingResourceId === resource.resourceId}>
              Download
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

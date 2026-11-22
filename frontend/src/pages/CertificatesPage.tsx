import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { StatusMessage } from '../components/StatusMessage';
import { downloadAuthenticatedFile, extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CertificateSummary } from '../types/applicationTypes';
import { formatCalendarDate } from '../utilities/formattingUtilities';

export function CertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    sendApiRequest<{ certificates: CertificateSummary[] }>('/learning/certificates/me')
      .then((certificatesResponse) => setCertificates(certificatesResponse.certificates))
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, []);

  const [courseIdBeingDownloaded, setCourseIdBeingDownloaded] = useState<string | null>(null);

  const handleDownloadClick = async (certificate: CertificateSummary) => {
    setErrorMessage(null);
    setCourseIdBeingDownloaded(certificate.courseId);
    try {
      await downloadAuthenticatedFile(`/learning/certificates/courses/${certificate.courseId}/download`, `${certificate.certificateNumber}.pdf`);
    } catch (downloadError) {
      setErrorMessage(extractErrorMessage(downloadError));
    } finally {
      setCourseIdBeingDownloaded(null);
    }
  };

  return (
    <div className="page-container">
      <h1>My certificates</h1>
      <p className="muted-text">
        Anyone can check a certificate at <Link to="/verify">the verification page</Link> using its number.
      </p>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      {!certificates && !errorMessage && <LoadingIndicator />}

      {certificates?.length === 0 && (
        <div className="card centered-card">
          <p>Finish every lesson in a course to earn your certificate.</p>
          <Link to="/my-learning" className="button button--primary">
            Go to my learning
          </Link>
        </div>
      )}

      <div className="course-grid">
        {certificates?.map((certificate) => (
          <div key={certificate.certificateId} className="card certificate-card">
            <div className="certificate-card__icon">🏆</div>
            <h3>{certificate.courseTitle}</h3>
            <p className="muted-text">Issued {formatCalendarDate(certificate.issuedAt)}</p>
            <p className="monospace-text">{certificate.certificateNumber}</p>
            <Link to={`/verify/${certificate.certificateNumber}`} className="muted-text">
              Verification link
            </Link>
            <button type="button" className="button button--primary" onClick={() => handleDownloadClick(certificate)} disabled={courseIdBeingDownloaded !== null}>
              <LoadingButtonContent isLoading={courseIdBeingDownloaded === certificate.courseId} loadingText="Preparing PDF...">
                Download PDF
              </LoadingButtonContent>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

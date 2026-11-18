import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
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

  const handleDownloadClick = async (certificate: CertificateSummary) => {
    setErrorMessage(null);
    try {
      await downloadAuthenticatedFile(`/learning/certificates/courses/${certificate.courseId}/download`, `${certificate.certificateNumber}.pdf`);
    } catch (downloadError) {
      setErrorMessage(extractErrorMessage(downloadError));
    }
  };

  return (
    <div className="page-container">
      <h1>My certificates</h1>
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
            <button type="button" className="button button--primary" onClick={() => handleDownloadClick(certificate)}>
              Download PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

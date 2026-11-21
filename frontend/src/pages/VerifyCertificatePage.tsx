import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { ApiRequestError, extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';

interface VerifiedCertificate {
  isCertificateValid: true;
  certificateNumber: string;
  holderFullName: string;
  courseTitle: string;
  issuedAt: string;
  issuedBy: string;
}

/** Public page: anyone (for example an employer) can check a certificate number without signing in. */
export function VerifyCertificatePage() {
  const { certificateNumber: certificateNumberFromAddress } = useParams();
  const navigateToPage = useNavigate();

  const [certificateNumberInput, setCertificateNumberInput] = useState(certificateNumberFromAddress ?? '');
  const [verifiedCertificate, setVerifiedCertificate] = useState<VerifiedCertificate | null>(null);
  const [wasCertificateNotFound, setWasCertificateNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(Boolean(certificateNumberFromAddress));

  useEffect(() => {
    setVerifiedCertificate(null);
    setWasCertificateNotFound(false);
    setErrorMessage(null);
    if (!certificateNumberFromAddress) {
      setIsChecking(false);
      return;
    }

    let wasCheckCancelled = false;
    setIsChecking(true);
    sendApiRequest<VerifiedCertificate>(`/certificate-verification/${encodeURIComponent(certificateNumberFromAddress)}`)
      .then((certificate) => !wasCheckCancelled && setVerifiedCertificate(certificate))
      .catch((checkError) => {
        if (wasCheckCancelled) return;
        if (checkError instanceof ApiRequestError && checkError.httpStatusCode === 404) setWasCertificateNotFound(true);
        else setErrorMessage(extractErrorMessage(checkError));
      })
      .finally(() => !wasCheckCancelled && setIsChecking(false));

    return () => {
      wasCheckCancelled = true;
    };
  }, [certificateNumberFromAddress]);

  const handleFormSubmit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    const trimmedNumber = certificateNumberInput.trim();
    if (trimmedNumber) navigateToPage(`/verify/${encodeURIComponent(trimmedNumber)}`);
  };

  return (
    <div className="authentication-page">
      <div className="card authentication-card">
        <h1>Verify a certificate</h1>
        <p className="muted-text">Enter the certificate number printed at the bottom of the certificate.</p>

        <form className="form-stack" onSubmit={handleFormSubmit}>
          <label className="form-field">
            <span>Certificate number</span>
            <input value={certificateNumberInput} onChange={(changeEvent) => setCertificateNumberInput(changeEvent.target.value)} placeholder="STA-2026-XXXXXXXX" required />
          </label>
          <button type="submit" className="button button--primary button--full-width" disabled={isChecking}>
            <LoadingButtonContent isLoading={isChecking} loadingText="Checking">
              Verify
            </LoadingButtonContent>
          </button>
        </form>

        <StatusMessage messageKind="error" messageText={errorMessage} />

        {isChecking && !verifiedCertificate && <LoadingIndicator layoutVariant="section" message="Checking certificate" />}

        {verifiedCertificate && (
          <div className="verified-certificate">
            <span className="badge badge--success">Valid certificate</span>
            <p>
              <strong>{verifiedCertificate.holderFullName}</strong> successfully completed <strong>{verifiedCertificate.courseTitle}</strong> at {verifiedCertificate.issuedBy}.
            </p>
            <p className="muted-text">
              Issued on {new Date(verifiedCertificate.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })} · No. {verifiedCertificate.certificateNumber}
            </p>
          </div>
        )}

        {wasCertificateNotFound && (
          <div className="verified-certificate verified-certificate--not-found">
            <span className="badge badge--danger">Not found</span>
            <p>No certificate with the number "{certificateNumberFromAddress}" exists. Check the number and try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}

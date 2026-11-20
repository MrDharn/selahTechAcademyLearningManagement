import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CloudinaryAccountSummary } from '../types/applicationTypes';

export function InstructorCloudinarySettingsPage() {
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState('');
  const [isAlreadyConnected, setIsAlreadyConnected] = useState(false);
  const [statusKind, setStatusKind] = useState<'error' | 'success'>('success');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    sendApiRequest<CloudinaryAccountSummary>('/instructor/cloudinary-account')
      .then((accountSummary) => {
        setIsAlreadyConnected(accountSummary.isCloudinaryAccountConnected);
        setCloudinaryCloudName(accountSummary.cloudinaryCloudName ?? '');
        setCloudinaryApiKey(accountSummary.cloudinaryApiKey ?? '');
      })
      .catch((loadError) => {
        setStatusKind('error');
        setStatusText(extractErrorMessage(loadError));
      });
  }, []);

  const handleSaveSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setIsSaving(true);
    setStatusText(null);
    try {
      await sendApiRequest('/instructor/cloudinary-account', {
        httpMethod: 'PUT',
        jsonBody: { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret },
      });
      setIsAlreadyConnected(true);
      setCloudinaryApiSecret('');
      setStatusKind('success');
      setStatusText('Cloudinary account verified and saved.');
    } catch (saveError) {
      setStatusKind('error');
      setStatusText(extractErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container narrow-page">
      <Link to="/instructor" className="muted-text">
        ← Instructor studio
      </Link>
      <h1>Connect your Cloudinary account</h1>
      <p className="muted-text">
        Your lesson videos are stored in your own Cloudinary account. Find these values on the Cloudinary dashboard under Settings → API Keys. Your API secret is encrypted before it is stored and is never shown again.
      </p>

      <form className="card form-stack" onSubmit={handleSaveSubmit}>
        <StatusMessage messageKind={statusKind} messageText={statusText} />
        <label className="form-field">
          <span>Cloud name</span>
          <input value={cloudinaryCloudName} onChange={(changeEvent) => setCloudinaryCloudName(changeEvent.target.value)} required />
        </label>
        <label className="form-field">
          <span>API key</span>
          <input value={cloudinaryApiKey} onChange={(changeEvent) => setCloudinaryApiKey(changeEvent.target.value)} required />
        </label>
        <label className="form-field">
          <span>API secret {isAlreadyConnected && '(enter again to change)'}</span>
          <input type="password" value={cloudinaryApiSecret} onChange={(changeEvent) => setCloudinaryApiSecret(changeEvent.target.value)} required autoComplete="off" />
        </label>
        <button type="submit" className="button button--primary" disabled={isSaving}>
          <LoadingButtonContent isLoading={isSaving} loadingText="Verifying with Cloudinary...">
            {isAlreadyConnected ? 'Update connection' : 'Verify and save'}
          </LoadingButtonContent>
        </button>
      </form>
    </div>
  );
}

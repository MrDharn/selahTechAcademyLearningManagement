import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { PaymentFulfillmentResult } from '../types/applicationTypes';
import { formatCalendarDate } from '../utilities/formattingUtilities';

/** Paystack redirects here with ?reference=... (and ?trxref=...). We ask the backend to verify with Paystack. */
export function PaymentCallbackPage() {
  const [searchParameters] = useSearchParams();
  const paystackReference = searchParameters.get('reference') ?? searchParameters.get('trxref');

  const [fulfillmentResult, setFulfillmentResult] = useState<PaymentFulfillmentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);

  const verifyPayment = useCallback(async () => {
    if (!paystackReference) {
      setErrorMessage('No payment reference was found in this link.');
      setIsVerifying(false);
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    try {
      setFulfillmentResult(await sendApiRequest<PaymentFulfillmentResult>(`/payments/verify/${encodeURIComponent(paystackReference)}`));
    } catch (verificationError) {
      setErrorMessage(extractErrorMessage(verificationError));
    } finally {
      setIsVerifying(false);
    }
  }, [paystackReference]);

  useEffect(() => {
    void verifyPayment();
  }, [verifyPayment]);

  if (isVerifying) return <LoadingIndicator message="Confirming your payment with Paystack..." />;

  return (
    <div className="page-container narrow-page">
      <div className="card centered-card">
        <StatusMessage messageKind="error" messageText={errorMessage} />

        {fulfillmentResult?.paymentStatus === 'SUCCESSFUL' && (
          <>
            <h1>🎉 Payment successful</h1>
            <p>You now have access until {formatCalendarDate(fulfillmentResult.accessExpiresAt)}, plus a grace period until {formatCalendarDate(fulfillmentResult.gracePeriodEndsAt)}.</p>
            <Link to={`/learn/${fulfillmentResult.courseId}`} className="button button--primary">
              Start learning
            </Link>
          </>
        )}

        {fulfillmentResult?.paymentStatus === 'PENDING' && (
          <>
            <h1>Payment still processing</h1>
            <p className="muted-text">Paystack has not confirmed this payment yet. This can take a minute.</p>
            <button type="button" className="button button--primary" onClick={() => void verifyPayment()}>
              Check again
            </button>
          </>
        )}

        {fulfillmentResult?.paymentStatus === 'FAILED' && (
          <>
            <h1>Payment was not completed</h1>
            <p className="muted-text">You have not been charged for access. You can try again from the course page.</p>
            <Link to={`/courses/${fulfillmentResult.courseId}`} className="button button--primary">
              Back to course
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

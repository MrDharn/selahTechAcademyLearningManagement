import { createHmac, timingSafeEqual } from 'crypto';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { ApplicationError } from '../utilities/ApplicationError';

const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

interface PaystackApiResponse<ResponseData> {
  status: boolean;
  message: string;
  data: ResponseData;
}

export interface PaystackInitializedTransaction {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifiedTransaction {
  status: 'success' | 'failed' | 'abandoned' | 'pending' | 'ongoing' | 'reversed' | string;
  reference: string;
  amount: number; // in kobo
  currency: string;
  paid_at: string | null;
}

async function sendPaystackRequest<ResponseData>(
  requestPath: string,
  requestOptions: { method: 'GET' | 'POST'; jsonBody?: unknown },
): Promise<ResponseData> {
  const paystackHttpResponse = await fetch(`${PAYSTACK_API_BASE_URL}${requestPath}`, {
    method: requestOptions.method,
    headers: {
      Authorization: `Bearer ${environmentConfiguration.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: requestOptions.jsonBody ? JSON.stringify(requestOptions.jsonBody) : undefined,
  });

  const parsedResponseBody = (await paystackHttpResponse.json().catch(() => null)) as PaystackApiResponse<ResponseData> | null;

  if (!paystackHttpResponse.ok || !parsedResponseBody?.status) {
    throw new ApplicationError(
      502,
      parsedResponseBody?.message ?? 'Paystack could not process this request. Please try again.',
      'PAYSTACK_REQUEST_FAILED',
    );
  }

  return parsedResponseBody.data;
}

export function initializePaystackTransaction(transactionDetails: {
  customerEmailAddress: string;
  amountInKobo: number;
  paystackReference: string;
  courseId: string;
  studentUserId: string;
}): Promise<PaystackInitializedTransaction> {
  return sendPaystackRequest<PaystackInitializedTransaction>('/transaction/initialize', {
    method: 'POST',
    jsonBody: {
      email: transactionDetails.customerEmailAddress,
      amount: transactionDetails.amountInKobo,
      reference: transactionDetails.paystackReference,
      currency: 'NGN',
      callback_url: `${environmentConfiguration.frontendBaseUrl}/payment/callback`,
      metadata: { courseId: transactionDetails.courseId, studentUserId: transactionDetails.studentUserId },
    },
  });
}

export function verifyPaystackTransaction(paystackReference: string): Promise<PaystackVerifiedTransaction> {
  return sendPaystackRequest<PaystackVerifiedTransaction>(`/transaction/verify/${encodeURIComponent(paystackReference)}`, {
    method: 'GET',
  });
}

/** Paystack signs the raw webhook body with HMAC-SHA512 using your secret key (header: x-paystack-signature). */
export function isPaystackWebhookSignatureValid(rawRequestBody: Buffer | undefined, receivedSignatureHeader: string | undefined): boolean {
  if (!rawRequestBody || !receivedSignatureHeader) return false;

  const expectedSignatureHex = createHmac('sha512', environmentConfiguration.paystackSecretKey).update(rawRequestBody).digest('hex');

  const expectedSignatureBuffer = Buffer.from(expectedSignatureHex, 'utf8');
  const receivedSignatureBuffer = Buffer.from(receivedSignatureHeader, 'utf8');

  return expectedSignatureBuffer.length === receivedSignatureBuffer.length && timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer);
}

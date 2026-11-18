const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';
export const AUTHENTICATION_TOKEN_STORAGE_KEY = 'selahtech_authentication_token';

export class ApiRequestError extends Error {
  public readonly httpStatusCode: number;
  public readonly machineReadableErrorCode?: string;

  constructor(httpStatusCode: number, humanReadableMessage: string, machineReadableErrorCode?: string) {
    super(humanReadableMessage);
    this.name = 'ApiRequestError';
    this.httpStatusCode = httpStatusCode;
    this.machineReadableErrorCode = machineReadableErrorCode;
  }
}

export function readStoredAuthenticationToken(): string | null {
  try {
    return localStorage.getItem(AUTHENTICATION_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAuthenticationToken(authenticationToken: string | null) {
  try {
    if (authenticationToken) localStorage.setItem(AUTHENTICATION_TOKEN_STORAGE_KEY, authenticationToken);
    else localStorage.removeItem(AUTHENTICATION_TOKEN_STORAGE_KEY);
  } catch {
    /* storage can be unavailable (private mode); the session then lasts until reload */
  }
}

interface ApiRequestOptions {
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  jsonBody?: unknown;
}

async function buildApiRequestError(failedResponse: Response): Promise<ApiRequestError> {
  const errorBody = await failedResponse.json().catch(() => null);
  const validationIssues = errorBody?.validationIssues as { issueDescription: string }[] | undefined;
  const messageWithIssues = validationIssues?.length
    ? `${errorBody.errorMessage} ${validationIssues.map((issue) => issue.issueDescription).join('. ')}`
    : errorBody?.errorMessage;

  return new ApiRequestError(failedResponse.status, messageWithIssues ?? 'Something went wrong. Please try again.', errorBody?.errorCode);
}

export async function sendApiRequest<ResponseBody>(requestPath: string, requestOptions: ApiRequestOptions = {}): Promise<ResponseBody> {
  const storedAuthenticationToken = readStoredAuthenticationToken();

  const httpResponse = await fetch(`${API_BASE_URL}${requestPath}`, {
    method: requestOptions.httpMethod ?? 'GET',
    headers: {
      ...(requestOptions.jsonBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(storedAuthenticationToken ? { Authorization: `Bearer ${storedAuthenticationToken}` } : {}),
    },
    body: requestOptions.jsonBody !== undefined ? JSON.stringify(requestOptions.jsonBody) : undefined,
  });

  if (!httpResponse.ok) throw await buildApiRequestError(httpResponse);
  if (httpResponse.status === 204) return undefined as ResponseBody;

  return (await httpResponse.json()) as ResponseBody;
}

/** Downloads a binary file (the certificate PDF) while still sending the Bearer token. */
export async function downloadAuthenticatedFile(requestPath: string, suggestedFileName: string) {
  const storedAuthenticationToken = readStoredAuthenticationToken();

  const httpResponse = await fetch(`${API_BASE_URL}${requestPath}`, {
    headers: storedAuthenticationToken ? { Authorization: `Bearer ${storedAuthenticationToken}` } : {},
  });

  if (!httpResponse.ok) throw await buildApiRequestError(httpResponse);

  const downloadedFileBlob = await httpResponse.blob();
  const temporaryObjectUrl = URL.createObjectURL(downloadedFileBlob);
  const temporaryDownloadLink = document.createElement('a');
  temporaryDownloadLink.href = temporaryObjectUrl;
  temporaryDownloadLink.download = suggestedFileName;
  document.body.appendChild(temporaryDownloadLink);
  temporaryDownloadLink.click();
  temporaryDownloadLink.remove();
  URL.revokeObjectURL(temporaryObjectUrl);
}

export function extractErrorMessage(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : 'Something went wrong. Please try again.';
}

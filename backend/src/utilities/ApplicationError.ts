export class ApplicationError extends Error {
  public readonly httpStatusCode: number;
  public readonly machineReadableErrorCode?: string;

  constructor(httpStatusCode: number, humanReadableMessage: string, machineReadableErrorCode?: string) {
    super(humanReadableMessage);
    this.name = 'ApplicationError';
    this.httpStatusCode = httpStatusCode;
    this.machineReadableErrorCode = machineReadableErrorCode;
  }
}

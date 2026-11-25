/** Pure rules for lesson file attachments (no database or network), so they can be tested alone. */
export const MAXIMUM_RESOURCE_FILE_SIZE_IN_BYTES = 25 * 1024 * 1024;

export const ALLOWED_RESOURCE_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'zip', 'png', 'jpg', 'jpeg'];

export function getFileExtension(fileName: string): string {
  const lastDotPosition = fileName.lastIndexOf('.');
  return lastDotPosition < 0 ? '' : fileName.slice(lastDotPosition + 1).toLowerCase();
}

export type ResourceFileProblem = 'EXTENSION_NOT_ALLOWED' | 'FILE_EMPTY' | 'FILE_TOO_LARGE';

/** Returns null when the file is acceptable, otherwise the reason it is not. */
export function findProblemWithResourceFile(fileName: string, fileSizeInBytes: number): ResourceFileProblem | null {
  if (!ALLOWED_RESOURCE_FILE_EXTENSIONS.includes(getFileExtension(fileName))) return 'EXTENSION_NOT_ALLOWED';
  if (fileSizeInBytes <= 0) return 'FILE_EMPTY';
  if (fileSizeInBytes > MAXIMUM_RESOURCE_FILE_SIZE_IN_BYTES) return 'FILE_TOO_LARGE';
  return null;
}

export function describeResourceFileProblem(problem: ResourceFileProblem): string {
  switch (problem) {
    case 'EXTENSION_NOT_ALLOWED':
      return `Allowed file types: ${ALLOWED_RESOURCE_FILE_EXTENSIONS.join(', ')}.`;
    case 'FILE_EMPTY':
      return 'This file is empty.';
    default:
      return `Files can be at most ${MAXIMUM_RESOURCE_FILE_SIZE_IN_BYTES / (1024 * 1024)} MB.`;
  }
}

/** "Week 1 slides.pdf" -> "Week 1 slides" (shown as the default display name). */
export function buildDefaultDisplayName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return withoutExtension || fileName;
}

/** The folder every resource of a lesson is uploaded into. Registering a file from anywhere else is refused. */
export function buildLessonResourceFolderPath(courseId: string, lessonId: string): string {
  return `selahtech-academy/courses/${courseId}/lessons/${lessonId}/resources`;
}

export function isPublicIdInsideFolder(cloudinaryPublicId: string, folderPath: string): boolean {
  return cloudinaryPublicId.startsWith(`${folderPath}/`) && !cloudinaryPublicId.includes('..');
}

export function formatFileSize(fileSizeInBytes: number): string {
  if (fileSizeInBytes < 1024) return `${fileSizeInBytes} B`;
  if (fileSizeInBytes < 1024 * 1024) return `${Math.round(fileSizeInBytes / 1024)} KB`;
  return `${(fileSizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

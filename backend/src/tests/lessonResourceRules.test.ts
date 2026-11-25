import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAXIMUM_RESOURCE_FILE_SIZE_IN_BYTES,
  buildDefaultDisplayName,
  buildLessonResourceFolderPath,
  findProblemWithResourceFile,
  formatFileSize,
  getFileExtension,
  isPublicIdInsideFolder,
} from '../rules/lessonResourceRules';

describe('lesson resource file rules', () => {
  it('reads extensions case-insensitively', () => {
    assert.equal(getFileExtension('Notes.PDF'), 'pdf');
    assert.equal(getFileExtension('README'), '');
  });
  it('accepts normal files and rejects bad ones', () => {
    assert.equal(findProblemWithResourceFile('slides.pptx', 1000), null);
    assert.equal(findProblemWithResourceFile('virus.exe', 1000), 'EXTENSION_NOT_ALLOWED');
    assert.equal(findProblemWithResourceFile('empty.pdf', 0), 'FILE_EMPTY');
    assert.equal(findProblemWithResourceFile('big.zip', MAXIMUM_RESOURCE_FILE_SIZE_IN_BYTES + 1), 'FILE_TOO_LARGE');
    assert.equal(findProblemWithResourceFile('limit.zip', MAXIMUM_RESOURCE_FILE_SIZE_IN_BYTES), null);
  });
  it('builds a readable default name', () => {
    assert.equal(buildDefaultDisplayName('week_1-slides.pdf'), 'week 1 slides');
  });
  it('only accepts public ids from the lesson folder', () => {
    const folder = buildLessonResourceFolderPath('c1', 'l1');
    assert.equal(isPublicIdInsideFolder(`${folder}/notes_abc.pdf`, folder), true);
    assert.equal(isPublicIdInsideFolder('selahtech-academy/courses/c2/lessons/l9/resources/x.pdf', folder), false);
    assert.equal(isPublicIdInsideFolder(`${folder}/../x.pdf`, folder), false);
  });
  it('formats sizes', () => {
    assert.equal(formatFileSize(500), '500 B');
    assert.equal(formatFileSize(2048), '2 KB');
    assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB');
  });
});

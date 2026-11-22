const MAXIMUM_DATA_URL_LENGTH = 150_000;

function loadImageFromFile(imageFile: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const temporaryObjectUrl = URL.createObjectURL(imageFile);
    const loadedImage = new Image();
    loadedImage.onload = () => {
      URL.revokeObjectURL(temporaryObjectUrl);
      resolve(loadedImage);
    };
    loadedImage.onerror = () => {
      URL.revokeObjectURL(temporaryObjectUrl);
      reject(new Error('That file could not be read as an image.'));
    };
    loadedImage.src = temporaryObjectUrl;
  });
}

/**
 * Crops the picture to a centred square, shrinks it to squareSizeInPixels and returns a JPEG data URL small enough
 * to store in the database (lowering the quality step by step if needed).
 */
export async function resizeImageFileToSquareJpegDataUrl(imageFile: File, squareSizeInPixels = 256): Promise<string> {
  if (!imageFile.type.startsWith('image/')) throw new Error('Please choose an image file (JPEG, PNG or WebP).');

  const sourceImage = await loadImageFromFile(imageFile);
  const shortestSide = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight);
  const cropStartX = (sourceImage.naturalWidth - shortestSide) / 2;
  const cropStartY = (sourceImage.naturalHeight - shortestSide) / 2;

  const drawingCanvas = document.createElement('canvas');
  drawingCanvas.width = squareSizeInPixels;
  drawingCanvas.height = squareSizeInPixels;
  const drawingContext = drawingCanvas.getContext('2d');
  if (!drawingContext) throw new Error('Your browser cannot resize pictures.');
  drawingContext.drawImage(sourceImage, cropStartX, cropStartY, shortestSide, shortestSide, 0, 0, squareSizeInPixels, squareSizeInPixels);

  for (const jpegQuality of [0.85, 0.7, 0.55, 0.4]) {
    const resizedDataUrl = drawingCanvas.toDataURL('image/jpeg', jpegQuality);
    if (resizedDataUrl.length <= MAXIMUM_DATA_URL_LENGTH) return resizedDataUrl;
  }
  throw new Error('That picture is too detailed. Please choose a simpler one.');
}

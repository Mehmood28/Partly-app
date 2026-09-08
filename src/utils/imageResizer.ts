/**
 * Unified Client-Side Image Compressor
 * Downscales images to max 900px (width or height, maintaining aspect ratio)
 * and encodes to JPEG format at 0.75 quality (~50KB-80KB per photo).
 */
export const resizeImage = (
  file: File, 
  maxWidth: number = 900, 
  maxHeight: number = 900, 
  quality: number = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }

        // Draw and compress as JPEG
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const compressBuildImage = (file: File): Promise<string> => {
  return resizeImage(file, 900, 900, 0.75);
};


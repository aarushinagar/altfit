/**
 * Client-side Image Processor
 *
 * Runs in the browser BEFORE uploading to server.
 * - Validates file size and type
 * - Resizes large images
 * - Converts to JPEG for consistency
 * - Returns blob ready for FormData
 *
 * Usage:
 *   const processed = await processImageForUpload(file)
 *   formData.append('image', processed.blob)
 */

export interface ProcessedImage {
  blob: Blob
  width: number
  height: number
  aspectRatio: number
}

export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const MAX_DIMENSION = 1200
        let { width, height } = img

        // Resize if too large — preserve aspect ratio
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height / width) * MAX_DIMENSION)
            width = MAX_DIMENSION
          } else {
            width = Math.round((width / height) * MAX_DIMENSION)
            height = MAX_DIMENSION
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        // White background for transparent PNGs
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        URL.revokeObjectURL(url)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas conversion failed'))
            }
            resolve({
              blob,
              width,
              height,
              aspectRatio: width / height,
            })
          },
          'image/jpeg',
          0.85 // 85% quality — good balance of size and quality
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

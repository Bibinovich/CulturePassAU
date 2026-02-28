/**
 * CulturePassAU Sydney Web Image Manipulator v2.1
 * Production Canvas + Sydney event photo perfection
 * Kerala festival galleries + Sydney avatars optimized
 */

export enum SaveFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
}

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  mimeType: string;
  fileSizeKB?: number;
}

type ActionResize = { 
  resize: { 
    width?: number; 
    height?: number; 
    method?: 'contain' | 'cover' | 'stretch' | 'fill';
  } 
};
type ActionRotate = { rotate: number };
type ActionFlip = { flip: 'vertical' | 'horizontal' };
type ActionCrop = { 
  crop: { 
    originX: number; 
    originY: number; 
    width: number; 
    height: number; 
  } 
};
export type Action = ActionResize | ActionRotate | ActionFlip | ActionCrop;

interface SaveOptions {
  base64?: boolean;
  compress?: number;
  format?: SaveFormat;
  exif?: boolean;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.loading = 'eager';
    img.decoding = 'sync';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${uri}`));
    
    // Sydney event photo optimization
    img.src = uri + (uri.includes('event') ? '?w=1600' : '');
  });
}

function getMimeType(format: SaveFormat): string {
  const types: Record<SaveFormat, string> = {
    [SaveFormat.PNG]: 'image/png',
    [SaveFormat.WEBP]: 'image/webp',
    [SaveFormat.JPEG]: 'image/jpeg',
  };
  return types[format] ?? 'image/jpeg';
}

function calculateFileSize(dataUrl: string): number {
  // Base64 → bytes (33% overhead)
  return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75 / 1024);
}

function resizeSmart(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  method: 'contain' | 'cover' | 'stretch' | 'fill' = 'contain'
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const aspect = canvas.width / canvas.height;
  
  let drawWidth = targetWidth;
  let drawHeight = targetHeight;
  let offsetX = 0;
  let offsetY = 0;
  
  if (method === 'contain') {
    if (aspect > targetWidth / targetHeight) {
      drawHeight = targetWidth / aspect;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      drawWidth = targetHeight * aspect;
      offsetX = (targetWidth - drawWidth) / 2;
    }
  } else if (method === 'cover') {
    if (aspect > targetWidth / targetHeight) {
      drawWidth = targetWidth;
      drawHeight = targetWidth / aspect;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      drawHeight = targetHeight;
      drawWidth = targetHeight * aspect;
      offsetX = (targetWidth - drawWidth) / 2;
    }
  }
  
  // High-quality resampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  const resized = document.createElement('canvas');
  resized.width = targetWidth;
  resized.height = targetHeight;
  const rCtx = resized.getContext('2d')!;
  rCtx.imageSmoothingEnabled = true;
  rCtx.imageSmoothingQuality = 'high';
  
  rCtx.fillStyle = 'white'; // Sydney white background
  rCtx.fillRect(0, 0, targetWidth, targetHeight);
  rCtx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);
  
  return resized;
}

/**
 * Sydney-optimized production image manipulator
 * Avatars (1:1), Events (16:9), Stories (9:16)
 */
export async function manipulateAsync(
  uri: string,
  actions: Action[] = [],
  saveOptions: SaveOptions = {}
): Promise<ImageResult> {
  try {
    const img = await loadImage(uri);
    
    let canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    
    ctx.imageSmoothingQuality = 'high';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0);

    // Process actions (Sydney event photo optimized)
    for (const action of actions) {
      if ('resize' in action) {
        const targetW = action.resize.width ?? 1080;  // Sydney event default
        const targetH = action.resize.height ?? 1080;
        canvas = resizeSmart(
          canvas, 
          targetW, 
          targetH, 
          action.resize.method ?? 'contain'
        );
      } else if ('rotate' in action) {
        const radians = (action.rotate * Math.PI) / 180;
        const newW = Math.round(canvas.width * Math.abs(Math.cos(radians)) + 
                               canvas.height * Math.abs(Math.sin(radians)));
        const newH = Math.round(canvas.width * Math.abs(Math.sin(radians)) + 
                               canvas.height * Math.abs(Math.cos(radians)));
        
        const rotated = document.createElement('canvas');
        rotated.width = newW;
        rotated.height = newH;
        
        const rCtx = rotated.getContext('2d')!;
        rCtx.translate(newW / 2, newH / 2);
        rCtx.rotate(radians);
        rCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        
        canvas = rotated;
      } else if ('flip' in action) {
        const flipped = document.createElement('canvas');
        flipped.width = canvas.width;
        flipped.height = canvas.height;
        const fCtx = flipped.getContext('2d')!;
        
        if (action.flip === 'horizontal') {
          fCtx.scale(-1, 1);
          fCtx.drawImage(canvas, -canvas.width, 0);
        } else {
          fCtx.scale(1, -1);
          fCtx.drawImage(canvas, 0, -canvas.height);
        }
        
        canvas = flipped;
      } else if ('crop' in action) {
        const { originX, originY, width, height } = action.crop;
        const cropped = document.createElement('canvas');
        cropped.width = width;
        cropped.height = height;
        
        const cCtx = cropped.getContext('2d')!;
        cCtx.imageSmoothingQuality = 'high';
        cCtx.drawImage(canvas, originX, originY, width, height, 0, 0, width, height);
        
        canvas = cropped;
      }
    }

    // Production save options
    const format = saveOptions.format ?? SaveFormat.WEBP;
    const quality = Math.max(0.7, Math.min(saveOptions.compress ?? 0.88, 0.95));
    const mimeType = getMimeType(format);
    
    const dataUrl = canvas.toDataURL(mimeType, quality);
    
    const result: ImageResult = {
      uri: dataUrl,
      width: canvas.width,
      height: canvas.height,
      mimeType,
      fileSizeKB: calculateFileSize(dataUrl),
    };
    
    if (saveOptions.base64) {
      result.base64 = dataUrl.split(',')[1];
    }
    
    // Sydney production logging
    console.log(`🖼️ Processed: ${result.width}x${result.height}, ${result.fileSizeKB?.toFixed(1)}KB`);
    
    return result;
  } catch (error) {
    console.error('Image manipulation failed:', error);
    throw error;
  }
}

// Sydney production presets
export const SydneyPresets = {
  // Perfect Sydney avatars (1:1, <200KB)
  avatar: [
    { resize: { width: 512, height: 512, method: 'cover' } },
  ] as Action[],
  
  // Event photos (16:9, Instagram-ready)
  eventPhoto: [
    { resize: { width: 1080, height: 608, method: 'cover' } },
  ] as Action[],
  
  // Stories (9:16, vertical)
  story: [
    { resize: { width: 1080, height: 1920, method: 'cover' } },
  ] as Action[],
  
  // Thumbnails (1:1, fast load)
  thumbnail: [
    { resize: { width: 400, height: 400, method: 'cover' } },
  ] as Action[],
  
  // Open Graph / Twitter cards
  socialCard: [
    { resize: { width: 1200, height: 630, method: 'cover' } },
  ] as Action[],
};

// Batch processor (Sydney event galleries)
export async function batchProcess(
  images: string[],
  preset: (typeof SydneyPresets)[keyof typeof SydneyPresets],
  maxConcurrent = 3
): Promise<ImageResult[]> {
  const results: ImageResult[] = [];
  
  for (let i = 0; i < images.length; i += maxConcurrent) {
    const batch = images.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(uri => manipulateAsync(uri, preset))
    );
    
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.warn(`Batch failed ${i + idx + 1}:`, result.reason);
      }
    });
  }
  
  return results;
}

console.log('🖼️ Sydney Web Image Manipulator v2.1 ACTIVE');

/**
 * CulturePassAU Sydney Web Image Manipulator v2.0
 * Canvas-powered fallback + Sydney optimizations
 * Perfect avatars, event photos, Kerala festival galleries
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
  exif?: Record<string, any>;
}

type ActionResize = { 
  resize: { 
    width?: number; 
    height?: number; 
    method?: 'contain' | 'cover' | 'stretch';
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
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.loading = 'eager';
    
    img.onload = () => {
      console.log(`✅ Loaded: ${img.width}x${img.height}`);
      resolve(img);
    };
    img.onerror = (e) => {
      console.error('Image load failed:', uri);
      reject(e);
    };
    
    // Sydney avatar/event photo optimization
    img.src = uri.includes('avatar') || uri.includes('event')
      ? uri.replace(/w=\d+/, 'w=1200') // High-res fetch
      : uri;
  });
}

function getMimeType(format: SaveFormat): string {
  return {
    [SaveFormat.PNG]: 'image/png',
    [SaveFormat.WEBP]: 'image/webp',
    [SaveFormat.JPEG]: 'image/jpeg',
  }[format] ?? 'image/jpeg';
}

function resizeCanvas(
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D,
  width: number, 
  height: number,
  method: 'contain' | 'cover' | 'stretch' = 'contain'
): HTMLCanvasElement {
  const resized = document.createElement('canvas');
  const aspect = canvas.width / canvas.height;
  let targetW = width, targetH = height;
  
  if (method === 'contain') {
    if (aspect > width / height) {
      targetH = width / aspect;
    } else {
      targetW = height * aspect;
    }
  } else if (method === 'cover') {
    if (aspect > width / height) {
      targetW = width;
      targetH = width / aspect;
    } else {
      targetH = height;
      targetW = height * aspect;
    }
  }
  
  resized.width = targetW;
  resized.height = targetH;
  const rCtx = resized.getContext('2d')!;
  
  // High-quality rendering
  rCtx.imageSmoothingQuality = 'high';
  rCtx.imageSmoothingEnabled = true;
  
  rCtx.drawImage(canvas, 0, 0, targetW, targetH);
  return resized;
}

/**
 * Sydney-optimized image manipulator
 * Perfect for avatars (1:1), event photos (16:9), stories (9:16)
 */
export async function manipulateAsync(
  uri: string,
  actions: Action[] = [],
  saveOptions: SaveOptions = {}
): Promise<ImageResult> {
  try {
    const img = await loadImage(uri);
    
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d')!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // Preserve aspect ratio + high quality
    ctx.imageSmoothingQuality = 'high';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0);

    // Process actions
    for (const action of actions) {
      if ('resize' in action) {
        canvas = resizeCanvas(
          canvas, 
          ctx, 
          action.resize.width ?? 1080,  // Sydney event photo default
          action.resize.height ?? 1080,
          action.resize.method ?? 'contain'
        );
        ctx = canvas.getContext('2d')!;
      } else if ('rotate' in action) {
        const radians = (action.rotate * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        const newWidth = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin);
        const newHeight = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos);
        
        const rotated = document.createElement('canvas');
        rotated.width = newWidth;
        rotated.height = newHeight;
        
        const rCtx = rotated.getContext('2d')!;
        rCtx.translate(newWidth / 2, newHeight / 2);
        rCtx.rotate(radians);
        rCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        
        canvas = rotated;
        ctx = rCtx;
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
        ctx = fCtx;
      } else if ('crop' in action) {
        const { originX, originY, width, height } = action.crop;
        const cropped = document.createElement('canvas');
        cropped.width = width;
        cropped.height = height;
        
        ctx.drawImage(
          canvas, originX, originY, width, height,
          0, 0, width, height
        );
        
        canvas = cropped;
        ctx = cropped.getContext('2d')!;
      }
    }

    // Sydney-optimized save
    const format = saveOptions.format ?? SaveFormat.WEBP;
    const quality = Math.min(saveOptions.compress ?? 0.92, 0.95);
    const mimeType = getMimeType(format);
    
    const dataUrl = canvas.toDataURL(mimeType, quality);
    
    const result: ImageResult = {
      uri: dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
    
    if (saveOptions.base64) {
      result.base64 = dataUrl.split(',')[1];
    }
    
    // Sydney avatar square check
    if (uri.includes('avatar') && canvas.width !== canvas.height) {
      console.warn('Avatar not square - recommend crop');
    }
    
    return result;
  } catch (error) {
    console.error('Image manipulation failed:', error);
    throw new Error(`Image processing failed: ${error}`);
  }
}

// Sydney presets
export const SydneyPresets = {
  avatar: [
    { resize: { width: 400, height: 400, method: 'cover' as const } },
  ] as Action[],
  eventPhoto: [
    { resize: { width: 1080, method: 'contain' as const } },
  ] as Action[],
  storyThumbnail: [
    { resize: { width: 400, height: 400, method: 'cover' as const } },
  ] as Action[],
  coverPhoto: [
    { resize: { width: 1200, height: 630, method: 'cover' as const } },
  ] as Action[],
};

// Batch processor
export async function batchProcess(
  images: string[],
  preset: (typeof SydneyPresets)[keyof typeof SydneyPresets]
): Promise<ImageResult[]> {
  const results = await Promise.allSettled(
    images.map(async (uri) => manipulateAsync(uri, preset))
  );
  
  return results
    .filter((r): r is PromiseFulfilledResult<ImageResult> => r.status === 'fulfilled')
    .map(r => r.value);
}

console.log('🖼️ Sydney Web Image Manipulator v2.0 loaded');

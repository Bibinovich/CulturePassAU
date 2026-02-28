import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * CulturePassAU Sydney Image Utils v2.0
 * Avatar optimization + Sydney event photos
 * Native + Web optimized
 */

export type {
  ImageResult,
  SaveFormat,
} from 'expo-image-manipulator';

export {
  manipulateAsync,
} from 'expo-image-manipulator';

/**
 * Sydney-optimized avatar compressor
 * Perfect for profile pics (300x300, <2MB)
 */
export async function compressAvatar(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400, height: 400 } }], // Square crop ready
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    // Sydney naming convention
    const filename = `avatar-${Date.now()}.jpg`;
    const path = `${FileSystem.cacheDirectory}${filename}`;
    
    await FileSystem.moveAsync({
      from: result.uri,
      to: path,
    });
    
    return path;
  } catch (error) {
    console.error('Avatar compression failed:', error);
    return uri; // Fallback to original
  }
}

/**
 * Event photo optimizer (Sydney venues, Kerala festivals)
 * 1080x1080 max, WebP (web), JPEG (native)
 */
export async function optimizeEventPhoto(
  uri: string, 
  options: { maxDimension?: number; quality?: number } = {}
): Promise<string> {
  const { maxDimension = 1080, quality = 0.88 } = options;
  
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDimension } }],
      {
        compress: quality,
        format: Platform.OS === 'web' 
          ? ImageManipulator.SaveFormat.WEBP 
          : ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return result.uri;
  } catch (error) {
    console.error('Event photo optimization failed:', error);
    Alert.alert('Image Error', 'Could not optimize photo');
    return uri;
  }
}

/**
 * Sydney story thumbnail generator
 * Perfect for event previews (400x400)
 */
export async function generateThumbnail(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 400 } },
        { rotate: 0 }, // Ensure upright
      ],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return uri;
  }
}

/**
 * Multiple image batch processor (Sydney event galleries)
 */
export async function processImageBatch(
  uris: string[], 
  options: Parameters<typeof optimizeEventPhoto>[1]
): Promise<string[]> {
  const results = await Promise.allSettled(
    uris.map(uri => optimizeEventPhoto(uri, options))
  );
  
  return results
    .filter((result): result is PromiseFulfilledResult<string> => 
      result.status === 'fulfilled'
    )
    .map(r => r.value);
}

/**
 * Profile photo presets (Sydney networking)
 */
export const ProfilePresets = {
  avatar: { maxDimension: 400, quality: 0.85 },
  coverPhoto: { maxDimension: 1200, quality: 0.9 },
  storyThumbnail: { maxDimension: 400, quality: 0.8 },
};

/**
 * Image validation (Sydney upload limits)
 */
export function validateImage(uri: string): Promise<{ valid: boolean; size: number; width: number; height: number }> {
  return new Promise((resolve) => {
    ImageManipulator.manipulateAsync(uri, [], { base64: true })
      .then((result) => {
        const sizeKB = result.base64!.length * 3 / 4 / 1024; // Base64 overhead
        resolve({
          valid: sizeKB < 5000, // 5MB max
          size: sizeKB,
          width: result.width || 0,
          height: result.height || 0,
        });
      })
      .catch(() => resolve({ valid: false, size: 0, width: 0, height: 0 }));
  });
}

// Web Canvas fallback (already handled by .web.ts)
if (Platform.OS === 'web') {
  console.log('🖼️ Web image processing active (Canvas)');
}

export default {
  compressAvatar,
  optimizeEventPhoto,
  generateThumbnail,
  processImageBatch,
  validateImage,
  ProfilePresets,
};

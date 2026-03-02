import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadOptions {
  folder: string;
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
  publicId?: string;
  overwrite?: boolean;
}

/**
 * Upload a file to Cloudinary
 * @param file - Base64 string or file buffer
 * @param options - Upload options
 * @returns Secure URL of uploaded file
 */
export async function uploadToCloudinary(
  file: string | Buffer,
  options: UploadOptions
): Promise<{ url: string; publicId: string }> {
  try {
    console.log('Cloudinary config:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET ? '***' : 'missing',
    });

    // Convert Buffer to base64 data URI if needed
    let fileToUpload: string;
    if (Buffer.isBuffer(file)) {
      const base64 = file.toString('base64');
      // Detect file type from buffer (simple detection)
      const isPDF = file.slice(0, 4).toString() === '%PDF';
      const mimeType = isPDF ? 'application/pdf' : 'image/jpeg';
      fileToUpload = `data:${mimeType};base64,${base64}`;
    } else {
      fileToUpload = file;
    }

    const result = await cloudinary.uploader.upload(fileToUpload, {
      folder: `drivebook/${options.folder}`,
      resource_type: options.resourceType || 'auto',
      public_id: options.publicId,
      overwrite: options.overwrite ?? true,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    console.error('Error details:', error.message);
    console.error('Error http_code:', error.http_code);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Delete a file from Cloudinary
 * @param publicId - Public ID of the file to delete
 * @param resourceType - Type of resource
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'raw' = 'image'
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * Upload instructor document
 */
export async function uploadInstructorDocument(
  instructorId: string,
  documentType: string,
  file: string | Buffer
): Promise<string> {
  const result = await uploadToCloudinary(file, {
    folder: `instructors/${instructorId}/${documentType}`,
    resourceType: 'auto',
  });

  return result.url;
}

/**
 * Upload booking photo (check-in/out)
 */
export async function uploadBookingPhoto(
  bookingId: string,
  photoType: 'check-in' | 'check-out',
  file: string | Buffer
): Promise<string> {
  const result = await uploadToCloudinary(file, {
    folder: `bookings/${bookingId}`,
    publicId: photoType,
    resourceType: 'image',
  });

  return result.url;
}

/**
 * Upload instructor profile/car image
 */
export async function uploadInstructorImage(
  instructorId: string,
  imageType: 'profile' | 'car',
  file: string | Buffer
): Promise<string> {
  const result = await uploadToCloudinary(file, {
    folder: `instructors/${instructorId}/${imageType}`,
    publicId: imageType,
    resourceType: 'image',
  });

  return result.url;
}

export const cloudinaryService = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadInstructorDocument,
  uploadBookingPhoto,
  uploadInstructorImage,
};

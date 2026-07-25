/**
 * Cloudinary service
 *
 * Folder structure:
 *   drivebook/
 *   ├── public/
 *   │   ├── avatars/        — profile + car photos (public URLs OK)
 *   │   ├── logos/          — brand logos (public URLs OK)
 *   │   └── marketing/      — marketing assets (public URLs OK)
 *   └── private/
 *       └── instructors/
 *           └── {instructorId}/
 *               ├── driver-licence/
 *               ├── instructor-authority/
 *               ├── wwcc/
 *               ├── insurance/
 *               ├── vehicle-registration/
 *               ├── vehicle-inspection/
 *               └── identity/
 *
 * Private documents must never expose permanent Cloudinary URLs to the frontend.
 * Use generateSignedUrl() to produce a short-lived URL for admin/instructor access.
 */

import { v2 as cloudinary } from 'cloudinary';

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

export interface UploadResult {
  url: string;       // permanent URL (public assets only — do NOT store for private docs)
  publicId: string;  // always store this in DB — used to generate signed URLs
}

/**
 * Upload a file to Cloudinary.
 * Returns both the permanent URL and the publicId.
 * For private documents: store only the publicId in DB, never the URL.
 */
export async function uploadToCloudinary(
  file: string | Buffer,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    // Convert Buffer to base64 data URI if needed
    let fileToUpload: string;
    if (Buffer.isBuffer(file)) {
      const base64 = file.toString('base64');
      const isPDF = file[0] === 0x25 && file[1] === 0x50 && file[2] === 0x44 && file[3] === 0x46; // %PDF
      const mimeType = isPDF ? 'application/pdf' : 'image/jpeg';
      fileToUpload = `data:${mimeType};base64,${base64}`;
    } else {
      fileToUpload = file;
    }

    const result = await cloudinary.uploader.upload(fileToUpload, {
      folder: `drivebook/${options.folder}`,
      resource_type: options.resourceType || 'auto',
      public_id: options.publicId,
      overwrite: options.overwrite ?? false, // default to no overwrite — preserves old versions
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    console.error('Cloudinary upload error:', error?.message ?? error);
    throw new Error(`Failed to upload file: ${error?.message ?? 'unknown error'}`);
  }
}

/**
 * Generate a short-lived signed URL for a private document.
 * Expires in 5 minutes by default.
 *
 * Usage:
 *   const url = await generateSignedUrl('drivebook/private/instructors/123/driver-licence/v1')
 *   // Return this URL to the authenticated admin/instructor — do NOT cache or store it.
 */
export async function generateSignedUrl(
  publicId: string,
  expiresInSeconds = 300 // 5 minutes
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.url(publicId, {
    sign_url: true,
    expires_at: expiresAt,
    secure: true,
    resource_type: 'auto',
  });
}

/**
 * Delete a file from Cloudinary by publicId.
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'raw' = 'image'
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file');
  }
}

// ── Typed upload helpers ──────────────────────────────────────────────────────

/** Map document type names to their Cloudinary subfolder paths */
const DOCUMENT_FOLDER_MAP: Record<string, string> = {
  licenseImageFront:      'driver-licence',
  licenseImageBack:       'driver-licence',
  insurancePolicyDoc:     'insurance',
  policeCheckDoc:         'identity',
  wwcCheckDoc:            'wwcc',
  photoIdDoc:             'identity',
  certificationDoc:       'instructor-authority',
  vehicleRegistrationDoc: 'vehicle-registration',
};

/**
 * Upload a compliance document to the private folder.
 * Returns publicId — store this in DB, not the URL.
 */
export async function uploadInstructorDocument(
  instructorId: string,
  documentType: string,
  file: string | Buffer
): Promise<{ url: string; publicId: string }> {
  const subfolder = DOCUMENT_FOLDER_MAP[documentType] ?? documentType;
  return uploadToCloudinary(file, {
    folder: `private/instructors/${instructorId}/${subfolder}`,
    resourceType: 'auto',
    overwrite: false, // preserve previous version until approved
  });
}

/**
 * Upload a profile or car photo to the public avatars folder.
 * These are publicly accessible — storing the URL is fine.
 */
export async function uploadInstructorImage(
  instructorId: string,
  imageType: 'profile' | 'car',
  file: string | Buffer
): Promise<UploadResult> {
  return uploadToCloudinary(file, {
    folder: `public/avatars`,
    publicId: `instructor-${instructorId}-${imageType}`,
    resourceType: 'image',
    overwrite: true, // profile + car photos: replacing is intentional
  });
}

/**
 * Upload a booking photo (check-in/check-out).
 */
export async function uploadBookingPhoto(
  bookingId: string,
  photoType: 'check-in' | 'check-out',
  file: string | Buffer
): Promise<UploadResult> {
  return uploadToCloudinary(file, {
    folder: `public/bookings/${bookingId}`,
    publicId: photoType,
    resourceType: 'image',
    overwrite: true,
  });
}

export const cloudinaryService = {
  uploadToCloudinary,
  uploadInstructorDocument,
  uploadInstructorImage,
  uploadBookingPhoto,
  deleteFromCloudinary,
  generateSignedUrl,
};

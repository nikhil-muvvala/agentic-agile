import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
dotenv.config();

// Configure Cloudinary with the credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure the storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith('image/');
    const extension = file.originalname.split('.').pop();
    const baseName = file.originalname.substring(0, file.originalname.lastIndexOf('.')) || file.originalname;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

    return {
      folder: 'project_camp_attachments',
      resource_type: isImage ? 'image' : 'raw',
      // For images, we can let cloudinary auto-assign format/public_id.
      // For raw documents (like PDFs), we must explicitly attach the extension to public_id
      // because passing `format` explicitly corrupts raw files.
      public_id: isImage ? undefined : `${baseName}-${uniqueSuffix}.${extension}`
    };
  },
});

export const upload = multer({ storage: storage });
export { cloudinary };

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function run() {
  try {
    const result = await cloudinary.uploader.upload('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', {
      folder: 'project_camp_attachments',
      resource_type: 'raw',
      public_id: 'test_dummy_pdf_with_extension.pdf' // Explicitly adding extension to public_id
    });
    console.log("UPLOAD SUCCESS:", result.secure_url);
    
    // Now fetch it and verify magic bytes
    const res = await fetch(result.secure_url);
    const ab = await res.arrayBuffer();
    const arr = new Uint8Array(ab).slice(0, 10);
    console.log("MAGIC BYTES:", Buffer.from(arr).toString());

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
  }
}

run();

import { v2 as cloudinary } from "cloudinary";

let configured = false;

// pehli baar zarurat par configure (tab tak .env load ho chuka hota hai)
function init() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

// memory me padi file (buffer) ko Cloudinary par bhejta hai
export function uploadBuffer(
  buffer,
  { folder, resourceType = "auto", publicId } = {}
) {
  init();
  const options = { folder, resource_type: resourceType };
  if (publicId) options.public_id = publicId;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) =>
      err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

export async function deleteFile(publicId, resourceType = "image") {
  init();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
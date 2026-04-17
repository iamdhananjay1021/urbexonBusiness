/**
 * cloudinary.js — Production
 * Fixed: Proper stream-based upload for buffer inputs
 * Added: uploadToCloudinary for buffer (used across controllers)
 */
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

/* Ensure Cloudinary is configured — called lazily before every upload
   so it works even if env vars weren't available at initial import time */
const ensureConfig = () => {
    const cfg = cloudinary.config();
    if (cfg.cloud_name && cfg.api_key && cfg.api_secret) return;
    // Re-read from env (covers Docker env_file & process env)
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
};

// Initial config attempt
ensureConfig();

/**
 * Upload a Buffer to Cloudinary using a stream
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Cloudinary folder path
 * @param {object} opts - Extra cloudinary options
 * @returns {Promise<object>} Cloudinary result
 */
export const uploadToCloudinary = (buffer, folder = "urbexon", opts = {}) => {
    ensureConfig();
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "auto", quality: "auto", fetch_format: "auto", ...opts },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

/**
 * Delete a file from Cloudinary by public_id
 */
export const deleteFromCloudinary = async (publicId) => {
    if (!publicId) return null;
    return cloudinary.uploader.destroy(publicId);
};

export const uploadDocuments = uploadToCloudinary;
export const uploadLogo = (buffer) => uploadToCloudinary(buffer, "urbexon/logos", { quality: 90, width: 400, crop: "limit" });

export default cloudinary;

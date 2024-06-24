import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

// Configuration
cloudinary.config({
  cloud_name: process.envCLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload an image
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null
    const response = cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    })
    console.log("File is uploaded on cloudinary", response.url)
    return response
  } catch (error) {
    fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation get failed
    return null
  }
}

export { uploadOnCloudinary }

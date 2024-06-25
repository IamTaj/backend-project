import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiErrors.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async (req, res) => {
  //   res.status(201).json({
  //     message: "User registered Successfully",
  //   })
  const { fullName, email, userName, password } = req.body

  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are mandatory")
  }

  const existedUser = await User.findOne({
    $or: [{ userName }, { email }],
  })
  if (existedUser) {
    throw new ApiError(
      402,
      "The username or the email is already been registered",
    )
  }

  const avatarLocalPath = req.files?.avatar[0]?.path
  console.log("avatarLocalPath: ", avatarLocalPath)
  const coverImagePath = req?.files?.coverImage[0]?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImagePath)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is not uploaded successfully")
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName?.toLowerCase(),
  })

  const UserGenerated = await User.findById(user?._id)?.select(
    "-password -refreshToken ",
  )
  if (!UserGenerated) {
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  return res
    .status(201)
    .json(new ApiResponse(200, UserGenerated, "User Registered Successfully"))
})

export { registerUser }

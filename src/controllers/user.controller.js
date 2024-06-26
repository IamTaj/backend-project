import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiErrors.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { generateAccessAndRefreshToken } from "../utils/generateAccessAndRefreshToken.js"
import { emailValidator, passwordValidator } from "../utils/validators.js"
import { cookieOption } from "../utils/cookieOption.js"

//Register User Controller
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body

  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are mandatory")
  }

  if (!fullName?.length > 3) {
    throw new ApiError(400, "Fullname should be greater than 3 characters")
  }

  if (!emailValidator(email)) {
    throw new ApiError(400, "Please enter a valid email")
  }

  if (!passwordValidator(password)) {
    throw new ApiError(
      400,
      "Password must contain at least one uppercase letter, one special character, one number and atleast 8 character long.",
    )
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
  let coverImagePath

  if (
    req?.files &&
    Array?.isArray(req?.files?.coverImage) &&
    req?.files?.coverImage?.length > 0
  ) {
    coverImagePath = req?.files?.coverImage[0]?.path
  }

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

  const UserGenerated = await User.findById(user?._id)?.select("-refreshToken ")
  if (!UserGenerated) {
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  return res
    .status(201)
    .json(new ApiResponse(201, UserGenerated, "User Registered Successfully"))
})

//Login User Controller
const loginUser = asyncHandler(async (req, res) => {
  const { email, userName, password } = req?.body
  if (!(email || userName)) {
    throw new ApiError(400, "Username or email is required")
  }

  const registerUser = await User?.findOne({ $or: [{ email }, { userName }] })

  if (!registerUser) {
    throw new ApiError(404, "User is not registered")
  }

  const isPasswordValid = await registerUser.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid user credentials")
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    registerUser?._id,
  )

  const loggedInUser = await User?.findById(registerUser?._id)?.select(
    "-password -refreshToken",
  )

  return res
    ?.status(200)
    ?.cookie("accessToken", accessToken, cookieOption)
    ?.cookie("refreshToken", refreshToken, cookieOption)
    ?.json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn successfully",
      ),
    )
})

//Logout User Controller
const logoutUser = asyncHandler(async (req, res) => {
  await User?.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    },
  )

  return res
    ?.status(200)
    ?.clearCookie("accessToken", cookieOption)
    ?.clearCookie("refreshToken", cookieOption)
    ?.json(new ApiResponse(200, {}, "User logged out successfully"))
})

//Refresh AccessToken Controller
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req?.cookie?.refresAccessToken || req?.body?.refresAccessToken

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Access")
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET)

    const user = await User?.findById(decodedToken?._id)

    if (!user) {
      throw new ApiError(401, "Unauthorized Access")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is expired or used")
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user?._id)

    return res
      ?.status(200)
      ?.cookie("accessToken", accessToken, cookieOption)
      ?.cookie("refreshToken", newRefreshToken, cookieOption)
      ?.json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          "Access token refreshed",
        ),
      )
  } catch (error) {
    throw new ApiError(error?.message || "Invalid refresh token")
  }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken }

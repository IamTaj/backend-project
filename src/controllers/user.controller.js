import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiErrors.js"
import { User } from "../models/user.models.js"
import { destroyOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { generateAccessAndRefreshToken } from "../utils/generateAccessAndRefreshToken.js"
import { emailValidator, passwordValidator } from "../utils/validators.js"
import { cookieOption } from "../utils/cookieOption.js"
import mongoose from "mongoose"

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
      $unset: { refreshToken: 1 }, //removes the refresh token from the database when user logout
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

//Change Current Password Controller
const updatePassword = asyncHandler(async (req, res) => {
  const { newPassword, oldPassword, confirmPassword } = req?.body
  const user = await User.findById(req.user?._id)
  const isPasswordValid = user.isPasswordCorrect(oldPassword)

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid user old password")
  }
  if (!(newPassword === confirmPassword)) {
    throw new ApiError(400, "New password and confirm password didn't matched")
  }

  user.password = newPassword
  user.save({
    validateBeforeSave: false,
  })

  return res
    ?.status(200)
    ?.json(new ApiResponse(200, {}, "Password has been updated successfully"))
})

//Update Account Details
const updateAccountsDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body

  if (!(fullName || email)) {
    throw new ApiError(400, "All the fields are mandatory")
  }

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true },
  ).select("-password")

  return res
    ?.status(200)
    ?.json(new ApiResponse(200, user, "User details have been updated"))
})

//Update Account Avatar
const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = res?.file?.path

  if (!avatarLocalPath) {
    throw new ApiError(
      400,
      "Please provide avatar or cover image to update the details",
    )
  }

  await destroyOnCloudinary(req.user.avatar)

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if (!avatar?.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading the avatar. Please try again later",
    )
  }

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    },
  ).select("-password")

  return res
    ?.status(200)
    ?.json(new ApiResponse(200, user, "Avatar is been updated successfully"))
})

//Get User Details
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"))
})

//Update Account Cover Image
const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req?.file?.path

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Please provide a cover image")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading the cover image. Please try again later",
    )
  }

  const user = await User?.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true },
  ).select("-password")

  return res
    ?.status(200)
    ?.json(
      new ApiResponse(200, user, "Cover image is been updated successfully"),
    )
})

//Get Subscriber and Subscription Details
const getUserChanneLProfile = asyncHandler(async (req, res) => {
  const { userName } = req?.params

  if (!userName?.trim()) {
    throw new ApiError(400, "Username is missing")
  }

  const channel = await User.aggregate([
    {
      $match: {
        userName: userName?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "Subscription",
        localField: "_id",
        foreignField: "channel",
        as: "subscriber",
      },
    },
    {
      $lookup: {
        from: "Subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "userSubscriberTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscriber",
        },
        channelSubscribedToCount: {
          $size: "$userSubscriberTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req?.user?._id, "$subscriber.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ])

  if (!channel?.length > 0) {
    throw new ApiError(404, "Channel does not exist")
  }

  console.log("channel", channel)
  return res
    ?.status(200)
    ?.json(
      new ApiResponse(200, channel[0], "User channel fetched successfully"),
    )
})

//Get Watch History
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User?.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req?.user?._id),
      },
    },
    {
      $lookup: {
        from: "Video",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ])

  if (!user) {
    throw new ApiError(400, "No watch history was found")
  }

  return res
    ?.status(200)
    ?.json(
      new ApiResponse(
        200,
        user[0]?.getWatchHistory,
        "Watch history fetched successfully",
      ),
    )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updatePassword,
  updateAccountsDetails,
  updateAvatar,
  getCurrentUser,
  updateCoverImage,
  getUserChanneLProfile,
  getWatchHistory,
}

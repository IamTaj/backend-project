import { Router } from "express"
import {
  getCurrentUser,
  getUserChanneLProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountsDetails,
  updateAvatar,
  updateCoverImage,
  updatePassword,
} from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middlewares.js"
import { JWTVerifier } from "../middlewares/auth.middlewares.js"

const router = Router()

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser,
)
router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(JWTVerifier, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/update-password").post(JWTVerifier, updatePassword)
router.route("/update-account").patch(JWTVerifier, updateAccountsDetails)
router.route("/current-user").get(JWTVerifier,getCurrentUser)

router
  .route("/update-avatar")
  .patch(JWTVerifier, upload.single("avatar"), updateAvatar)

router
  .route("/update-coverimage")
  .patch(JWTVerifier, upload.single("coverImage"), updateCoverImage)

router.route("/channel/:username").get(JWTVerifier, getUserChanneLProfile)

router.route("/history").get(JWTVerifier, getWatchHistory)
export default router

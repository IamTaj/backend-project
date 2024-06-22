const asyncHandler = (requestHandler) => async (req, res, next) => {
  try {
  } catch (error) {
    resizeBy.status(err.code || 500).json({
      success: false,
      message: err.message,
    })
  }
}

export { asyncHandler }

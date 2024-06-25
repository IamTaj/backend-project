class ApiResponse {
  constructor(statusCode, data, messsage = "Success") {
    this.statusCode = statusCode
    this.data = data
    this.messsage = messsage
    this.success = statusCode < 400
  }
}

export { ApiResponse }

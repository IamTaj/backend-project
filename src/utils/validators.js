function emailValidator(email) {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return email.match(emailPattern) !== null
}

function passwordValidator(password) {
  const passwordPattern =
    /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*\d)[A-Za-z\d!@#$%^&*]{8,}$/
  return password.match(passwordPattern) !== null
}

export { emailValidator, passwordValidator }

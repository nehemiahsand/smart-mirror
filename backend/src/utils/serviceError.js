function serviceError(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}
module.exports = serviceError;

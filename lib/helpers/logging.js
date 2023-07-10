// abstraction layer to allow stubbing of calls to console in tests

module.exports = {
  info: function (...args) {
    console.log(args)
  },

  error: function (...args) {
    console.error(args)
  }
}

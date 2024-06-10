const Joi = require('joi')

module.exports = {
  vars: Joi.array().required().sparse(),
  queryName: Joi.string().required().regex(/^slsTelemetryValues$/)
}

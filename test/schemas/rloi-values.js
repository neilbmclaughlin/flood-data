const Joi = require('@hapi/joi')

module.exports = {
  vars: Joi.array().required().sparse(),
  queryName: Joi.string().required().regex(/^slsTelemetryValues$/)
}

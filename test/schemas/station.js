const Joi = require('@hapi/joi')

module.exports = {
  vars: Joi.array().required().items(
    Joi.string(),
    Joi.string(),
    Joi.string(),
    Joi.string(),
    Joi.number(),
    Joi.number()
  ),
  queryName: Joi.string().required().regex(/^slsTelemetryStation$/)
}

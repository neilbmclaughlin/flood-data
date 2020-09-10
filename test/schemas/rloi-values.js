const Joi = require('@hapi/joi')

module.exports = {
  query: Joi.object({
    text: Joi.string().required().regex(/\bINSERT INTO "sls_telemetry_value"/),
    values: Joi.array().required().sparse()
  })
}

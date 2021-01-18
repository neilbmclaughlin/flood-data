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
  query: Joi.string().required().regex(/\bINSERT INTO u_flood.sls_telemetry_station/)
}

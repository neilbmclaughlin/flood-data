const Joi = require('joi')

module.exports = {
  vars: Joi.array().required().items(
    Joi.string().regex(/\bfwfidata\/rloi\/\b.*XML$/),
    Joi.date(),
    Joi.number(),
    Joi.string(),
    Joi.string(),
    Joi.date(),
    Joi.date(),
    Joi.string(),
    Joi.string().allow(''),
    Joi.string(),
    Joi.boolean(),
    Joi.number().allow(NaN),
    Joi.number(),
    Joi.string(),
    Joi.number()
  ),
  queryName: Joi.string().required().regex(/^slsTelemetryValueParent$/)
}

[![Build Status](https://travis-ci.com/DEFRA/flood-data.svg?branch=master)](https://travis-ci.com/DEFRA/flood-data)[![Maintainability](https://api.codeclimate.com/v1/badges/f36df721e8bfd20f2f0b/maintainability)](https://codeclimate.com/github/DEFRA/flood-data/maintainability)[![Test Coverage](https://api.codeclimate.com/v1/badges/f36df721e8bfd20f2f0b/test_coverage)](https://codeclimate.com/github/DEFRA/flood-data/test_coverage)

# flood-data

## synopsis

This is a serverless project to provide the processing of data files for LFW from FWFI

## Installing

### There is a global dependency on [serverless](https://serverless.com/) which is used for configuration and deployments to AWS
`npm i -g serverless`

`npm install`

## Deployment

`npm run deploy`

## Unit tests and linting
`npm run pre-deployment-test`

## Feature testing (integration)
`npm run post-deployment-test`

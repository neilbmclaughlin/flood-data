[![Build Status](https://travis-ci.com/DEFRA/flood-data.svg?branch=master)](https://travis-ci.com/DEFRA/flood-data)[![Maintainability](https://api.codeclimate.com/v1/badges/f36df721e8bfd20f2f0b/maintainability)](https://codeclimate.com/github/DEFRA/flood-data/maintainability)[![Test Coverage](https://api.codeclimate.com/v1/badges/f36df721e8bfd20f2f0b/test_coverage)](https://codeclimate.com/github/DEFRA/flood-data/test_coverage)

# flood-data

## synopsis

This is a serverless project to provide the processing of data files for LFW from FWFI

### ffoi-process

Pulls in the forcast telemetry data from the S3 bucket and processes it into the database

### fgs-process

Lambda that checks for the latest flood guidence statement and if it is newer than the last processed one it will download the file and put it in our S3 bucket

### fwis-process

Gets all warnings and alerts from the FWIS api and puts them in the database

### imtd-process

This Lambda will check every station in the database agaist the IMTD api and update the database with the latest thresholds for each station. Calling its self after each station in order to minimise the time the lambda runs for. This is run every two weeks and the different envs have to run on different days as the IMTD api cant handle the load of all the stations at once from multiple envs.

### rloi-process

brings in the observed telemtery data from the S3 bucket and processes it into the database

### rloi-refresh

refreshes the materialized views and clears out the old telemetry.

### station-process

Uses the exports context file from sharepoint to update the stations in the database.

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

const _ = require('lodash');
const mtSchema = require('metastocle/src/schema');
const stSchema = require('storacle/src/schema');
const utils = require('./utils');
const schema = Object.assign({}, mtSchema, stSchema);

schema.getStatusResponse = function () {
  return _.merge(mtSchema.getStatusResponse(), stSchema.getStatusResponse());
};

schema.getStatusPrettyResponse = function () {
  return _.merge(this.getStatusResponse(), mtSchema.getStatusPrettyResponse(), stSchema.getStatusPrettyResponse());
};

schema.getSongAudioLink = function () {
  return {
    type: 'string',
    value: val => val == '' || utils.isValidSongAudioLink(val)
  };
};

schema.getSongCoverLink = function () {
  return {
    type: 'string',
    value: val => val == '' || utils.isValidSongCoverLink(val)
  };
};

schema.getSongInfo = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      title: 'string',
      tags: 'object',
      audioLink: this.getSongAudioLink(),
      coverLink: this.getSongCoverLink(),     
    },
    strict: true
  };
};

schema.getSongAdditionResponse = function () {
  return this.getSongInfo();
};

schema.getSongInfoSlaveResponse = function () {
  return this.getSongInfo();
};

schema.getSongInfoMasterResponse = function (options = {}) {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      info: {
        type: 'array',
        items: this.getSongInfoSlaveResponse(),
        maxLength: options.networkOptimum
      }
    },
    strict: true
  }
};

schema.getSongRemovalMasterResponse = function () {
  return this.getFileRemovalMasterResponse();
};

schema.getSongRemovalSlaveResponse = function () {
  return this.getFileRemovalSlaveResponse();
};

schema.getMusicCollection = function () {
  return {
    type: 'object',
    props: {
      title: 'string',
      fileHash: 'string',
      priority: 'number'
    }
  }
};

module.exports = schema;
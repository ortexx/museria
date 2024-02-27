import merge from "lodash-es/merge.js";
import mtSchema from "metastocle/src/schema.js";
import stSchema from "storacle/src/schema.js";
import utils from "./utils.js";

const schema = Object.assign({}, mtSchema, stSchema);

schema.getStatusResponse = function () {
  return merge(mtSchema.getStatusResponse(), stSchema.getStatusResponse(), {
    props: {
      collectionLimit: 'number',
    }
  });
};

schema.getSongPriority = function () {
  return {
    type: 'number',
    value: utils.isValidSongPriority.bind(utils)
  };
};

schema.getStatusPrettyResponse = function () {
  return merge(this.getStatusResponse(), mtSchema.getStatusPrettyResponse(), stSchema.getStatusPrettyResponse());
};

schema.getMusicCollectionGetting = function (options = {}) {
  const nullType = {
    type: 'object',
    value: null
  };
  const musicType = {
    type: 'object',
    strict: true,
    props: {
      value: 'string',
      similarity: 'number',
      beautify: 'boolean'
    }
  };
  const titleType = [
    {
      type: 'object',
      strict: true,
      props: {
        $mus: musicType
      }
    },
    {
      type: 'object',
      strict: true,
      props: {
        $art: 'string'
      }
    },
    {
      type: 'object',
      strict: true,
      props: {
        $or: {
          type: 'array',
          items: [
            {
              type: 'object',
              strict: true,
              props: {
                $mus: musicType
              }
            },
            {
              type: 'object',
              strict: true,
              props: {
                $milk: {
                  type: 'string',
                  value: val => (!options.findingStringMinLength || val.length >= options.findingStringMinLength)
                }
              }
            }
          ]
        }
      }
    }
  ];
  return {
    type: 'object',
    strict: true,
    props: {
      offset: {
        type: 'number',
        value: 0
      },
      limit: {
        type: 'number'
      },
      removeDuplicates: {
        type: 'boolean'
      },
      sort: [
        {
          type: 'array',
          value: val => JSON.stringify(val) === JSON.stringify([
            ['main', 'desc'], ['intScore', 'desc'],
            ['priority', 'desc'], ['random', 'asc']
          ])
        },
        nullType
      ],
      fields: nullType,
      filter: {
        type: 'object',
        strict: true,
        props: {
          compTitle: titleType
        }
      }
    }
  };
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
      fileHash: 'string',
      tags: 'object',
      audioLink: this.getSongAudioLink(),
      coverLink: this.getSongCoverLink(),
      priority: this.getSongPriority()
    },
    strict: true
  };
};

schema.getSongAdditionResponse = function () {
  return this.getSongInfo();
};

schema.getSongInfoMasterResponse = function () {
  return this.getSongInfoButlerResponse();
};

schema.getSongInfoButlerResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      info: {
        type: 'array',
        items: this.getSongInfoSlaveResponse()
      }
    },
    strict: true
  };
};

schema.getSongInfoSlaveResponse = function () {
  return this.getSongInfo();
};

schema.getSongRemovalMasterResponse = function () {
  return this.getSongRemovalButlerResponse();
};

schema.getSongRemovalButlerResponse = function () {
  return this.getFileRemovalMasterResponse();
};

schema.getSongRemovalSlaveResponse = function () {
  return this.getFileRemovalSlaveResponse();
};

schema.getMusicCollection = function () {
  const songInfo = this.getSongInfo();
  songInfo.props.compTitle = 'string';
  delete songInfo.strict;
  return songInfo;
};

export default schema;

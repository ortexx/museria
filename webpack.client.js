const path = require('path');
const merge = require('lodash/merge');
const stWebpackConfig = require('storacle-ms/webpack.client.js');
const mtWebpackConfig = require('metastocle-ms/webpack.client.js');

module.exports = (options = {}, wp) => {
  options = merge({
    include: [],
    mock: {
      'music-metadata': true,
      'base64url': true
    } 
  }, options);
  options.include.push([path.resolve(__dirname, 'src/browser/client')]);
  return wp? mtWebpackConfig(stWebpackConfig(options), wp): options;
};
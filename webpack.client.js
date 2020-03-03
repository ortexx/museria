const path = require('path');
const merge = require('lodash/merge');
const stWebpackConfig = require('storacle/webpack.client.js');
const mtWebpackConfig = require('metastocle/webpack.client.js');

module.exports = (options = {}, webpack = null, onlyMerge = false) => {
  options = merge({ 
    include: [], 
    mock: {
      'music-metadata': true,
      'base64url': true
    } 
  }, options);  
  options.include.push(path.resolve(__dirname, 'src/browser/client'));
  return onlyMerge? options: mtWebpackConfig(stWebpackConfig(options, null, true));
};
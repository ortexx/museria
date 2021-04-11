const path = require('path');
const merge = require('lodash/merge');
const spWebpackConfig = require('spreadable/webpack.common.js');

module.exports = (options = {}, wp) => {
  options = merge({
    name: 'face',
    include: []    
  }, options);
  options.include.push([
    path.resolve(__dirname, 'src/browser/face'),
    path.resolve(__dirname, 'node_modules/akili')
  ]);
  return wp? spWebpackConfig(options, wp): options;
};
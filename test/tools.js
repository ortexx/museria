const _tools = Object.assign({}, require('metastocle-ms/test/tools'), require('storacle-ms/test/tools'));
const tools =  Object.assign({}, _tools);

/**
 * Create the node options
 * 
 * @async
 * @param {object} [options]
 * @returns {object}
 */
tools.createNodeOptions = async function (options = {}) {
  options = await _tools.createNodeOptions(options); 
  options.storage.dataSize = '90%';
  options.storage.tempSize = '5%';
  options.file = { minSize: 0 };
  return options;
};

module.exports = tools;
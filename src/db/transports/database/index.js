const Database = require('spreadable/src/db/transports/database')();

module.exports = (Parent) => {
  /**
   * Database transport interface
   */
  return class DatabaseMuseria extends (Parent || Database) {
    /**
     * @async
     * @param {string} title 
     * @returns {object}
     */
    async getMusicByPk() {
      throw new Error('Method "getMusicByPk" is required for database transport');
    }

    /**
     * @async
     * @param {string} hash
     */
    async removeMusicByFileHash() {
      throw new Error('Method "removeMusicByFileHash" is required for database transport');
    }
  }
};
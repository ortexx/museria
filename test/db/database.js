import { assert } from "chai";
import database from "../../src/db/transports/database/index.js";

const DatabaseMuseria = database();

export default function () {
  describe('DatabaseMetastocle', () => {
    let db;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => db = new DatabaseMuseria());
        db.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await db.init();
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await db.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await db.init();
      });
    });
    
    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await db.destroy();
      });
    });
  });
}
/* Copyright (c) 2017, Oracle and/or its affiliates. All rights reserved. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The node-oracledb test suite uses 'mocha', 'should' and 'async'.
 * See LICENSE.md for relevant licenses.
 *
 * NAME
 *   109. rowidFunctionBindAsString_bind.js
 *
 * DESCRIPTION
 *   Testing rowid plsql bind as String.
 *
 * NUMBERING RULE
 *   Test numbers follow this numbering rule:
 *     1  - 20  are reserved for basic functional tests
 *     21 - 50  are reserved for data type supporting tests
 *     51 onwards are for other tests
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var should   = require('should');
var async    = require('async');
var dbConfig = require('./dbconfig.js');
var sql      = require('./sql.js');

describe.skip('109. rowidFunctionBindAsString_bind.js', function() {
  var connection = null;
  var tableName = "nodb_rowid_plsql_in";
  var insertID = 1;

  var fun_create_table = "BEGIN \n" +
                          "  DECLARE \n" +
                          "    e_table_missing EXCEPTION; \n" +
                          "    PRAGMA EXCEPTION_INIT(e_table_missing, -00942);\n" +
                          "    BEGIN \n" +
                          "      EXECUTE IMMEDIATE ('DROP TABLE " + tableName + " PURGE' ); \n" +
                          "    EXCEPTION \n" +
                          "      WHEN e_table_missing \n" +
                          "      THEN NULL; \n" +
                          "    END; \n" +
                          "    EXECUTE IMMEDIATE ( ' \n" +
                          "      CREATE TABLE " + tableName + " ( \n" +
                          "        ID       NUMBER, \n" +
                          "        content  ROWID \n" +
                          "      ) \n" +
                          "    '); \n" +
                          "END;  ";
  var drop_table = "DROP TABLE " + tableName + " PURGE";

  before('get connection and create table', function(done) {
    async.series([
      function(cb) {
        oracledb.getConnection(dbConfig, function(err, conn) {
          should.not.exist(err);
          connection = conn;
          cb();
        });
      },
      function(cb) {
        sql.executeSql(connection, fun_create_table, {}, {}, cb);
      }
    ], done);
  });

  after('release connection', function(done) {
    async.series([
      function(cb) {
        sql.executeSql(connection, drop_table, {}, {}, cb);
      },
      function(cb) {
        connection.release( function(err) {
          should.not.exist(err);
          cb();
        });
      }
    ], done);
  });

  beforeEach(function(done) {
    insertID++;
    done();
  });

  describe('109.1 FUNCTION BIND_OUT as rowid', function() {
    var fun_create = "CREATE OR REPLACE FUNCTION nodb_rowid_bind (id IN NUMBER, content IN ROWID) RETURN ROWID\n" +
                     "IS \n" +
                     "    tmp rowid; \n" +
                     "BEGIN \n" +
                     "    insert into " + tableName + " (id, content) values (id, CHARTOROWID(content)); \n" +
                     "    select content into tmp from " + tableName + " where id = id; \n" +
                     "    return tmp; \n" +
                     "END; ";
    var fun_execute = "BEGIN :o := nodb_rowid_bind (:i, :c); END;";
    var fun_drop = "DROP FUNCTION nodb_rowid_bind";

    before('create procedure', function(done) {
      sql.executeSql(connection, fun_create, {}, {}, done);
    });

    after('drop procedure', function(done) {
      sql.executeSql(connection, fun_drop, {}, {}, done);
    });

    it('109.1.1 works with null', function(done) {
      var content = null;
      funBindOut(fun_execute, content, content, done);
    });

    it('109.1.2 works with empty string', function(done) {
      var content = "";
      funBindOut(fun_execute, content, null, done);
    });

    it('109.1.3 works with undefined', function(done) {
      var content = undefined;
      funBindOut(fun_execute, content, null, done);
    });

    it('109.1.4 works with NaN', function(done) {
      var content = NaN;
      var bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_IN },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
        done();
      });
    });

    it('109.1.5 works with extended rowid', function(done) {
      var content = "AAAB12AADAAAAwPAAA";
      funBindOut(fun_execute, content, content, done);
    });

    it('109.1.6 works with restricted rowid', function(done) {
      var content = "00000DD5.0000.0101";
      funBindOut(fun_execute, content, content, done);
    });

    it('109.1.7 works with string 0', function(done) {
      var content = "0";
      funBindOut(fun_execute, content, "00000000.0000.0000", done);
    });

    it('109.1.8 works with number 0', function(done) {
      var content = 0;
      var bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_IN },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
        done();
      });
    });

    it('109.1.9 works with default bind type/dir - extended rowid', function(done) {
      var content = "AAAB1+AADAAAAwPAAA";
      funBindOut_default(fun_create, content, content, done);
    });

    it('109.1.10 works with default bind type/dir - null value', function(done) {
      var content = null;
      funBindOut_default(fun_create, content, content, done);
    });

    it('109.1.11 works with default bind type/dir - empty string', function(done) {
      var content = "";
      funBindOut_default(fun_create, content, null, done);
    });

    it('109.1.12 works with default bind type/dir - undefined', function(done) {
      var content = undefined;
      funBindOut_default(fun_create, content, null, done);
    });

    it('109.1.13 bind error: NJS-037', function(done) {
      var bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: [0], type: oracledb.STRING, dir: oracledb.BIND_IN },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-037: invalid data type at array index 0 for bind ":c"');
        done();
      });
    });

    it('109.1.14 bind error: NJS-052', function(done) {
      var bindVar = [ { type: oracledb.STRING, dir: oracledb.BIND_OUT }, insertID, { val: [0], type: oracledb.STRING, dir: oracledb.BIND_IN } ];
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-052: invalid data type at array index 0 for bind position 2');
        done();
      });
    });

  });

  describe('109.2 FUNCTION BIND_OUT as string', function() {
    var fun_create = "CREATE OR REPLACE FUNCTION nodb_rowid_bind (id IN NUMBER, content IN ROWID) RETURN VARCHAR2\n" +
                     "IS \n" +
                     "    tmp rowid; \n" +
                     "BEGIN \n" +
                     "    insert into " + tableName + " (id, content) values (id, CHARTOROWID(content)); \n" +
                     "    select content into tmp from " + tableName + " where id = id; \n" +
                     "    return tmp; \n" +
                     "END; ";
    var fun_execute = "BEGIN :o := nodb_rowid_bind (:i, :c); END;";
    var fun_drop = "DROP FUNCTION nodb_rowid_bind";

    before('create procedure', function(done) {
      sql.executeSql(connection, fun_create, {}, {}, done);
    });

    after('drop procedure', function(done) {
      sql.executeSql(connection, fun_drop, {}, {}, done);
    });

    it('109.2.1 works with null', function(done) {
      var content = null;
      funBindOut(fun_execute, content, content, done);
    });

    it('109.2.2 works with empty string', function(done) {
      var content = "";
      funBindOut(fun_execute, content, null, done);
    });

    it('109.2.3 works with undefined', function(done) {
      var content = undefined;
      funBindOut(fun_execute, content, null, done);
    });

    it('109.2.4 works with NaN', function(done) {
      var content = NaN;
      var bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_IN },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
        done();
      });
    });

    it('109.2.5 works with extended rowid', function(done) {
      var content = "AAAB12AADAAAAwPAAA";
      funBindOut(fun_execute, content, content, done);
    });

    it('109.2.6 works with restricted rowid', function(done) {
      var content = "00000DD5.0000.0101";
      funBindOut(fun_execute, content, content, done);
    });

    it('109.2.7 works with string 0', function(done) {
      var content = "0";
      funBindOut(fun_execute, content, "00000000.0000.0000", done);
    });

    it('109.2.8 works with number 0', function(done) {
      var content = 0;
      var bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_IN },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
        done();
      });
    });

    it('109.2.9 works with default bind type/dir - extended rowid', function(done) {
      var content = "AAAB1+AADAAAAwPAAA";
      funBindOut_default(fun_create, content, content, done);
    });

    it('109.2.10 works with default bind type/dir - null value', function(done) {
      var content = null;
      funBindOut_default(fun_create, content, content, done);
    });

    it('109.2.11 works with default bind type/dir - empty string', function(done) {
      var content = "";
      funBindOut_default(fun_create, content, null, done);
    });

    it('109.2.12 works with default bind type/dir - undefined', function(done) {
      var content = undefined;
      funBindOut_default(fun_create, content, null, done);
    });

    it('109.2.13 bind error: NJS-037', function(done) {
      var bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: [0], type: oracledb.STRING, dir: oracledb.BIND_IN },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-037: invalid data type at array index 0 for bind ":c"');
        done();
      });
    });

    it('109.2.14 bind error: NJS-052', function(done) {
      var bindVar = [ { type: oracledb.STRING, dir: oracledb.BIND_OUT }, insertID, { val: [0], type: oracledb.STRING, dir: oracledb.BIND_IN } ];
      sql.executeSqlWithErr(connection, fun_create, bindVar, {}, function(err) {
        should.strictEqual(err.message, 'NJS-052: invalid data type at array index 0 for bind position 2');
        done();
      });
    });

  });

  describe('109.3 FUNCTION BIND_IN, UPDATE', function() {
    var fun_create = "CREATE OR REPLACE FUNCTION nodb_rowid_bind_1083 (id IN NUMBER, content_1 IN STRING, content_2 IN ROWID) RETURN ROWID\n" +
                      "IS \n" +
                      "    tmp rowid; \n" +
                      "BEGIN \n" +
                      "    insert into " + tableName + " (id, content) values (id, CHARTOROWID(content_1)); \n" +
                      "    update " + tableName + " set content = content_2 where id = id; \n" +
                      "    select content into tmp from " + tableName + " where id = id; \n" +
                      "    return tmp; \n" +
                      "END; ";
    var fun_exec = "BEGIN :o := nodb_rowid_bind_1083 (:i, :c1, :c2); END;";
    var fun_drop = "DROP FUNCTION nodb_rowid_bind_1083";

    before('create procedure', function(done) {
      sql.executeSql(connection, fun_create, {}, {}, done);
    });

    after('drop procedure', function(done) {
      sql.executeSql(connection, fun_drop, {}, {}, done);
    });

    it('109.3.1 update null with rowid', function(done) {
      var content_1 = null;
      var content_2 = "AAAB12AADAAAAwPAAA";
      funBindOut_update(fun_exec, content_1, content_2, content_2, done);
    });

    it('109.3.2 update empty string with rowid', function(done) {
      var content_1 = "";
      var content_2 = "AAAB12AADAAAAwPAAA";
      funBindOut_update(fun_exec, content_1, content_2, content_2, done);
    });

    it('109.3.3 update undefined with rowid', function(done) {
      var content_1 = undefined;
      var content_2 = "AAAB12AADAAAAwPAAA";
      funBindOut_update(fun_exec, content_1, content_2, content_2, done);
    });

    it('109.3.4 works with default bind type/dir', function(done) {
      var content_1 = "AAAB1+AADAAAAwPAAA";
      var content_2 = "0";
      funBindOut_update(fun_exec, content_1, content_2, "00000000.0000.0000", done);
    });

    it('109.3.5 works with default bind type/dir - null value', function(done) {
      var content_1 = "AAAB12AADAAAAwPAAA";
      var content_2 = null;
      funBindOut_update_default(fun_exec, content_1, content_2, null, done);
    });

    it('109.3.6 works with default bind type/dir - empty string', function(done) {
      var content_1 = "AAAB12AADAAAAwPAAA";
      var content_2 = "";
      funBindOut_update_default(fun_exec, content_1, content_2, null, done);
    });

    it('109.3.7 works with default bind type/dir - undefined', function(done) {
      var content_1 = "AAAB12AADAAAAwPAAA";
      var content_2 = undefined;
      funBindOut_update_default(fun_exec, content_1, content_2, null, done);
    });

  });

  var funBindOut = function(fun_exec, content_in, expected, callback) {
    var bindVar_in = {
      i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
      c: { val: content_in, type: oracledb.STRING, dir: oracledb.BIND_IN },
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    connection.execute(
      fun_exec,
      bindVar_in,
      function(err, result) {
        should.not.exist(err);
        var resultVal = result.outBinds.o;
        should.strictEqual(resultVal, expected);
        callback();
      }
    );
  };

  var funBindOut_default = function(fun_exec, content_in, expected, callback) {
    var bindVar_in = {
      i: insertID,
      c: content_in,
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    connection.execute(
      fun_exec,
      bindVar_in,
      function(err, result) {
        should.not.exist(err);
        var resultVal = result.outBinds.o;
        should.strictEqual(resultVal, expected);
        callback();
      }
    );
  };

  var funBindOut_update = function(fun_exec, content_1, content_2, expected, callback) {
    var bindVar_in = {
      i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
      c1: { val: content_1, type: oracledb.STRING, dir: oracledb.BIND_IN },
      c2: { val: content_2, type: oracledb.STRING, dir: oracledb.BIND_IN },
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    connection.execute(
      fun_exec,
      bindVar_in,
      function(err, result) {
        should.not.exist(err);
        var resultVal = result.outBinds.o;
        should.strictEqual(resultVal, expected);
        callback();
      }
    );
  };

  var funBindOut_update_default = function(fun_exec, content_1, content_2, expected, callback) {
    var bindVar_in = {
      i: insertID,
      c1: content_1,
      c2: content_2,
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    connection.execute(
      fun_exec,
      bindVar_in,
      function(err, result) {
        should.not.exist(err);
        var resultVal = result.outBinds.o;
        should.strictEqual(resultVal, expected);
        callback();
      }
    );
  };

});

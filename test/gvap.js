/* eslint-env node, mocha */

"use strict";

var fs = require("fs");
var join = require("path").join;
var crypto = require("crypto");
var assert = require("chai").assert;
var gvap = require("gvap");
var keyvapory = require("../");
var checkKeyObj = require("./checkKeyObj");

var NUM_TESTS = 1000;
var TIMEOUT = 10000;
var DATADIR = join(__dirname, "fixtures");

var options = {
  persist: false,
  flags: {
    networkid: "10101",
    port: 30304,
    rpcport: 8547,
    nodiscover: null,
    datadir: DATADIR,
    ipcpath: join(DATADIR, "gvap.ipc"),
    password: join(DATADIR, ".password")
  }
};

var pbkdf2 = keyvapory.crypto.pbkdf2;
var pbkdf2Sync = keyvapory.crypto.pbkdf2Sync;

// gvap.debug = true;

function createVaporyKey(passphrase) {
  var dk = keyvapory.create();
  var key = keyvapory.dump(passphrase, dk.privateKey, dk.salt, dk.iv);
  return JSON.stringify(key);
}

keyvapory.constants.quiet = true;

describe("Unlock randomly-generated accounts in gvap", function () {
  var password, hashRounds, i;

  var test = function (t) {

    var label = "[" + t.kdf + " | " + t.hashRounds + " rounds] generate key file using password '" + t.password +"'";

    it(label, function (done) {
      var json, keyObject;
      this.timeout(TIMEOUT*2);

      if (t.sjcl) {
        keyvapory.crypto.pbkdf2 = undefined;
        keyvapory.crypto.pbkdf2Sync = undefined;
      } else {
        keyvapory.crypto.pbkdf2 = pbkdf2;
        keyvapory.crypto.pbkdf2Sync = pbkdf2Sync;
      }

      json = createVaporyKey(t.password);
      assert.isNotNull(json);

      keyObject = JSON.parse(json);
      assert.isObject(keyObject);
      checkKeyObj.structure(keyvapory, keyObject);

      keyvapory.exportToFile(keyObject, join(DATADIR, "keystore"), function (keypath) {
        fs.writeFile(options.flags.password, t.password, function (ex) {
          var fail;
          if (ex) return done(ex);
          options.flags.unlock = keyObject.address;
          options.flags.vaporbase = keyObject.address;
          gvap.start(options, {
            stderr: function (data) {
              if (gvap.debug) process.stdout.write(data);
              if (data.toString().indexOf("16MB") > -1) {
                gvap.trigger(null, gvap.proc);
              }
            },
            close: function () {
              fs.unlink(options.flags.password, function (exc) {
                if (exc) return done(exc);
                fs.unlink(keypath, function (exc) {
                  if (exc) return done(exc);
                  done(fail);
                });
              });
            }
          }, function (err, spawned) {
            if (err) return done(err);
            if (!spawned) return done(new Error("where's the gvap?"));
            gvap.stdout("data", function (data) {
              var unlocked = "Account '" + keyObject.address+
                "' (" + keyObject.address + ") unlocked.";
              if (data.toString().indexOf(unlocked) > -1) {
                gvap.stop();
              }
            });
            gvap.stderr("data", function (data) {
              if (data.toString().indexOf("Fatal") > -1) {
                fail = new Error(data);
                gvap.stop();
              }
            });
          });
        });
      });
    });
  };

  for (i = 0; i < NUM_TESTS; ++i) {

    password = crypto.randomBytes(Math.ceil(Math.random()*100));
    hashRounds = Math.ceil(Math.random() * 300000);

    keyvapory.constants.pbkdf2.c = hashRounds;
    keyvapory.constants.scrypt.n = hashRounds;

    test({
      sjcl: false,
      password: password.toString("hex"),
      hashRounds: hashRounds,
      kdf: "pbkdf2"
    });
    test({
      sjcl: true,
      password: password.toString("hex"),
      hashRounds: hashRounds,
      kdf: "pbkdf2"
    });
    test({
      password: password.toString("base64"),
      hashRounds: hashRounds,
      kdf: "scrypt"
    });

    test({
      sjcl: false,
      password: password.toString("hex"),
      hashRounds: hashRounds,
      kdf: "pbkdf2"
    });
    test({
      sjcl: true,
      password: password.toString("hex"),
      hashRounds: hashRounds,
      kdf: "pbkdf2"
    });
    test({
      password: password.toString("base64"),
      hashRounds: hashRounds,
      kdf: "scrypt"
    });
  }

});

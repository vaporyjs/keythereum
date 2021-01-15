# keyvapory

[![Build Status](https://travis-ci.org/vaporyjs/keyvapory.svg?branch=master)](https://travis-ci.org/vaporyjs/keyvapory) [![Coverage Status](https://coveralls.io/repos/github/vaporyjs/keyvapory/badge.svg?branch=master)](https://coveralls.io/github/vaporyjs/keyvapory?branch=master) [![npm version](https://badge.fury.io/js/keyvapory.svg)](http://badge.fury.io/js/keyvapory)

Keyvapory is a JavaScript tool to generate, import and export Vapory keys.  This provides a simple way to use the same account locally and in web wallets.  It can be used for verifiable cold storage wallets.

Keyvapory uses the same key derivation functions (PBKDF2-SHA256 or scrypt), symmetric ciphers (AES-128-CTR or AES-128-CBC), and message authentication codes as [gvap](https://github.com/vapory/go-vapory).  You can export your generated key to file, copy it to your data directory's keystore, and immediately start using it in your local Vapory client.

*Note: starting in version 0.5.0, keyvapory's `encrypt` and `decrypt` functions both return Buffers instead of strings.  This is a breaking change for anyone using these functions directly!*

## Installation

```
npm install keyvapory
```

## Usage

To use keyvapory in Node.js, just `require` it:

```javascript
var keyvapory = require("keyvapory");
```

A minified, browserified file `dist/keyvapory.min.js` is included for use in the browser.  Including this file simply attaches the `keyvapory` object to `window`:

```html
<script src="dist/keyvapory.min.js" type="text/javascript"></script>
```

### Key creation

Generate a new random private key (256 bit), as well as the salt (256 bit) used by the key derivation function, and the initialization vector (128 bit) used to AES-128-CTR encrypt the key.  `create` is asynchronous if it is passed a callback function, and synchronous otherwise.

```javascript
// optional private key and initialization vector sizes in bytes
// (if params is not passed to create, keyvapory.constants is used by default)
var params = { keyBytes: 32, ivBytes: 16 };

// synchronous
var dk = keyvapory.create(params);
// dk:
{
    privateKey: <Buffer ...>,
    iv: <Buffer ...>,
    salt: <Buffer ...>
}

// asynchronous
keyvapory.create(params, function (dk) {
    // do stuff!
});
```

### Key export

You will need to specify a password and (optionally) a key derivation function.  If unspecified, PBKDF2-SHA256 will be used to derive the AES secret key.

```javascript
var password = "whevapory";
var kdf = "pbkdf2"; // or "scrypt" to use the scrypt kdf
```

The `dump` function is used to export key info to keystore ["secret-storage" format](https://github.com/vapory/wiki/wiki/Web3-Secret-Storage-Definition).  If a callback function is supplied as the sixth parameter to `dump`, it will run asynchronously:

```javascript
// Note: if options is unspecified, the values in keyvapory.constants are used.
var options = {
  kdf: "pbkdf2",
  cipher: "aes-128-ctr",
  kdfparams: {
    c: 262144,
    dklen: 32,
    prf: "hmac-sha256"
  }
};

// synchronous
var keyObject = keyvapory.dump(password, dk.privateKey, dk.salt, dk.iv, options);
// keyObject:
{
  address: "008aeeda4d805471df9b2a5b0f38a0c3bcba786b",
  Crypto: {
    cipher: "aes-128-ctr",
    ciphertext: "5318b4d5bcd28de64ee5559e671353e16f075ecae9f99c7a79a38af5f869aa46",
    cipherparams: {
      iv: "6087dab2f9fdbbfaddc31a909735c1e6"
    },
    mac: "517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2",
    kdf: "pbkdf2",
    kdfparams: {
      c: 262144,
      dklen: 32,
      prf: "hmac-sha256",
      salt: "ae3cd4e7013836a3df6bd7241b12db061dbe2c6785853cce422d148a624ce0bd"
    }
  },
  id: "e13b209c-3b2f-4327-bab0-3bef2e51630d",
  version: 3
}

// asynchronous
keyvapory.dump(password, dk.privateKey, dk.salt, dk.iv, options, function (keyObject) {
  // do stuff!
});
```

`dump` creates an object and not a JSON string.  In Node, the `exportToFile` method provides an easy way to export this formatted key object to file.  It creates a JSON file in the `keystore` sub-directory, and uses gvap's current file-naming convention (ISO timestamp concatenated with the key's derived Vapory address).

```javascript
keyvapory.exportToFile(keyObject);
```

After successful key export, you will see a message like:

```
Saved to file:
keystore/UTC--2015-08-11T06:13:53.359Z--008aeeda4d805471df9b2a5b0f38a0c3bcba786b

To use with gvap, copy this file to your Vapory keystore folder
(usually ~/.vapory/keystore).
```

### Key import

Importing a key from gvap's keystore can only be done on Node.  The JSON file is parsed into an object with the same structure as `keyObject` above.

```javascript
// Specify a data directory (optional; defaults to ~/.vapory)
var datadir = "/home/jack/.vapory-test";

// Synchronous
var keyObject = keyvapory.importFromFile(address, datadir);

// Asynchronous
keyvapory.importFromFile(address, datadir, function (keyObject) {
  // do stuff
});
```
This has been tested with version 3 and version 1, but not version 2, keys.  (Please send me a version 2 keystore file if you have one, so I can test it!)

To recover the plaintext private key from the key object, use `keyvapory.recover`.  The private key is returned as a Buffer.

```javascript
// synchronous
var privateKey = keyvapory.recover(password, keyObject);
// privateKey:
<Buffer ...>

// Asynchronous
keyvapory.recover(password, keyObject, function (privateKey) {
  // do stuff
});
```

### Hashing rounds

By default, keyvapory uses 65536 hashing rounds in its key derivation functions, compared to the 262144 gvap uses by default.  (Keyvapory's JSON output files are still compatible with gvap, however, since they tell gvap how many rounds to use.)  These values are user-editable: `keyvapory.constants.pbkdf2.c` is the number of rounds for PBKDF2, and `keyvapory.constants.scrypt.n` is the number of rounds for scrypt.

## Tests

Unit tests are in the `test` directory, and can be run with mocha:

```
npm test
```

`test/gvap.js` is an integration test, which is run (along with `test/keys.js`) using:

```
npm run gvap
```

`gvap.js` generates 1000 random private keys, encrypts each key using a randomly-generated passphrase, dumps the encrypted key info to a JSON file, then spawns a gvap instance and attempts to unlock each account using its passphrase and JSON file.  The passphrases are between 1 and 100 random bytes.  Each passphrase is tested in both hexadecimal and base-64 encodings, and with PBKDF2-SHA256 and scrypt key derivation functions.

By default, the flags passed to gvap are:

```
gvap --vaporbase <account> --unlock <account> --nodiscover --networkid "10101" --port 30304 --rpcport 8547 --datadir test/fixtures --password test/fixtures/.password
```

`test/fixtures/.password` is a file which contains the passphrase.  The `.password` file, as well as the JSON key files generated by `gvap.js`, are automatically deleted after the test.

(Note: `gvap.js` conducts 4000 tests, each of which can take up to 5 seconds, so running this file can take up to 5.56 hours.)

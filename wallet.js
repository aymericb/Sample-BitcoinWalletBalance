// Dependencies
var fs = require("fs");
var _ = require("underscore");
var crypto = require("crypto");
var base58 = require("bs58");
var http = require("http");
var Fiber = require("fibers");
var Future = require("fibers/future");

// Parse command line
var filename = process.argv[process.argv.length-1];
if (!fs.existsSync(filename)) {
    throw new Error("Cannot file file\""+filename+"\"");
}

/**
 * Compute the balance of filename using blockchain.info API and display it in the console.
 */
readWallet( filename, function (err, keys) {
    if (err) throw err;
    
    // Divide addresses in bulks of 200 for multiaddr API
    var address_list =  _.uniq(_.map(keys, convertToAddress));
    var GROUP_LENGTH = 200;     // How many URLs we query with a single API call
    var address_bulks = _.toArray(_.groupBy(address_list, function(addr, idx) { return Math.floor(idx/GROUP_LENGTH); }));

    // Call blockchain.info multiaddr API
    // There is a limit of 159 requests per 5 mins
    var total = 0;
    Fiber( function() {
        var remaining = address_bulks.length;
        var outer_future = new Future();
        _.each(address_bulks, function(address_list) {
            var inner_future = new Future();
            Fiber( function() {
                var url = _.reduce(address_list, function(memo, addr){ return memo+addr+"|"; }, "http://blockchain.info/multiaddr?active=");
                url = url.substring(0, url.length-1);
                http.get(url, function(res) {
                    var data = "";
                    res.on('data', function(chunk) { data += chunk; });
                    res.on('end', function() {
                        var obj = JSON.parse(data);
                        total += _.reduce(obj.addresses, function(memo, addr_json) { return memo+addr_json.final_balance; }, 0);
                        inner_future.return();
                    });
                });
                inner_future.wait();
                if (--remaining === 0)
                    outer_future.return();
            }).run();
        });
        outer_future.wait();
        console.log("Final balance for \"" + filename + "\": "+(total/100000000));  
    }).run();
});

/** 
 * Read a BitcoinQT wallet, and extract all the public keys from the key pool
 */
function readWallet(path, callback) {

    // Enum
    var ParseState = {
        None: {},
        C: {},
        K: {},
        E: {},
    };

    // Read the file
    fs.readFile(path, function(err, data) {
        if (err) {
            callback(err, null);
            return;
        }

        var keys = [];

        // Look for 'ckey' or 'key' in the BerkeleyDB key, but avoid 'mkey'
        // See CWalletDB::ReadKeyValue()
        // Unfortunately, node-bdb does not support Cursors, so we monkey parse the file.
        var state = ParseState.None;
        for (var i=0; i<data.length; ++i) {
            var b = data.readUInt8(i);
            switch(state) {
                case ParseState.None:
                    if (b === 0x63 /*c*/) 
                        state = ParseState.C;
                    else if (b === 0x6b /*k*/ && i>1 && data.readUInt8(i-1) !== 0x6d /*m*/ )
                        state = ParseState.K;   // avoid 'mkey'
                    break;
                case ParseState.C:
                    if (b === 0x6b /*k*/) 
                        state = ParseState.K;
                    else
                        state = ParseState.None;
                    break;
                case ParseState.K:
                    if (b === 0x65 /*e*/)
                        state = ParseState.E;
                    else
                        state = ParseState.None;
                    break;
                case ParseState.E:
                    if (b === 0x79 /*y*/) {
                        state = ParseState.None;                    
                        var length = data.readUInt8(++i);
                        if (length<65) {    
                            // Max length is 32*2+1
                            // See CPubKey::Unserialize in key.h / Bitcoin
                            keys.push(data.slice(++i, length+i));
                        }
                    }
                    else
                        state = ParseState.None;
                    break;
            }
        }

        callback(err, keys);
    });
}


function RIPEMD160(buffer) {
    var hash = crypto.createHash("ripemd160");
    hash.update(buffer);
    return hash.digest();
}

function SHA256(buffer) {
    var hash = crypto.createHash("sha256");
    hash.update(buffer);
    return hash.digest();
}

/** 
 * Convert a public key to a Bitcoin address 
 * See https://en.bitcoin.it/wiki/Technical_background_of_version_1_Bitcoin_addresses
 */
function convertToAddress(key) {
    // Compute Hash 160
    // It does not matter if the key is compressed or not (checked source code)
    var hash160 = RIPEMD160(SHA256(key));

    // Prepend with "0x00"
    var buffer = new Buffer(21);
    buffer[0] = 0x00;           // Main network flag
    hash160.copy(buffer, 1);    // hash160

    // Compute checksum
    var checksum = SHA256(SHA256(buffer));

    // Compute address buffer
    var address_buffer = new Buffer(25);
    buffer.copy(address_buffer);
    checksum.copy(address_buffer, 21);

    // Convert to Base58
    var address_array = [];
    _.each(address_buffer, function(b) { address_array.push(b) } );
    var address = base58.encode(address_array);

    return address;
}



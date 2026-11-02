const dns = require('dns');
const net = require('net');
const fail = require('./serviceError');

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return net.isIP(address) === 6 && /^f[cd]/i.test(address);
}
function privateLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true }, (error, records) => {
    if (error) return callback(error);
    if (
      !records.length ||
      records.some((record) => !isPrivateAddress(record.address))
    )
      return callback(fail('device_address_not_private'));
    if (options?.all) return callback(null, records);
    callback(null, records[0].address, records[0].family);
  });
}
function checkAddress(url) {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname) && !isPrivateAddress(hostname))
    throw fail('device_address_not_private');
  if (hostname === 'localhost') throw fail('device_address_not_private');
}
module.exports = { privateLookup, isPrivateAddress, checkAddress };

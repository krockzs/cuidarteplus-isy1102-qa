// Precarga QA para limitar el servidor HTTP a loopback.
// Ningun archivo de implementacion Cuidarte+ es modificado.
'use strict';
const { Server } = require('node:http');
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  const port = args[0];
  const isPort = typeof port === 'number' || (typeof port === 'string' && /^\d+$/.test(port));
  if (isPort && (typeof args[1] === 'function' || args[1] === undefined)) {
    return listen.call(this, port, '127.0.0.1', ...args.slice(1));
  }
  return listen.apply(this, args);
};

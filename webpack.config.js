const path = require('path');

  module.exports = {
    mode: 'production',
    entry: './js-src/WebDirt.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'WebDirt-packed.js',

     library: {
       name: 'WebDirt',
       type: 'umd',
     },
    },
  };

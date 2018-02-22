'use strict';
const url    = require('url');
const crypto = require('crypto');
const xml2js = require('xml2js');
const js2xml = require('jstoxml');

/**
 * [WeChatServer]
 * @param {[type]}   token    [description]
 * @param {Function} handler [description]
 */
function WeChatServer(token, handler){
  /**
   * [genSignature description]
   * @param  {[type]} token     [description]
   * @param  {[type]} timestamp [description]
   * @param  {[type]} nonce     [description]
   * @return {[type]}           [description]
   */
  function genSignature(token, timestamp, nonce){
    return crypto
      .createHash('sha1')
      .update(([]).slice.call(arguments).sort().join(''))
      .digest('hex');
  }
  /**
   * [parse description]
   * @param  {[type]} data [description]
   * @return {[type]}      [description]
   * @docs http://mp.weixin.qq.com/wiki/17/f298879f8fb29ab98b2f2971d42552fd.html
   */
  function parse(data, callback){
    xml2js.parseString(data, function(err, result){
      callback(err, Object.keys(result.xml).reduce((item, key) => {
        item[ key ] = result.xml[ key ][0];
        return item;
      }, {}));
    });
  };
  /**
   * [send description]
   * @param  {[type]} reply [description]
   * @return {[type]}       [description]
   * @docs http://mp.weixin.qq.com/wiki/1/6239b44c206cab9145b1d52c67e6c551.html
   */
  function sendMsg(res, reply){
    if(!reply) return;
    if(typeof reply == 'string'){
      reply = {
        MsgType : 'text',
        Content : reply
      };
    }
    // reply
    const data = js2xml.toXML({ xml: reply });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Length', new Buffer(data).length);
    res.end(data);
  };
  /**
   * [function description]
   * @param  {[type]} req [description]
   * @param  {[type]} res [description]
   * @return {[type]}     [description]
   */
  return function request(req, res){
    const { query } = url.parse(req.url, true);
    const signature = genSignature(token, query.timestamp, query.nonce);
    if(!(signature == query.signature)) return res.end('Invalidate signature');
    if(req.method === 'GET') return res.end(query.echostr);
    var buffer = ''; req
    .on('error', handler)
    .on('data', chunk => buffer += chunk)
    .on('end', async () => {
      parse(buffer, (err, message) => {
        const send = reply => {
          const { FromUserName, ToUserName } = message;
          sendMsg(res, Object.assign(reply, {
            FromUserName: ToUserName,
            ToUserName  : FromUserName,
            CreateTime  : +new Date,
            MsgId       : ~new Date,
          }));
        };
        send(handler.call({ send }, err, message));
      });
    });
  };
};
/**
 * [exports description]
 * @type {[type]}
 */
module.exports = WeChatServer;

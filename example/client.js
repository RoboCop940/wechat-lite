const WeChat = require('../');
const config = require('kelp-config');

const client = new WeChat.Client({
  appId: 'wx782c26e4c19acffb'
});

client.on('scan', function(){
  console.log('scan success');
});

client.on('login', function(){
  console.log('login success');
});

Promise.resolve()
.then(client.uuid       .bind(client))
.then(client.printQrcode.bind(client))
.then(client.wait       .bind(client))
.then(client.login      .bind(client))
.then(session => client
  .init(session)
  .then(client.loop.bind(client, session)))
.then(function(info){
  console.log(info);
})

/*
  uuid --> print
    |
    V
  wait -> loop -> | input: uuid
    |             |
  login <---------|  input: login url
    |             | output: set-cookie(wxuin|wxsid|webwx_data_ticket)
    V
  init            |  input: 
    |             | output: { User, SyncKey }
    V
  check --------->|  input: { session, synckey }
    |             | output: { retcode, selector }
  sync <--------- |  input: { session, synckey }
                  | output: { SyncKey, AddMsgList }
*/

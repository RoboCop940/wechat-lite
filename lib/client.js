const WeChat = require('.');

const API_LOGIN = 'https://login.weixin.qq.com';

const lowercase = (d) => {
  var o = {};
  for(var k in d) o[ k.toLowerCase() ] = d[k];
  return o;
}

const parseJS = function(code, scope){
  var window = {};
  if(scope){
    window[ scope ] = {};
  }
  eval(code);
  return scope ? window[scope] : window;
};

const cookie = data => {
  return Object.keys(data).map(key => {
    return [ key, data[ key ] ].join('=');
  }).join('; ');
};

const BaseRequest = data => {
  return {
    Skey     : '' ,
    Uin      : data.wxuin,
    Sid      : data.wxsid,
    DeviceID : `e${data.wxsid}`
  };
};

const uuid = (appid) => {
  return WeChat.request(API_LOGIN + '/jslogin', {
    query: { appid },
  }).then(res => parseJS(res.text(), 'QRLogin').uuid)
};

const status = uuid => {
  return WeChat.request(API_LOGIN + '/cgi-bin/mmwebwx-bin/login', {
    query: { uuid }
  }).then(res => parseJS(res.text()))
};

const login = url => {
  return WeChat.request(url).then(({ headers }) => {
    const cookies = headers['set-cookie'];
    return (Array.isArray(cookies) ? cookies : [ cookies ])
    .filter(cookie => /wxuin|wxsid|webwx_data_ticket/.test(cookie))
    .map(cookie => cookie.split(';')[0].split('='))
    .reduce((data, [ key, value ]) => {
      data[ key ] = value;
      return data;
    }, {});
  });
};

const init = session =>  {
  return WeChat.request(API_LOGIN + '/cgi-bin/mmwebwx-bin/webwxinit', {
    method: 'post',
    headers: { Cookie: cookie(session) },
    body: { BaseRequest: BaseRequest(session) },
  }).then(res => res.json())
};

const check = (session, synckey) => {
  const query = Object.assign(lowercase(BaseRequest(session)), {
    synckey: synckey.List.map(({ Key, Val }) => [ Key, Val ].join('_')).join('|')
  });
  query.r = ~new Date;
  query._ = +new Date;
  return WeChat.request('https://webpush.weixin.qq.com/cgi-bin/mmwebwx-bin/synccheck', { 
    query,
    headers: { Cookie: cookie(session) },
  })
  .then(res => res.text())
  .then(text => {
    var d = text.split('=');
    if(d.length == 2){
      var v = d[1];
      v = v.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ');
      return JSON.parse(v);
    }
  });
};

const sync = (session, SyncKey) => {
  return WeChat.request(`${API_LOGIN}/cgi-bin/mmwebwx-bin/webwxsync`, {
    method: 'post',
    headers: { Cookie: cookie(session) },
    body: {
      BaseRequest: BaseRequest(session), SyncKey
    }
  }).then(res => res.json())
};

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
                  | output: { SyncKey , AddMsgList }
*/
module.exports = ({ appId }) => {
  const wechat = new WeChat({ appId });
  uuid(appId)
  .then(uuid => {
    wechat.emit('qrcode', `${API_LOGIN}/qrcode/${uuid}`);
    return uuid;
  })
  .then(function next(uuid){
    status(uuid).then(st => {
      switch(st.code){
        case 200:
          wechat.emit('auth', st);
          break;
        case 201:
          wechat.emit('scan', st);
        case 408:
          // 未确认（显示二维码后30秒触发）
        default:
          next(uuid);
          break;
      }
    });
  });

  wechat.once('auth', ({ redirect_uri }) => {
    login(redirect_uri)
    .then(session => wechat.session = session)
    .then(init)
    .then(userData => {
      wechat.emit('login', userData);
      return Object.assign(wechat, userData);
    })
    .then(function next({ session, SyncKey }){
      check(session, SyncKey).then(({ retcode, selector }) => {
        console.log('sync status:', retcode, selector);
        switch(parseInt(retcode, 10)){
          case 0:
            setTimeout(() => next(wechat), 200);
            break;
          case 1100:
            wechat.emit('logout');
            break;
          case 1101:
            wechat.emit('kickout');
            break;
          default:
            console.error('sync check failed', retcode);
            break;
        }
        switch (parseInt(selector, 10)) {
          case 0:
            // nothing
            break;
          case 6:
            // message response?
            break;
          case 2:
            wechat.emit('new-message');
            break;
          case 7:
            // session active
            break;
          default:
            console.error('unknow selector', selector);
            break;
        }
      });
    })
  });

  wechat.on('new-message', () => {
    const { session, SyncKey } = wechat;
    sync(session, SyncKey)
    .then(response => {
      Object.assign(wechat, response);
      return response;
    })
    .then(({ AddMsgList }) => {
      AddMsgList.forEach(msg => wechat.emit('message', msg));
    })
  });
  return wechat;
};

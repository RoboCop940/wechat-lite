const WeChat = require('..');
const config = require('kelp-config');

const client = WeChat.Client({
  appId: 'wx782c26e4c19acffb'
});

client.once('qrcode', url => {
  console.log('[WeChat]>', url);
});

client.on('scan', () => {
  console.log('[WeChat]> scan');
});

client.on('login', user => {
  console.log('[WeChat]> login success');
});

client.on('message', msg => {
  const [ from ] = client.ContactList.filter(x => x.UserName === msg.FromUserName);
  console.log('[%s]>', from.NickName, msg.Content);
});
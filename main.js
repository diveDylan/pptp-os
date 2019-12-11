const {
  app,
  BrowserWindow,
  ipcMain,
  shell
} = require('electron')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const process = require('process')
const path = require('path')
const adapter = new FileSync(path.resolve(__dirname, 'vpn.json'))
const { exec } = require('child_process')
const db = low(adapter)
const replyHandler = require('./replyHandler')
const fs = require('fs')


// 垃圾回收的时候，window对象将会自动的关闭
let win
function dbCache(arg) {
  if (!db.get('default').value().vpn) {
    db.set('default', arg)
      .write()
  } else if(db.get('default').value().vpn === arg.vpn) {
    db.update('default', arg)
      .write()
  } else {
    db.get('vpnList')
      .push(arg)
      .write()
  }
}

function makeVpnConfig({password, vpn, username}) {
  return `plugin PPTP.ppp noauth remoteaddress "${vpn}" user "${username}" password "${password}" redialcount 1 redialtimer 5 idle 1800 # mru 1368 # mtu 1368 receive-all novj 0:0 ipcp-accept-local ipcp-accept-remote refuse-eap refuse-pap refuse-chap-md5 hide-password mppe-stateless mppe-128 # require-mppe-128 looplocal nodetach nopersist ms-dns 8.8.8.8 usepeerdns # ipparam gwvpn defaultroute debuge welcome exit`
  
}
const logFile = (arg) => path.resolve(__dirname, `vpn.log.text`)
const vpnMap = new Map()
// switch pppd status
ipcMain.on('switch-pptp', (event, arg) => {
  dbCache(arg)
  // switch status to kill && the vpn must be on
  if(arg.type === 'kill' && vpnMap.get(arg.vpn)) {
    vpnMap.get(arg.vpn).kill()
    kill(arg.rootpassword, () => {
      event.reply('pptp-reply',  {
        code: '01',
        message: 'pppd disconnected'
      })
    })
    return ;
  }

  fs.writeFile(logFile(arg.vpn), '', (err) => {
    if(err)event.reply('pptp-reply', replyHandler('02', err, 'logfile'))
  })
  fs.writeFile( path.resolve(__dirname, `vpn.pplware`),makeVpnConfig(arg), err => {
      if (err) {
        event.reply('pptp-reply', replyHandler('02', err))
        return
      }
     
      console.log('active')
      const vpn = exec(` echo ${arg.rootpassword} | sudo -S pppd call ${arg.vpn}.pplware`, {
        cwd: process.cwd(),
      })
  
      vpn.stdout.on('data', (data) => {
        const successLogContent = ' pptp_wait_input: Address added. previous interface setting'
        const failLogContent = 'PPTP disconnected'
        fs.appendFile(logFile(arg.vpn), data, () => {})
        if(data.indexOf(successLogContent) != -1) {
          event.reply('pptp-reply', replyHandler('00'))
          fs.readFile(logFile(arg.vpn), 'utf8', (err, data) => {
            console.log(err,data)
            if(!err) event.reply('log-detail', data)
          })
          vpnMap.set(arg.vpn, vpn)
        }
        if(data.indexOf(failLogContent) != -1) {
          event.reply('pptp-reply', replyHandler('01'))
          fs.readFile(logFile(arg.vpn), 'utf8', (err, data) => {
            console.log(err,data)
            if(!err) event.reply('log-detail', data)
          })
        }
      })
      vpn.stderr.on('error', err => {
        console.log('vpn connect Error:', err)
      })
  })
})
ipcMain.on('view-log', (event, arg) => {
  console.log(process.cwd())
  shell.openExternal( process.cwd() + '/vpn.log.text')
})

function kill(arg, cb) {
  const killProcess = exec(`echo ${arg} | sudo -S killall pppd`, {
    timeout: 100000,
    cwd: process.cwd()
  })
  killProcess.stdout.on('data', data => {
    console.log('kill',data)
  })
  killProcess.stderr.on('err', err => {
    console.log('error kill', err)
  })
  killProcess.on('exit',() => {
    cb()
  })
}

ipcMain.on('kill-all', (event, arg) => {
  kill(arg, () => {
    event.reply('reply-kill-all',  {
      code: '00',
      message: 'pppd process all killed'
    })
  })
})

app.on('ready', () => {
  createWindow()
})

function createWindow () {
  // 创建浏览器窗口。
  // Set some defaults (required if your JSON file is empty)
  db.defaults({ vpnList: [],default: {}})
  .write()
  
  win = new BrowserWindow({
    width: 380,
    height: 400,
    webPreferences: {
      nodeIntegration: true
  }
  })
  
  ipcMain.on('fetch-setting', (event, arg) => {
    event.reply('get-setting',  {
      default: db.get('default').value() || {},
      vpnList: db.get('vpnList').value()
    })
  })
  
  
  // 加载index.html文件
  win.loadFile('index.html')

  // 打开开发者工具
  // win.webContents.openDevTools()

  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })
}


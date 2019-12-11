/**
 * write a file for event reply
 */

const REPLY_MAP = {
   '00': {
     code: '00',
     content: null,
     message: 'pptp call success'
   },
   '01': {
     code: '01',
     content: null,
     message: 'pptp call failed'
   },
   '02': {
     code: '02',
     content: null,
     message: 'write pptp config file failed'
   },
   '03': {
      code: '03',
      content: null,
      message: 'permission denined'
   },
   '04': {
      code: '04',
      content: null,
      message: 'pppd call process closed'
   },
   '05': {
      code: '05',
      content: null,
      message: 'pppd call process killed'
   },
   
 }

 module.exports = (code, message, content) => {
  const RES = REPLY_MAP[code]
  if (content) RES.content = content
  if (message) RES.message = message
  return RES
 }
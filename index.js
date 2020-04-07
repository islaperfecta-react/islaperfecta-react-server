
var mongoose = require('mongoose');
const bodyParser = require('body-parser');
var Schema = mongoose.Schema;

var messageSchema = new Schema({
  username: String,
  uid: String,
  color: String,
  message: String,
  faved_by: [String]
  },
  {
    collection: 'chatrecicla-react',
    timestamps: true   //<-- esta es una forma más estandarizada de guardar marcas de tiempo
  }
)

var atSchema = new Schema({
  to: [String],
  message: String,
  from: String
},
  {
    collection: 'chatrecicla-react-ats',
    timestamps: true
  })
var bansSchema = new Schema({
  username: String,
  ip: String
},
  {
    collection: 'chatrecicla-react-bans',
    timestamps: true
  }
)
var Message = mongoose.model('Message', messageSchema)
var Ats = mongoose.model('At', atSchema)
var Bans = mongoose.model('Bans', bansSchema)

mongoose.connect("mongodb+srv://justo:fn231093@cluster0-syxf1.mongodb.net/test?retryWrites=true&w=majority", { autoIndex: false, useNewUrlParser: true, useUnifiedTopology: true, dbName: 'chatrecicla'});

var express = require('express');
var socket = require('socket.io');

var app = express();
const PORT = process.env.PORT || 8080;
server = app.listen(PORT, function(){
    console.log('server is running on port ' + PORT);
});
var banList = [];
Bans.find().then( result => { banList.push(result)})
io = socket(server)
var username = "👻"
function isBanned(ip, name){
  let returnTrueIfBanned = false;
  banList.map( banned => {
    if(banned.ip === ip || banned.username === name) {returnTrueIfBanned = true}
    console.log('banned')
    console.log(banned)
  })
  console.log('returntrueifbanned:')
  console.log(returnTrueIfBanned)
  console.log('banList:')
  console.log(banList)
  return returnTrueIfBanned
}
function refreshBans(){
  banList = []
Bans.find().then( result => { banList.push(result)})
}
io.on('connection', (socket) => {
    // Encontrar mensages de la historia y emit ellos al app
    socket.username = username
    Message.find()
    .sort({_id: 'DESC'})
    .limit(30)
    .then(messages => {
        socket.emit('RECEIVE_MESSAGE', messages, 'history');
    }).catch(err => {
        console.log(err);
    })
    socket.on('NEW_USER', function(data){
      data.username !== null? socket.username = data.username : null
      sendUserList()
    })
    socket.on('NEW_USERNAME', function(data){
      socket.username !== null? socket.username = data.username : null
      sendUserList()
    })
    socket.on('GET_NEW_MESSAGES', function(data){ //added this method to handle idles
      Message.find({ _id: { $gt: data.lastMsgID } })
      .sort({_id: 'DESC'})
      .then(messages => {
        socket.emit('RECEIVE_MESSAGE', messages, 'get_new_messages')
      }).catch(err => {
        console.log(err);
      })
    })
    const sendUserList = () => {
      var newUserlist = []
      const allClients = Object.keys(io.sockets.sockets)
      allClients.map( (clientId) =>{
        newUserlist.push(io.sockets.sockets[clientId].username)
      })
      socket.emit('NEW_USERLIST', newUserlist)
      socket.broadcast.emit('NEW_USERLIST', newUserlist)
    }
      socket.on('disconnect', (reason) => {
      socket.broadcast.emit('GONE_USER', socket.username)
      })
    // Escuchar para nuevos mensajes
    socket.on('SEND_MESSAGE', function(data){
        const msg = new Message(data);
        msg.uid = socket.handshake.headers['x-forwarded-for'];
        console.log(msg.username + ': ' + msg.uid);
        if(msg.message.indexOf('/ban ') === 0 && (msg.username === "kiny" || msg.username === "justo")){
          const user2ban = msg.message.substr(5);
          console.log('user2ban')
          console.log(user2ban)
          const lastIp = Message.find({username: user2ban})
          .sort({_id: 'DESC'})
          .limit(1)
          .then( result => {
          const newBan = new Bans({username: result[0].username, ip: result[0].uid})
          console.log(result)
          newBan.save()
          .then( () => {refreshBans() });
          })
          return
        }
        if(!isBanned(socket.handshake.headers['x-forwaded-for'], msg.username)){
        msg.save()
        .then( function(savedMessage){
        socket.emit('RECEIVE_MESSAGE', savedMessage, 'message')
        socket.broadcast.emit('RECEIVE_MESSAGE', savedMessage, 'message')
      })
      }
    })
    socket.on('SEND_AT', function(data){
      const newAt = new Ats(data)
      newAt.save()
      console.log(newAt)
    })
    socket.on('GET_ATS', function(data){
      const myAts = Ats.find({to: data.username}).sort({createdAt: 'DESC'})
      .then(foundAts => {
        socket.emit('GOT_ATS', foundAts)
      })
    })
    socket.on('GET_MORE_HISTORY', function(data){
      Message.find({ _id: { $lt: data.firstMsgID } })
      .sort({_id: 'DESC'})
      .limit(30)
      .then(messages => {
        socket.emit('RECEIVE_MESSAGE', messages, 'more_history', data.username)
      }).catch(err => {
        console.log(err);
      })
    })
    socket.on('GET_FAVS', async function(user){
      const favedByUser = await Message.find({ faved_by: user}).sort({updatedAt: 'DESC'}).select('message')
      socket.emit('GOT_FAVS', favedByUser)
    })
    socket.on('FAV_MESSAGE', async function(data){
      const favedMessage = await Message.findOne({_id: data._id})

      const alreadyFaved = favedMessage.faved_by.indexOf(data.username)
      if( alreadyFaved !== -1){
        favedMessage.faved_by.splice(alreadyFaved, 1)
      }
      else{
        favedMessage.faved_by.push(data.username)
      }
      favedMessage.save()
      .then( function(favedMsg){
        if( alreadyFaved === -1 ){
          socket.emit('FAVED_MESSAGE', favedMsg, data.username)
          socket.broadcast.emit('FAVED_MESSAGE', favedMsg, data.username)
        }
        else{
          socket.emit('UNFAVED_MESSAGE', favedMsg)
        }
      })
    })
  })

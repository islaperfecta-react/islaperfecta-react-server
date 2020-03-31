
var mongoose = require('mongoose');
const bodyParser = require('body-parser');
var Schema = mongoose.Schema;

var messageSchema = new Schema({
  username: String,
  uid: String,
  color: String,
  message: String,
  timestamp: Date,
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

var Message = mongoose.model('Message', messageSchema);
var Ats = mongoose.model('At', atSchema);

mongoose.connect("mongodb+srv://justo:fn231093@cluster0-syxf1.mongodb.net/test?retryWrites=true&w=majority", { autoIndex: false, useNewUrlParser: true, dbName: 'chatrecicla'});

var express = require('express');
var socket = require('socket.io');

var app = express();
const PORT = process.env.PORT || 8080;
server = app.listen(PORT, function(){
    console.log('server is running on port ' + PORT);
});

io = socket(server);

io.on('connection', (socket) => {
    // Encontrar mensages de la historia y emit ellos al app
    Message.find()
    .sort({timestamp: 'DESC'})
    .limit()
    .then(messages => {
        socket.emit('RECEIVE_MESSAGE', messages, 'history');
    }).catch(err => {
        console.log(err);
    });
    // Escuchar para nuevos mensajes
    socket.on('SEND_MESSAGE', function(data){
        const msg = new Message(data);
        msg.save()
        .then( function(savedMessage){
        socket.emit('RECEIVE_MESSAGE', savedMessage, 'message')
        socket.broadcast.emit('RECEIVE_MESSAGE', savedMessage, 'message')
      })
    })
    socket.on('SEND_AT', function(data){
      const newAt = new Ats(data)
      newAt.save()
      console.log(newAt)
    })
    socket.on('GET_ATS', function(data){
      const myAts = Ats.find({to: data.username})
      .then(foundAts => {
        socket.emit('GOT_ATS', foundAts)
      })
    })
    socket.on('GET_HISTORY', function(data){
    Message.find()
    .sort({timestamp: 'DESC'})
    .skip(data.msgLoaded)
    .limit(30)
    .then(messages => {
      socket.emit('RECEIVE_MESSAGE', messages, 'history')
    }).catch(err => {
      console.log(err);
    })
    })
    socket.on('GET_FAVS', async function(user){
      const favedByUser = await Message.find({ faved_by: user}).select('message')
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

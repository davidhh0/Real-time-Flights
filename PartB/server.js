
const express = require('express')
const app = express();
const socketIO = require('socket.io');
const fs = require('fs');
const redis = require('redis');
const client = redis.createClient();
client.connect();



const server = express()
  .use(app)
  .listen(3000, () => console.log(`Listening Socket on http://localhost:3000`));
const io = socketIO(server);

app.get('/setData/:districtId/:value', function (req, res) {
  io.emit('newdata', { districtId: req.params.districtId, value: req.params.value })
  res.send(req.params.value)
})

function insert_to_redis(data){
  for (var i = 0; i < data.length; i++) {
      var key = data[i]['id']
      client.set(key,JSON.stringify(data[i]));
  }
}



const Kafka = require("node-rdkafka");

const kafkaConf = {
  "group.id": "cloudkarafka-example",
  "metadata.broker.list": "rocket-01.srvs.cloudkafka.com:9094,rocket-02.srvs.cloudkafka.com:9094,rocket-03.srvs.cloudkafka.com:9094".split(","),
  "socket.keepalive.enable": true,
  "security.protocol": "SASL_SSL",
  "sasl.mechanisms": "SCRAM-SHA-256",
  "sasl.username": "el6ggtvk",
  "sasl.password": "nIztyaDYg7QPIgvGpRz_01YPjv9dq1As",
  "debug": "generic,broker,security"
};

const prefix = "el6ggtvk-";

const topics = [`${prefix}mongotoredis`];
const consumer = new Kafka.KafkaConsumer(kafkaConf, {
  "auto.offset.reset": "beginning"
});
consumer.on("error", function (err) {
  console.error(err);
});
consumer.on("ready", function (arg) {
  console.log(`Consumer ${arg.name} ready`);
  consumer.subscribe(topics);
  consumer.consume();
});
consumer.on("data", function (m) {
  var ob = JSON.parse(m.value.toString());
  console.log('RECEIVED DATA FROM KAFKA !!!');
  
  io.emit('newdata', { theData:ob });
  io.emit('landing' , {theData: filterByIsrael(ob)});
  io.emit('takeoff', {theData:filterByNotIsrael(ob)});
  insert_to_redis(ob);


});
consumer.on("disconnected", function (arg) {
  process.exit();
});
consumer.on('event.error', function (err) {
  console.error(err);
  process.exit(1);
});
consumer.on('event.log', function (log) {
  //   console.log(log);
});
consumer.connect();


const port = 3000;

io.on('connection', socket => {
  socket.on('redis_get_info', data => {
    console.log('hey', data);
  });
});

app.use(express.static('public'))

app.set('view engine', 'ejs')

/*
HOw to know if a flight is "waiting to take off:"
isground = 1 && from israel
*/
app.get('/', (req, res) => {
  res.render("pages/dashboard")
})

function filterByIsrael(theJson) {
  var dict = [];
  for (var i = 0; i < theJson.length; i++) {
    var obj = theJson[i];
    if (obj['des_country'] == 'Israel') {
      dict.push(obj);
    }
  }
  return dict;
}

function filterByNotIsrael(theJson) {
  var dict = [];
  for (var i = 0; i < theJson.length; i++) {
    var obj = theJson[i];
    if (obj['fromport'] == 'TLV'  && obj['isground'] == 1) {
      dict.push(obj);
    }
  }
  return dict;
}


app.get('/takeoff', (req, res) => {
  fs.readFile('/home/david/Documents/base64.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    let theJson = JSON.parse(text)
    console.log("GET ---> LANDING");
    var landingFlights = filterByNotIsrael(theJson)
    res.send(landingFlights);

  });

}
)




app.get('/landing', (req, res) => {
  fs.readFile('/home/david/Documents/base64.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    let theJson = JSON.parse(text)
    console.log("GET ---> LANDING");
    var landingFlights = filterByIsrael(theJson)
    res.send(landingFlights);

  });

}
)





const express = require('express')
const app = express();
const socketIO = require('socket.io');
const fs = require('fs');
const redis = require('redis');
const client = redis.createClient();
const bigml = require('bigml');



client.connect();


let redis_value = '{}';
var connection = new bigml.BigML('flightpro2022', '3564af0744fe46d9aa38f42e2d54028b3d42910c');
var prediction = new bigml.Prediction(connection);

// ====
async function getPrediction(){
  let modelInfo = await client.get('model_info');
  modelInfo = JSON.parse(modelInfo);
  let pred = '';
  // extraLate , normal , Late 

  prediction.createAndWait(modelInfo, {"period": "Summer",  "month": 7,  "dayofweek": "Thursday",  
  "airlinename": "European Air Charter",  "ori_country": "Israel", 
  "des_country": "Bulgaria",  "distancetype": "short",  "ori_weather": 31.57,  "des_weather": 27.9},
  function (error, result) {
  if (!error && result)
       pred = result.object.output;
  }
  );
  while (pred == ''){}
  return pred;
}


let v = getPrediction()


async function get_redis_value(key){
    const value =  client.get(key);

await value.then((response) =>{

  redis_value = response;
    
});
}
async function aux_redis_value(key){
    await get_redis_value(key);
}

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
      var key = data[i]['sign']
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
const consumer_modelinfo = new Kafka.KafkaConsumer(kafkaConf, {
  "auto.offset.reset": "beginning"
});

consumer_modelinfo.on("error", function (err) {
  console.error(err);
});
consumer.on("error", function (err) {
  console.error(err);
});

consumer_modelinfo.on("ready", function (arg) {
  console.log(`Consumer ${arg.name} ready`);
  consumer_modelinfo.subscribe([prefix+'modelinfo']);
  consumer_modelinfo.consume();
});
consumer.on("ready", function (arg) {
  console.log(`Consumer ${arg.name} ready`);
  consumer.subscribe(topics);
  consumer.consume();
});

// ==


consumer.on("data", function (m) {
  var ob = JSON.parse(m.value.toString());
  console.log('RECEIVED DATA FROM KAFKA !!!');
  io.emit('newdata', { theData:ob });
  io.emit('landing' , {theData: filterByIsrael(ob)});
  io.emit('takeoff', {theData:filterByNotIsrael(ob)});
  insert_to_redis(ob);
});
consumer_modelinfo.on("data", function (m) {
  console.log('RECEIVED DATA model info!@#!@!@# !!!');
  var ob = JSON.parse(m.value.toString());
  client.set('model_info',JSON.stringify(ob));
  console.log(ob);
  
});

// ==

consumer.on("disconnected", function (arg) {
  process.exit();
});

consumer_modelinfo.on("disconnected", function (arg) {
  process.exit();
});


consumer.on('event.error', function (err) {
  console.error(err);
  process.exit(1);
});

consumer_modelinfo.on('event.error', function (err) {
  console.error(err);
  process.exit(1);
});



consumer.on('event.log', function (log) {
  //   console.log(log);
});

consumer_modelinfo.on('event.log', function (log) {
  //   console.log(log);
});
consumer.connect();
consumer_modelinfo.connect();

const port = 3000;

io.on('connection', socket => {
  socket.on('redis_get_info', data => {
    aux_redis_value(data['key']);
    //console.log('hey', redis_value);
    io.emit('redis_receive_info',JSON.parse(redis_value));
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
      let pred = getPrediction();
      console.log(pred);
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



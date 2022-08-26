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
function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}


// ====
async function getPrediction(json){
  let modelInfo = await client.get('model_info');
//  let modelInfo = "{\"code\":201,\"object\":{\"boosted_ensemble\":false,\"boosting\":{},\"category\":0,\"cluster\":null,\"cluster_status\":false,\"code\":201,\"columns\":11,\"configuration\":null,\"configuration_status\":false,\"created\":\"2022-08-20T16:13:03.558962\",\"creator\":\"flightpro2022\",\"dataset\":\"dataset/6301080b969fe93080001027\",\"dataset_field_types\":{\"categorical\":7,\"datetime\":0,\"image\":0,\"items\":0,\"numeric\":3,\"path\":0,\"preferred\":8,\"regions\":0,\"text\":1,\"total\":11},\"dataset_status\":true,\"depth_threshold\":512,\"description\":\"\",\"ensemble\":false,\"ensemble_id\":\"\",\"ensemble_index\":0,\"excluded_fields\":[],\"fields_meta\":{\"count\":0,\"limit\":1000,\"offset\":0,\"total\":0},\"focus_field\":null,\"input_fields\":[],\"locale\":\"en-US\",\"max_columns\":11,\"max_rows\":340,\"missing_splits\":false,\"model\":{\"depth_threshold\":512,\"kind\":\"mtree\",\"node_threshold\":512},\"name\":\"bigmlData\",\"name_options\":\"512-node, deterministic order\",\"node_threshold\":512,\"number_of_batchpredictions\":0,\"number_of_evaluations\":0,\"number_of_predictions\":0,\"number_of_public_predictions\":0,\"objective_field\":null,\"objective_field_name\":null,\"objective_field_type\":null,\"optiml\":null,\"optiml_status\":false,\"ordering\":0,\"out_of_bag\":false,\"price\":0,\"private\":true,\"project\":null,\"randomize\":false,\"range\":null,\"replacement\":false,\"resource\":\"model/6301080f56870924a8000d08\",\"rows\":340,\"sample_rate\":1,\"shared\":false,\"size\":26544,\"source\":\"source/63010807bf85ee1257000ccb\",\"source_status\":true,\"split_candidates\":32,\"split_field\":null,\"status\":{\"code\":1,\"message\":\"The model creation request has been queued and will be processed soon\",\"progress\":0},\"subscription\":false,\"support_threshold\":0,\"tags\":[],\"type\":0,\"updated\":\"2022-08-20T16:13:03.558993\",\"white_box\":false},\"resource\":\"model/6301080f56870924a8000d08\",\"location\":\"https://bigml.io/andromeda/model/\",\"error\":null}"

   modelInfo = JSON.parse(modelInfo);
   let pred = '';
  // // extraLate , normal , late 

  prediction.create(modelInfo, json,
  function (error, result) {
  if (!error && result){
      pred = result.object.output;
  }
  }
  );
  await sleep(3000);
  
  return pred;
}




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
const { ConnectionClosedEvent } = require('mongodb');

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


consumer.on("data", async function (m) {
  var ob = JSON.parse(m.value.toString());
  console.log('RECEIVED DATA FROM KAFKA !!!');
  io.emit('newdata', { theData:ob });
  io.emit('landing' , {theData: await filterByIsrael(ob)});
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

/*
{"period": "Summer",  "month": 7,  "dayofweek": "Thursday",  
  "airlinename": "European Air Charter",  "ori_country": "Israel", 
  "des_country": "Bulgaria",  "distancetype": "short",  "ori_weather": 31.57,  "des_weather": 27.9}
*/

// normal, late, extraLate

async function filterByIsrael(theJson) {
  var dict = [];
  
  for (var i = 0; i < theJson.length; i++) {
    var obj = theJson[i];
    if (obj['des_country'] == 'Israel') {
      let v = await getPrediction( {'period':obj['period'] , 'month': obj['month'],'dayofweek':obj['dayofweek'] ,
                         'airlinename':obj['airlinename'],'ori_country':obj['ori_country'],
                          'des_country':obj['des_country'],'distancetype':obj['distancetype'],
                        'ori_weather':obj['ori_weather'], 'des_weather':obj['des_weather']  })
      obj['pred'] = v;
      console.log(v);
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



const mongo = require('mongodb');
const Kafka = require("node-rdkafka");
const bigml = require('bigml');
const fs = require('fs');
const fastcsv = require('fast-csv');

var MongoClient = mongo.MongoClient;

var url = "mongodb://localhost:27017/";

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

var connection = new bigml.BigML('flightpro2022', '3564af0744fe46d9aa38f42e2d54028b3d42910c');

function getEssential(obj) {
  var res = new Object();
  res._id = obj.flightkey;
  res.period = obj.period;
  res.month = obj.month;
  res.dayofweek = obj.dayofweek;
  res.airlinename = obj.airlinename;
  res.ori_country = obj.ori_country;
  res.des_country = obj.des_country;
  const distanceinkm = obj.distanceinkm;
  if (distanceinkm < 1500){
    res.distancetype = "short";
  } else if (distanceinkm < 3500) {
    res.distancetype = "medium";
  } else {
    res.distancetype = "long";
  }
  res.ori_weather = obj.ori_weather;
  res.des_weather = obj.des_weather;
  const minuteslate = obj.minuteslate;
  if (minuteslate < 15) {
    res.arivaltype = "normal";
  } else if (minuteslate < 60) {
    res.arivaltype = "late";
  } else {
    res.arivaltype = "extraLate";
  }
  return res;
}

function mongoSave(ob){
  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("flightsDB");
    dbo.collection("flights").insertOne(ob, function(err, res) {
      if (err) throw err;
      console.log("1 document inserted in flight");
    });
    
    dbo.collection("bigml").insertOne(getEssential(ob), function(err, res) {
      if (err) {
        dbo.collection("bigml").updateOne({"_id": ob.flightkey}, {$set: getEssential(ob)}, function(err, res) {
          if (err) throw err;
          console.log("1 document updated in bigml");
          db.close();
        });
      } else {
        console.log("1 document inserted in bigml");
        db.close();
      }
    });
    
  });
}

function createModel(){
  var source = new bigml.Source(connection);
    source.create('./bigmlData.csv', function(error, sourceInfo) {
      if (!error && sourceInfo) {
        var dataset = new bigml.Dataset(connection);
        dataset.create(sourceInfo, function(error, datasetInfo) {
          if (!error && datasetInfo) {
            var model = new bigml.Model(connection);
            model.create(datasetInfo, function (error, modelInfo) {
              if (!error && modelInfo) {
                // var prediction = new bigml.Prediction(connection);
                // prediction.create(modelInfo, {"period": "Summer",  "month": 7,  "dayofweek": "Thursday",  "airlinename": "European Air Charter",  "ori_country": "Israel",  "des_country": "Bulgaria",  "distancetype": "short",  "ori_weather": 31.57,  "des_weather": 27.9}, function (error, result) {
                //   if (!error && result)
                //     console.log(result.object.output);
                // });
              }
            });
          }
        });
      }
    });
}

function wirteMongoToCSV(){
  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("flightsDB");
    dbo.collection("bigml").find({}).toArray(function(err, res) {
      if (err) throw err;
      var ws = fs.createWriteStream("bigmlData.csv");
      fastcsv.write(res, { headers: true }).on("finish", function() {
        console.log("Write to bigmlData.csv successfully!");
      }).pipe(ws);
      db.close();
    });
  });
}

//----------------------------------------------------------

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

async function main(){
  var flag = true;
  if (flag) {
    const topics = [`${prefix}sqltomongo`];
    const consumer = new Kafka.KafkaConsumer(kafkaConf, {
      "auto.offset.reset": "beginning"
    });

    consumer.on("error", function(err) {
      console.error(err);
    });
    consumer.on("ready", function(arg) {
      console.log(`Consumer ${arg.name} ready`);
      consumer.subscribe(topics);
      consumer.consume();
    });
    consumer.on("data", function(m) {
      var ob = JSON.parse(m.value.toString());
      mongoSave(ob);
    });
    consumer.on("disconnected", function(arg) {
      process.exit();
    });
    consumer.on('event.error', function(err) {
      console.error(err);
      process.exit(1);
    });
    consumer.on('event.log', function(log) {
    //   console.log(log);
    });
    consumer.connect();
  } else {
    wirteMongoToCSV();
    await sleep(2000);
    createModel();
  }
}

main();
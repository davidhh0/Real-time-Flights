const axios = require('axios');
const Kafka = require("node-rdkafka");
const mysql = require('mysql');

//------------------------------------------------

const kafkaConf = {
  "group.id": "cloudkarafka-project",
  "metadata.broker.list": "rocket-01.srvs.cloudkafka.com:9094,rocket-02.srvs.cloudkafka.com:9094,rocket-03.srvs.cloudkafka.com:9094".split(","),
  "socket.keepalive.enable": true,
  "security.protocol": "SASL_SSL",
  "sasl.mechanisms": "SCRAM-SHA-256",
  "sasl.username": "el6ggtvk",
  "sasl.password": "nIztyaDYg7QPIgvGpRz_01YPjv9dq1As",
  "debug": "generic,broker,security"
};

const prefix = "el6ggtvk-";

const topic = `${prefix}sqltomongo`;
const producer = new Kafka.Producer(kafkaConf);


producer.on("ready", function(arg) {
  console.log(`producer ${arg.name} ready.`);
});

producer.on("disconnected", function(arg) {
  process.exit();
});

producer.on('event.error', function(err) {
  console.error(err);
  process.exit(1);
});
producer.on('event.log', function(log) {
//   console.log(log);
});
producer.connect();

//------------------------------------------------

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "data"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

//------------------------------------------------

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

async function getTime(){
  const date = new Date();
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayofweek = days[date.getDay()];
  const mounth = date.getMonth() + 1;
  var sdate = date.toISOString().split('T')[0];
  let period;
  if (mounth == 7 || mounth == 8){
    period = "Summer";
  } else{
    const config_date = {
      method: 'get',
      url: 'https://www.hebcal.com/converter?cfg=json&g2h=1&strict=1&date=' + sdate,
      responseType: 'json'
    }
    let res_date = await axios(config_date);
    res_date = res_date.data;
    if (Object.values(res_date["events"]).length > 1){
      period = res_date["events"][0];
    } else{
      period = "Reular";
    }
  }
  return [period, dayofweek, mounth];
}

async function getWeather(lat, lng){
  const config_weather = {
    method: 'get',
    url: 'https://api.openweathermap.org/data/2.5/weather?appid=15fb5ab1185d5953f6ce301bf8ea131b&units=metric&lat=' + lat + '&lon=' + lng,
    responseType: 'json'
  }
  try {
    let res_weather = await axios(config_weather);
    res_weather = res_weather.data;
    return res_weather["main"]["temp"];
  } catch (error) {
    console.warn("---------------------------------------------------------------error-openweathermap")
  }
  return "error";
}

var weatherDic = {};
async function getWeatherSmart(lat, lng, sloc){
  if (weatherDic[sloc] == null){
    // console.log("new");
    weatherDic[sloc] = await getWeather(lat, lng);
  }
  return weatherDic[sloc];
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function millisToMinutes(millis) {
  var minutes = Math.floor(millis / 60);
  return minutes;
}

async function savetosql(flight){
    var sql = `INSERT INTO flights (flightkey, id, lat, lng, orientaion, alt, speed, squ, stat, planetype, planeid, updatetime, fromport, toport, num, isground, vspeed, sign, airlinecode, airlinename, ori_country, ori_city, ori_offset, ori_lat, ori_lng, ori_weather, des_country, des_city, des_offset, des_lat, des_lng, des_weather, distanceinkm, scheduled_dep, scheduled_arr, real_dep, real_arr, estimated_dep, estimated_arr, minuteslate, period, dayofweek, month) VALUES ("${flight.flightkey}", "${flight.id}", "${flight.lat}", "${flight.lng}", "${flight.orientaion}", "${flight.alt}", "${flight.speed}", "${flight.squ}", "${flight.stat}", "${flight.planetype}", "${flight.planeid}", "${flight.updatetime}", "${flight.fromport}", "${flight.toport}", "${flight.num}", "${flight.isground}", "${flight.vspeed}", "${flight.sign}", "${flight.airlinecode}", "${flight.airlinename}", "${flight.ori_country}", "${flight.ori_city}", ${(flight.ori_offset != null) ? flight.ori_offset : null}, ${(flight.ori_lat != null) ? flight.ori_lat : null}, ${(flight.ori_lng != null) ? flight.ori_lng : null}, ${(flight.ori_weather != null) ? flight.ori_weather : null}, "${flight.des_country}", "${flight.des_city}", ${(flight.des_offset != null) ? flight.des_offset : null}, ${(flight.des_lat != null) ? flight.des_lat : null}, ${(flight.des_lng != null) ? flight.des_lng : null}, ${(flight.des_weather != null) ? flight.des_weather : null}, ${(!isNaN(flight.distanceinkm)) ? flight.distanceinkm : null}, ${(flight.scheduled_dep != null) ? flight.scheduled_dep : null}, ${(flight.scheduled_arr != null) ? flight.scheduled_arr : null}, ${(flight.real_dep != null) ? flight.real_dep : null}, ${(flight.real_arr != null) ? flight.real_arr : null}, ${(flight.estimated_dep != null) ? flight.estimated_dep : null}, ${(flight.estimated_arr != null) ? flight.estimated_arr : null}, ${(flight.minuteslate != null) ? flight.minuteslate : null}, "${flight.period}", "${flight.dayofweek}", "${flight.month}")`;
    con.query(sql);
}


async function main() {
  await sleep(1500);
  while(true){
    const DATE = await getTime();
    weatherDic = {};

    const config_all = {
      method: 'get',
      url: 'https://data-cloud.flightradar24.com/zones/fcgi/feed.js?faa=1&bounds=41.449%2C21.623%2C16.457%2C53.063&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=14400&gliders=1&stats=1',
      responseType: 'json'
    }
    const res_all = await axios(config_all);
    // TODO check if res_all.status == 200

    const data = res_all.data;
    for (const key of Object.keys(data)){
      if (Object.values(data[key]).includes('TLV')){
        let flight = new Object();

        flight.flightkey = key // id in the flightradar24 system
        flight.id = data[key][0]; // ID for air traffic control
        flight.lat = data[key][1]; // Latitude
        flight.lng = data[key][2]; // Longitude
        flight.orientaion = data[key][3]; // Orientation (0 is north, going clockwise)
        flight.alt = data[key][4]; // altitude in feet
        flight.speed = data[key][5]; // speed in knots
        flight.squ = data[key][6]; // squawk
        flight.stat = data[key][7]; // flight status
        flight.planetype = data[key][8]; // Airplane type
        flight.planeid= data[key][9]; // ID for the airplane
        flight.updatetime = data[key][10]; // time in milliseonds last update
        flight.fromport = data[key][11]; // Origion airport
        flight.toport = data[key][12]; // Destination airport
        flight.num = data[key][13]; // Flight number
        flight.isground = data[key][14]; // Is on ground
        flight.vspeed = data[key][15]; // Vertical speed
        flight.sign = data[key][16]; // Callsign number
        // flight.unk = data[key][17]; // ?
        flight.airlinecode = data[key][18]; // Airline code


        const config_flight = {
          method: 'get',
          url: 'https://data-live.flightradar24.com/clickhandler/?version=1.5&flight=' + key,
          responseType: 'json'
        }
        
        try {
          const res_flight = await axios(config_flight);
          const flightdata = res_flight.data;

          if (flightdata['airline'] != null){
            flight.airlinename = flightdata['airline']['short'] || flightdata['airline']['name']; // Name of the airline
            // console.log(name);
          }
          if (flightdata["airport"] != null){
            if (flightdata["airport"]["origin"] && flightdata["airport"]["origin"]["position"]["country"] && flightdata["airport"]["origin"]["position"]["region"] && flightdata["airport"]["origin"]["timezone"]){
              flight.ori_country = flightdata["airport"]["origin"]["position"]["country"]["name"]; // The origin country name.
              flight.ori_city = flightdata["airport"]["origin"]["position"]["region"]["city"]; // The origin city name.
              flight.ori_offset = flightdata["airport"]["origin"]["timezone"]["offset"]; // The time offset of the origin
              flight.ori_lat = flightdata["airport"]["origin"]["position"]["latitude"]; // The latitude of the origin
              flight.ori_lng = flightdata["airport"]["origin"]["position"]["longitude"]; // The longitude of the origin
              flight.ori_weather = await getWeatherSmart(flight.ori_lat, flight.ori_lng, flight.ori_country + " " + flight.ori_city); // The weather in the origin
            }
            if (flightdata["airport"]["destination"] && flightdata["airport"]["destination"]["position"]["country"] && flightdata["airport"]["destination"]["position"]["region"] && flightdata["airport"]["destination"]["timezone"]){
              flight.des_country = flightdata["airport"]["destination"]["position"]["country"]["name"]; // The destination country name.
              flight.des_city = flightdata["airport"]["destination"]["position"]["region"]["city"]; // The destination city name.
              flight.des_offset = flightdata["airport"]["destination"]["timezone"]["offset"]; // The time offset of the destination
              flight.des_lat = flightdata["airport"]["destination"]["position"]["latitude"]; // The latitude of the destination
              flight.des_lng = flightdata["airport"]["destination"]["position"]["longitude"]; // The longitude of the destination
              flight.des_weather = await getWeatherSmart(flight.des_lat, flight.des_lng, flight.des_country + " " + flight.des_city); // The weather in the destination
            }
            flight.distanceinkm = getDistanceFromLatLonInKm(flight.ori_lat, flight.ori_lng, flight.des_lat, flight.des_lng);
          }
          if (flightdata["time"] != null){
            flight.scheduled_dep = flightdata["time"]["scheduled"]["departure"]; // The scheduled time for departure
            flight.scheduled_arr = flightdata["time"]["scheduled"]["arrival"]; // The scheduled time for arrival
            flight.real_dep = flightdata["time"]["real"]["departure"]; // The real time for departure
            flight.real_arr = flightdata["time"]["real"]["arrival"]; // The real time for arrival
            flight.estimated_dep = flightdata["time"]["estimated"]["departure"]; // The estimated time for departure
            flight.estimated_arr = flightdata["time"]["estimated"]["arrival"]; // The estimated time for arrival
            flight.minuteslate = null;
            if (flight.estimated_arr != null && flight.scheduled_arr != null)
              flight.minuteslate = millisToMinutes(flight.estimated_arr - flight.scheduled_arr);
          }
        } catch (error) {
          console.warn("---------------------------------------------------------------error-flightradar24")
        }

        flight.period = DATE[0];
        flight.dayofweek = DATE[1];
        flight.month = DATE[2];

        // console.log(flight);
        await savetosql(flight);
        await producer.produce(topic, -1, Buffer.from(JSON.stringify(flight)), flight.num);
      }
    }

    console.log("Done");
    console.log("3");
    await sleep(1000);
    console.log("2");
    await sleep(1000);
    console.log("1");
    await sleep(1000);
  }
}

main();

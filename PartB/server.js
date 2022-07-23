
const express = require('express')
const app = express();
const socketIO = require('socket.io');

const port=3000;

app.use(express.static('public'))

app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  var data = {
    cards: [
      {districtId:"haifa", title: "blahlbah", value: 500, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "content_copy" },
      {districtId:"dan", title: "דן", value: 1500, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "store" },
      {districtId:"central", title: "מרכז", value: 3500, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "info_outline" },
      {districtId:"south", title: "דרום", value: 700, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "add_shopping_cart" }
    ]
  }
  res.render("pages/dashboard", data)
})

app.get('/setData/:districtId/:value', function (req, res) {
  io.emit('newdata',{districtId:req.params.districtId,value:req.params.value})
  res.send(req.params.value)
})


const server = express()
  .use(app)
  .listen(3000, () => console.log(`Listening Socket on http://localhost:3000`));
const io = socketIO(server);

//------------
// io.on('connection', (socket) => {  
//   socket.on('newdata', (msg) => {
//     console.log(msg);
//     io.emit('newdata', msg);
//   });
// });
//-----------


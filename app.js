require('dotenv').config()

const api = require('./api')
const axios=require('axios')
 
const path = require('path');
const express = require('express')

const bodyParser = require('body-parser')
const cors = require('cors')
var app = express();


app.use(bodyParser.json())
app.use(cors())

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
  })); 
  app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded());


// app.get('*', function (req, res) {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

app.listen(process.env.PORT || INSERT_PORT_HERE, async ()  => {
    console.log("started server");
    await app.use('/api', api);
//    setTimeout(function() { console.log("hi");
//     axios.get(`http://localhost:INSERT_PORT_HERE/api/ENDPOINT HIDDEN DUE TO SECURITY REASONS`);

// }, 4000);    
})


// server.js
// where your node app starts

// init project
const dns = require('dns')
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const shortid = require('shortid')

const { isUrl } = require('./utils/helpers')
const ShortUrl = require('./models/ShortUrl')

const app = express();
const dnsPromises = dns.promises


// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
const cors = require('cors');
app.use(cors({optionSuccessStatus: 200}));  // some legacy browsers choke on 204
app.use(bodyParser.urlencoded({ extended: false }))

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
});


// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// Timestamp
app.get('/api/timestamp', (req, res) => {
  const date = new Date()
  res.json({ unix: date.getTime(), utc: date.toString() })
})

app.get('/api/timestamp/:dateString', (req, res) => {
  const { dateString } = req.params
  const isMilli = Number(dateString)
  const date = new Date(isMilli ? isMilli : dateString)
  const milli = typeof date.getTime === 'function' ? date.getTime() : null;
  
  res.json({ unix: milli, utc: date.toString() })
})


// header parser
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.ip,
    language: req.headers['accept-language'],
    software: req.headers['user-agent']
  })
})


// URL Shortener
app.get('/api/shorturl/:shortUrl', async(req, res) => {
  const { shortUrl } = req.params

  try {
    const urlData = await ShortUrl.findOne({ short_url: shortUrl })

    if (!urlData) {
      return res.status(404).json({ erorr: `${shortUrl} does not exist`})
    }

    res.redirect(urlData.original_url)
  } catch (e) {
    res.status(500).json({ error: '(Internal Server Error) Error connecting to database'})
  }
})

app.post('/api/shorturl/new', async (req, res) => {
  const { url } = req.body

  // Validate URL
  if (!isUrl(url)) {
    return res.status(422).json({ error: 'invalid URL' })
  }
  
  // Validate DNS
  try {
    const lookupRes = await dnsPromises.lookup(url.replace(/^https?:\/\//gi, '').split('/')[0])
  } catch (e) {
    return res.status(400).json({ error: 'URL is not pointing anywhere.' })
  }

  // // If url already exist, just return it, Otherwise create new one
  try {
    const existingEntry = await ShortUrl.findOne({ original_url: url })
    if (existingEntry) {
      const { _id, ...restProps } = existingEntry.toObject()
      return res.json(restProps)
    }

    const shortUrl = new ShortUrl({
      original_url: url,
      short_url: shortid.generate(),
    })
    await shortUrl.save()
    const { _id, ...restProps } = shortUrl.toObject()
    return res.json(restProps)
  } catch (e) {
    return res.status(500).json({ error: '(Internal Server Error) Error connecting to database'})
  }
  
})

// listen for requests :)
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true }).then(() => {
  const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });
})
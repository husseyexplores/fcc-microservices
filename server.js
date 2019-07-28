const dns = require('dns')
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const shortid = require('shortid')

const { isUrl, lowercaseRequestData, trimRequestData } = require('./utils/helpers')
const { DATABASE_ERR_MSG } = require('./utils/commons')
const ShortUrl = require('./models/ShortUrl')
const ExerciseUser = require('./models/ExerciseUser')
const Exercise = require('./models/Exercise')
const { postExerciseUserValidators, postExerciseValidators, getExerciseLogValidators } = require('./middlewares/validators')

// ---------------------------------------------------------------------

const app = express();
const dnsPromises = dns.promises

// Middlewares
// enable CORS that your API is remotely testable by FCC 
const cors = require('cors');
app.use(cors({ optionSuccessStatus: 200 }));  // some legacy browsers choke on 204
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));

// Hello world endpoint 
app.get('/api/hello', (req, res) => res.json({ greeting: 'Hello API' }));

/**
 * -----------------------
 *  Timetamp Microservice
 * -----------------------
 */
app.get('/api/timestamp', (req, res) => {
  const date = new Date()
  res.json({ unix: date.getTime(), utc: date.toUTCString() })
})

app.get('/api/timestamp/:dateString', (req, res) => {
  const { dateString } = req.params
  const isMilli = Number(dateString)
  const date = new Date(isMilli ? isMilli : dateString)
  const milli = typeof date.getTime === 'function' ? date.getTime() : null;
  
  res.json({ unix: milli, utc: date.toUTCString() })
})

/**
 * ------------------------------------
 *  Request Header Parser Microservice
 * ------------------------------------
 */
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.ip,
    language: req.headers['accept-language'],
    software: req.headers['user-agent']
  })
})

/**
 * ----------------------------
 *  URL Shortener Microservice
 * ----------------------------
 */
app.get(
  '/api/shorturl/:shortUrl',
  [trimRequestData('params', 'shortUrl')],
  async(req, res) => {
  const { shortUrl } = req.params

  try {
    const urlData = await ShortUrl.findOne({ short_url: shortUrl })

    if (!urlData) {
      return res.status(404).json({ error: [{ msg: `${shortUrl} does not exist.` }] })
    }

    res.redirect(urlData.original_url)
  } catch (e) {
    res.status(500).json({ error: [{ msg: DATABASE_ERR_MSG }] })
  }
})

app.post(
  '/api/shorturl/new', 
  [trimRequestData('body', 'shortUrl')],
  async (req, res) => {
  const { url } = req.body

  // Validate URL
  if (!isUrl(url)) {
    return res.status(422).json({ error: [{ param: 'url', msg: 'Invalid URL' }] })
  }
  
  // Validate DNS
  try {
    const rootDomain = url.replace(/^https?:\/\//gi, '').split('/')[0]
    await dnsPromises.lookup(rootDomain)
  } catch (e) {
    return res.status(400).json({ error: [{ param: 'url', msg: 'URL is not pointing anywhere. Please provide a valid and live URL' }] })
  }

  try {
    // If url already exist, just return it
    const existingEntry = await ShortUrl.findOne({ original_url: url })
    if (existingEntry) {
      const { _id, ...restProps } = existingEntry.toObject({ versionKey: false })
      return res.json(restProps)
    }
    
    // Otherwise create a new one
    const shortUrl = new ShortUrl({
      original_url: url,
      short_url: shortid.generate(),
    })
    await shortUrl.save()
    const { _id, ...restProps } = shortUrl.toObject({ versionKey: false })
    return res.json(restProps)
  } catch (e) {
    return res.status(500).json({ error: [{ msg: DATABASE_ERR_MSG }]})
  }
  
})

/**
 * --------------------------------
 *  Exercise Tracker Microservice
 * --------------------------------
 */

// new user
app.post('/api/exercise/new-user', [postExerciseUserValidators], async (req, res) => {
  if (req.validationErrors && req.validationErrors.length) {
    return res.status(422).json(req.validationErrors)
  }

  let { username } = req.body

  try {
    // Create the user
    const user = new ExerciseUser({ username })
    await user.save()
    res.json(user.toObject({ versionKey: false }))
  } catch (e) {
    res.status(500).json({ error: [{ msg: DATABASE_ERR_MSG }] })
  }
})

// list all users
app.get('/api/exercise/users', async (req, res) => {
  try {
    const users = await ExerciseUser.find()
    let usersList = users ? users.map(user => user.toObject({ versionKey: false })) : []
    
    // If there are more than 500 users,
    // clean-up the database, since it is hosted on a free tier of mongodb atlas
    if (usersList.length > 500) {
      await Promise.all(ExerciseUser.deleteMany({}), Exercise.deleteMany({}))
      usersList = []
    }

    return res.json(usersList)
  } catch (e) {
    return res.status(500).json({ error: [{ msg: DATABASE_ERR_MSG }] })
  }
})

// new exercise
app.post('/api/exercise/add', [postExerciseValidators], async (req, res) => {
  if (req.validationErrors && req.validationErrors.length) {
    return res.status(422).json(req.validationErrors)
  }

  // `duration` is in mins here, max to decimal points
  // `date` is a JS Date object
  const { userId, description, duration, date } = req.body
  
  try {
    const exercise = new Exercise({ userId, description, duration, date })
    await exercise.save()
    return res.json({
      username: req.user.username,
      ...exercise.toObject({ versionKey: false }),
      date: exercise.date.toUTCString(),
    })
  } catch (e) {
    return res.status(500).json({ error: [{ msg: DATABASE_ERR_MSG }] })
  }
})

// get exercise log by userId
app.get('/api/exercise/log', [getExerciseLogValidators], async (req, res) => {
  if (req.validationErrors && req.validationErrors.length) {
    return res.status(422).json(req.validationErrors)
  }

  // `from` and `to` will be either falsy or JS Date objects
  const { userId, from, to, limit } = req.query
  
  // Build the query
  const queryOptions = { userId }

  if (from) {
    queryOptions['date'] = { $gte: from }
  }
  
  if (to) {
    queryOptions['date'] = { ...queryOptions['date'], $lte: to }
  }

  let query = Exercise.find(queryOptions).select('description duration date -_id')

  if (limit) {
    query = query.limit(limit)
  }

  
  try {
    const exerciseLogs = await query.exec()
    
    // remove __v from each log and format date
    const cleanedLogs = exerciseLogs.map(log => {
      const _log = log.toObject({ versionKey: false })
      _log.date = _log.date.toUTCString()
      return _log
    })
    
    res.json({
      _id: userId,
      username: req.user.username,
      from,
      to,
      count: exerciseLogs.length,
      log  : cleanedLogs,
    })
  } catch (e) {
    console.log(e)
    return res.status(500).json({ error: [{ msg: DATABASE_ERR_MSG }] })
  }
})

// ----------------------------------------------------------------------

// 404 - Catch all
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Resource not found'
  })
})


// Errors middleware
app.use((err, req, res, next) => {
  if (typeof err === 'string') {
    err = new Error(err)
  } 
  
  res.status(err.status || 500).json({
    error: err.msg || err.message
  })
})

// ----------------------------------------------------------------------

// Connect to the database and listen for requests :)
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true })
  .then(() => {
    const listener = app.listen(process.env.PORT, function () {
      console.log('Your app is listening on port ' + listener.address().port);
    });
  })
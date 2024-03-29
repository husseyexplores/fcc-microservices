const { Schema, model } = require('mongoose')

const shortUrlSchema = new Schema({
  original_url: {
    type: String,
    required: true,
    trim: true,
  },
  short_url: {
    type: String,
    required: true,
    trim: true,
  }
})

module.exports = model('ShortUrl', shortUrlSchema)

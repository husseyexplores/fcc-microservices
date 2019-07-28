const { Schema, model } = require('mongoose')

const exerciseSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  duration: {
    type: Number, // seconds
    required: true,
  },
  date: {
    type: Date,
    required: true,
  }
  
})

module.exports = model('Exercise', exerciseSchema)

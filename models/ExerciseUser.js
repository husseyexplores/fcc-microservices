const { Schema, model } = require('mongoose')
const shortid = require('shortid')

const userSchema = new Schema({
  _id: {
    type: String,
    required: true,
    default: shortid.generate,
  },
  username: {
    type: String,
    required: true,
    trim: true,
  },
})

module.exports = model('ExcerciseUser', userSchema)

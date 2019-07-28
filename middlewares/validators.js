const { checkBody, checkQuery } = require('../utils/helpers')
const { DATABASE_ERR_MSG } = require('../utils/commons')
const ExerciseUser = require('../models/ExerciseUser')

exports.postExerciseUserValidators = [
  checkBody([
    {
      param: 'username',
      required: true,
      trim: true,
      validator: async (value, { req, next }) => {
        // Check for existing user
        if (value.length > 20) {
          throw new Error('Username characters limit exceeded. Max characters limit is 20')
        }

        let user = null
      
        try {
          user = await ExerciseUser.findOne({ username: value })
        } catch (e) {
          return next(DATABASE_ERR_MSG)
        }
        
        if (user) {
          throw new Error(`Username '${value}' is already taken. Please choose a different username`)
        }

        return true
      },
    },
  ])
]

exports.postExerciseValidators = [
  checkBody([
    {
      param: 'userId',
      required: true,
      trim: true,
      validator: async (value, { req, next }) => {
        let user = null

        try {
          user = await ExerciseUser.findById(value)
        } catch (e) {
          return next(DATABASE_ERR_MSG)
        }

        if (!user) {
          throw new Error(`User with the id '${value}' does't exist`)
        }

        req.user = user || null
        return true
      },
    },
    {
      param: 'description',
      required: true,
      trim: true,
      validator: async (value, { req }) => {
        if (value.length > 500) {
          throw new Error(
            'Description is too long. Max limit is 500 characters. Current characters are ' +
              value.length
          )
        }
        return true
      },
    },
    {
      param: 'duration',
      required: true,
      trim: true,
      validatorr: async (value, { req, next }) => {
        if (isNaN(value)) {
          throw new Error('Invalid value. Duration should be a number.')
        }

        // Max to 2 decimal
        value = Number(value)
        value = Number(value.toFixed(2))
        req.body.duration = value
        return true
      },
    },
    {
      param: 'date',
      trim: true,
      validator: async (value, { req }) => {
        if (!value) {
          // if no date is defind, use current time
          req.body.date = new Date()
          return true
        }

        // validate date format YYYY-MM-DD
        const splittedVals = value.split('-')

        // - Should have 3 values (year, month, day)
        // - Every value should be an integer
        // - Should be a valid date
        if (
          splittedVals.length !== 3 ||
          splittedVals.some(v => isNaN(v) || !Number.isInteger(Number(v))) ||
          new Date(value).toString().toLowerCase() === 'invalid date'
        ) {
          throw new Error(
            'Invalid date format. Valid format is: YYYY-MM-DD (Hyphen separated integers)'
          )
        }

        req.body.date = new Date(value)
        return true
      },
    },
  ])
]

exports.getExerciseLogValidators = [
  checkQuery([
    {
      param: 'userId',
      required: true,
      trim: true,
      validator: async (value, { req, next }) => {
        if (!value) return false // default error

        let user = null

        try {
          user = await ExerciseUser.findById(value)
        } catch (e) {
          return next(DATABASE_ERR_MSG)
        }

        if (!user) {
          throw new Error(`User with the id '${value}' does't exist`)
        }

        req.user = user || null
        return true
      },
    },
    {
      param: 'from',
      trim: true,
      validator: async (value, { req }) => {
        // not a required param
        if (!value) return true

        // validate date format YYYY-MM-DD
        if (new Date(value).toString().toLowerCase() === 'invalid date') {
          throw new Error(
            'Invalid date format. Valid format is: YYYY-MM-DD (Hyphen separated integers)'
          )
        }

        req.body.from = new Date(value)
        return true
      },
    },
    {
      param: 'to',
      trim: true,
      validator: async (value, { req, next }) => {
        // not a required param
        if (!value) return true

        // validate date format YYYY-MM-DD
        if (new Date(value).toString().toLowerCase() === 'invalid date') {
          throw new Error(
            'Invalid date format. Valid format is: YYYY-MM-DD (Hyphen separated integers)'
          )
        }

        req.body.from = new Date(value)
        return true
      },
    },
    {
      param: 'limit',
      trim: true,
      validator: async (value, { req }) => {
        const limit = value ? Number(value) : undefined
        if (value && (!Number.isInteger(limit) || limit < 1)) {
          throw new Error('Expect limit to be a integer greater than 0')
        }
        req.query.limit = limit
        return true
      },
    },
  ])
]

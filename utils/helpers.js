exports.isUrl = str =>
  /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(str)

exports.makeMap = arr => arr.reduce((map, value) => (map[value] = true, map), {}) 

exports.trimRequestData = (prop, valuesToTrim) => (req, res, next) => {
  const fieldsToCheck = Array.isArray(valuesToTrim) 
    ? valuesToTrim 
    : typeof valuesToLowerCase === 'string' 
    ? [valuesToTrim]
    : []
  const trimAll = fieldsToCheck.length === 0

  const valuesMap = this.makeMap(fieldsToCheck)

  for (let key in req[prop]) {
    if (typeof key === 'string' && (trimAll || valuesMap[key])) {
      req[prop][key] = req[prop][key].trim()
    }
  }

  next()
}

/*
 // Proposed API for validation function (similar to express-validator)
 checkBody([{
   param: 'url',
   trim: true,
   lowercase: true,
   validator: (value, { req }) => {
     if (!isURL(value)) {
       throw new Error('Invalid URL')
     }
     return true
   }
 }])
*/

const check = reqProp => arr => async (req, res, next) => {
  req.validationErrors = req.validationErrors || []
  if (!req[reqProp]) {
    return next(new Error(`req.${reqProp} is undefind. Can not validate data.`))
  }

  // If we get an object, covert to an array
  if (!Array.isArray(arr)) {
    arr = [arr]
  }
  
  for (let { param, validator, trim, lowercase, uppercase, defaultError, required } of arr ) {
    let paramValue = req[reqProp][param]

    if (trim && typeof paramValue === 'string') {
      req[reqProp][param] = paramValue.trim()
    }
    
    if (lowercase && typeof paramValue === 'string') {
      req[reqProp][param] = paramValue.toLowerCase()
    }
    
    if (uppercase && typeof paramValue === 'string') {
      req[reqProp][param] = paramValue.toUpperCase()
    }

    req[reqProp][param] = paramValue

    if (required && !paramValue) {
       req.validationErrors.push({
        param,
        msg: 'Missing value',
      })
      // If the value is required and does not exist
      // do not run the validator function
      continue
    }

    // If no validator is defined, continue to the next one
    if (typeof validator !== 'function') continue;

    try {
      const value = await validator(paramValue, { req, res, next })
      if (!value) {
        defaultError = typeof defaultError === 'string' ? defaultError : 'Invalid value'
        req.validationErrors.push({
          param,
          msg: defaultError,
        })
      }
    } catch (e) {
      req.validationErrors.push({
        param,
        msg: e.message,
      })
    }
  }

  return next()
}
exports.checkBody = check('body')
exports.checkParams = check('params')
exports.checkQuery = check('query')

exports.lowercaseRequestData = (prop, valuesToLowercase) => (req, res, next) => {
  const fieldsToCheck = Array.isArray(valuesToLowercase) 
    ? valuesToLowercase 
    : typeof valuesToLowerCase === 'string' 
    ? [valuesToLowercase]
    : []
  const lowercaseAll = fieldsToCheck.length === 0

  const valuesMap = this.makeMap(fieldsToCheck)

  for (let key in req[prop]) {
    if (typeof key === 'string' && (lowercaseAll || valuesMap[key])) {
      req[prop][key] = req[prop][key].toLowerCase()
    }
  }

  next()
}
'use strict'

const assert = require('assert')
const fp = require('fastify-plugin')
const fs = require('fs')
const parseArgs = require('./args')
const path = require('path')
// const PinoColada = require('pino-colada')
const PinoPretty = require('pino-pretty')

const { pipeline } = require('stream');// replaces pump
const Fastify = require('fastify')
require('dotenv').config()

function showHelp() {
  fs.readFile(path.join(__dirname, 'help', 'start.txt'), 'utf8', (err, data) => {
    if (err) {
      stop(err)
    }
    console.log(data)
    stop()
  })
}

function stop(error) {
  if (error) {
    console.error(error)
    process.exit(1)
  }
  process.exit()
}

function validatePluginFunction(file) {
  if (file.constructor.name === 'Function' && file.length !== 3) {
    return `Plugin function should contain 3 arguments. Refer to docs for more information about it`
  }
  
  if (file.constructor.name === 'AsyncFunction' && file.length !== 2) {
    return `Async/Await plugin function should contain 2 arguments. Refer to docs for more information about it`
  }
  
  return null
}

function loadAppFile(opts) {
  try {
    return require(path.resolve(process.cwd(), opts.file))
  } catch (e) {
    stop(e)
  }
}

function createServerOptions(opts) {
  const options = {
    logger: {
      level: opts.logLevel,
      transport: {
        target: 'pino-pretty'
      }
    },
    pluginTimeout: opts.pluginTimeout
  }

  if (opts.bodyLimit) {
    options.bodyLimit = opts.bodyLimit
  }

  if (opts.prettyLogs) {
   // const pinoColada = PinoColada()
    options.logger.stream = PinoPretty()
  }

  return options
}

function start(args, cb) {
  const opts = parseArgs(args)
  
  if (opts.help) {
    return showHelp()
  }
  
  if (!fs.existsSync(opts.file)) {
    console.error('Missing the required file app.js\n')
    return showHelp()
  }

  return run(args, cb)
}

function run(args, cb = assert.ifError) {
  const opts = parseArgs(args)
  
  // Configure server options
  opts.port = opts.port || process.env.PORT || 9050
  opts.address = opts.address || process.env.ADDRESS || 'localhost'
  
  console.log('=== Version ', process.env.VERSION, 
              '\nAddress: ', opts.address, 
              '\nPort: ', opts.port)

  // Load application file
  const file = loadAppFile(opts)
  
  // Validate plugin function signature
  const validationError = validatePluginFunction(file)
  if (validationError) {
    return stop(validationError)
  }

  // Create server options
  const serverOptions = createServerOptions(opts)
  
  // Create Fastify instance
  const fastify = Fastify(
    opts.option ? Object.assign(serverOptions, file.options) : serverOptions
  )

  // Register the plugin with options
  const pluginOptions = {}
  if (opts.prefix) {
    pluginOptions.prefix = opts.prefix
    pluginOptions._routePrefix = opts.prefix || ''
  }

  console.log('pis file',file)
   console.log('pis pluginOptions', pluginOptions)
   console.log('------------------------')
  
  fastify.register(fp(file), pluginOptions)

  // Start the server
  const startServer = () => {
    if (opts.address) {
      fastify.listen({ port: opts.port, host: opts.address }, (err) => wrap(err))
     
    } else {
      fastify.listen({ port: opts.port }, (err) => wrap(err))
        }
    

  }

  function wrap(err) {
    cb(err, fastify)
    console.log(`http://localhost:8080/meta`);

  }

  startServer()
  return fastify
}

function cli(args) {
  start(args)
}

module.exports = { start, run, stop }

if (require.main === module) {
  cli(process.argv.slice(2))
}
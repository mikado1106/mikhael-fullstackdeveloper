// Vercel entry point. The handler lives in the compiled output because NestJS
// needs the decorator metadata that `nest build` emits.
module.exports = require('../dist/serverless').handler;

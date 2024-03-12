const mongoose = require('mongoose');

const txSchema = mongoose.Schema({
  // txHash: { type: String, required: true },
  blockUnixTime: { type: Number, required: true },
  source: { type: String, required: true },
  owner: { type: String, required: true },
  type: { type: String, required: true },   // buy or sell
  total: { type: Number, required: true },
  tradeSymbol: { type: String, required: true },
  fromSymbol: { type: String, required: true },   // from symbol, for example 'USDC'
  // fromPrice: { type: Number },
  // fromAmount: { type: Number, required: true },
  toSymbol: { type: String, required: true }
  // toPrice: { type: Number },
  // toAmount: { type: Number, required: true }
});

//module.exports = mongoose.model('Transaction', txSchema);
const conn = mongoose.createConnection(process.env.MONGO_DBURL)
module.exports = conn.model('Transaction', txSchema);
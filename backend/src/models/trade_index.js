const mongoose = require('mongoose');

const indexSchema = mongoose.Schema({  
  indexTime: { type: Number, required: true },  
  owner: { type: String, required: true },    
  tradeSymbol: { type: String, required: true },
  total: { type: Number, required: true }
});

const conn = mongoose.createConnection(process.env.MONGO_DBURL)
module.exports = conn.model('TradeIndex', indexSchema);
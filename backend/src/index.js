import express from 'express';
import config from './config';

import helmet from 'helmet';
import xss from 'xss-clean';
import hpp from 'hpp';

import { json, urlencoded } from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import colors from 'colors';

import { guard, newToken } from './utils/auth';

//const txDownloader = require('./tx_downloader')
require('./subscribe_txs_token')
require('./trade_indexer')
const txAanalyzer = require('./tx_analyzer')
const { targetTokenPrice } = require('./price_query')

const app = express();

//* CONFIG *//
app.disable('x-powered-by'); //? Disable default header

app.use(cors()); //? CORS Enabled
app.use(json()); //? Body parser for application/json POST data
app.use(urlencoded({ extended: true })); //? Body parser for application/x-www-form-urlencoded POST data

app.use(helmet()); //? Securiy Headers Default config
app.use(xss()); //? Prevent Cross Site Scripting
app.use(hpp()); //? Prevent HTTP param pollution

app.use(morgan('dev')); //? Server Logger
//* END CONFIG *//

//* ROUTES *//
app.get('/api', (req, res) => {
  res.send('API ROOT ⚡️');
});

app.get('/api/wallets', (req, res) => {  
  let rankSize = parseInt(req.query.rankSize)
  if(!rankSize) rankSize = 10
  if(rankSize < 10) rankSize = 10
  if(rankSize > 200) rankSize = 200
  txAanalyzer.sortWallets(rankSize)
  .then(wallets => {
    res.send(wallets);
  })
  .catch(err => {
    res.send([])
  })
  
});

//* END ROUTES *//

app.listen(config.port, () => {
  console.log(
    colors.underline.bgBlack.bold.brightMagenta(
      `API is Running at http://localhost:${config.port}/api`
    )
  );
});

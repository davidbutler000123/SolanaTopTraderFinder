#!/usr/bin/env node

var WebSocketClient = require('websocket').client;
const util = require("util")
const { COIN_TOKENS } = require('./utils/coin_tokens')
const CHAIN= 'solana'

var client = new WebSocketClient();
let activeConnection
const { Transaction } = require('./models')
const WSS_TOKEN_URL = util.format(`wss://public-api.birdeye.so/socket/${CHAIN}?x-api-key=${process.env.BIRDEYE_API_KEY}`)
let SubscriberTxCounter = {
    count: 0,
    clear: function() {
        SubscriberTxCounter.count = 0
    },
    add: function() {
        SubscriberTxCounter.count++
    }    
}

client.on('connectFailed', function (error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', async function (connection) {
    activeConnection = connection
    console.log('WebSocket Client Connected');
    connection.on('error', function (error) {
        console.log("Connection Error: " + error.toString());        
        connection.close()
    });
    connection.on('close', function () {
        console.log('echo-protocol Connection Closed');
        setTimeout(connectBirdeyeWss, 1000)
    });
    connection.on('message', async function (message) {        
        if (message.type === 'utf8') {
            const msgObj = JSON.parse(message.utf8Data)
            if(msgObj.type != 'TXS_DATA') return
            const tx = msgObj.data            

            if(tx.source.indexOf('raydium') != 0) {
                return
            }

            //console.log(`owner=${tx.owner}, total=${tx.volumeUSD}, type=${tx.side}, from=${tx.from.amount}, to=${tx.to.amount}, poolId=${tx.poolId}`)

            const fromPrice = tx.from.price ? tx.from.price : tx.from.nearestPrice
            const toPrice = tx.to.price ? tx.to.price : tx.to.nearestPrice
            //let total = fromPrice ? fromPrice * tx.from.uiAmount : toPrice * tx.to.uiAmount
            let total = tx.volumeUSD
            let type = tx.side
            
            // filtering out non-swap transactions
            if(!type || tx.from.amount == 0 || !tx.to.amount || !total) return

            const fromSymbol = tx.from.symbol ? tx.from.symbol : 'unknown'
            const toSymbol = tx.to.symbol ? tx.to.symbol : 'unknown'
            let tradeSymbol = fromSymbol
            if(tradeSymbol == COIN_TOKENS[process.env.TARGET_NAME].symbol) tradeSymbol = toSymbol

            if(type == 'sell') total *= (-1.0)
            
            // const existTx = await Transaction.findOne({
            //     blockUnixTime: tx.blockUnixTime,
            //     owner: tx.owner,
            //     type: type,
            //     total: total
            // })
            
            // if(existTx) {
            //     return
            // }

            const t = new Transaction({
                blockUnixTime: tx.blockUnixTime,
                source: tx.source,
                owner: tx.owner,
                type: type,
                total: total,
                tradeSymbol: tradeSymbol,
                fromSymbol: fromSymbol,
                // fromPrice: fromPrice,
                // fromAmount: tx.from.uiAmount,
                toSymbol: toSymbol
                // toPrice: toPrice,
                // toAmount: tx.to.uiAmount
            })
            t.save()
            .then(item => {                
                SubscriberTxCounter.add()                
            })
            .catch((e) => {
                console.log('ERROR: ', tx, '----------------->', e)
            })            
        }
    });

    const msg = {
        type: "SUBSCRIBE_TXS",
        data: {            
            address: COIN_TOKENS[process.env.TARGET_NAME].address
        }
    }
    connection.send(JSON.stringify(msg))
});

function connectBirdeyeWss() {    
    console.log(`Trying to connect BirdEye WSS: ${WSS_TOKEN_URL}`)
    client.connect(WSS_TOKEN_URL, 'echo-protocol', "https://birdeye.so");
}

let prevConnectTimeMark = Math.floor(new Date().getMinutes() / 30)
function checkReconnect() {
    let tmpTimeMark = Math.floor(new Date().getMinutes() / 30)  // reconnect per 30 minutes
    if(tmpTimeMark != prevConnectTimeMark) {
        try {
            if(activeConnection) activeConnection.close()
        } catch (error) {
            console.log(error)
        }
        prevConnectTimeMark = tmpTimeMark
    }
}

connectBirdeyeWss()

setInterval(checkReconnect, 60000)  // check reconnecting per 1 minutes

module.exports = {
    SubscriberTxCounter,
    connectBirdeyeWss
}
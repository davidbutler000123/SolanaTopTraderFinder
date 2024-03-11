#!/usr/bin/env node

var WebSocketClient = require('websocket').client;
const util = require("util")
const CHAIN= 'solana'

var client = new WebSocketClient();
const { Transaction } = require('./models')

client.on('connectFailed', function (error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', async function (connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function (error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function () {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function (message) {
        if (message.type === 'utf8') {            
            const msgObj = JSON.parse(message.utf8Data)
            if(msgObj.type != 'TXS_DATA') return            
            const tx = msgObj.data            
            
            const fromPrice = tx.from.price ? tx.from.price : tx.from.nearestPrice
            const toPrice = tx.to.price ? tx.to.price : tx.to.nearestPrice
            let total = fromPrice ? fromPrice * tx.from.uiAmount : toPrice * tx.to.uiAmount
            const fromSymbol = tx.from.symbol ? tx.from.symbol : 'unknown'
            const toSymbol = tx.to.symbol ? tx.to.symbol : 'unknown'
            let tokenSymbol = fromSymbol
            if(tokenSymbol == 'RAY') tokenSymbol = toSymbol
            
            const t = new Transaction({
                blockUnixTime: tx.blockUnixTime,
                source: tx.source,
                poolId: tx.poolId,
                owner: tx.owner,
                type: tx.side,
                total: total,
                tokenSymbol: tokenSymbol,
                fromSymbol: fromSymbol,
                fromPrice: fromPrice,
                fromAmount: tx.from.uiAmount,
                toSymbol: toSymbol,
                toPrice: toPrice,
                toAmount: tx.to.uiAmount
            })
            t.save()
            .then()
            .catch((e) => {
                console.log('ERROR: ', e)
            })            
        }
    });

    const msg = {
        type: "SUBSCRIBE_TXS",
        data: {            
            address: process.env.TARGET_TOKEN_ADDRESS
        }
    }

    connection.send(JSON.stringify(msg))
});

client.connect(util.format(`wss://public-api.birdeye.so/socket/${CHAIN}?x-api-key=${process.env.BIRDEYE_API_KEY}`), 'echo-protocol', "https://birdeye.so");
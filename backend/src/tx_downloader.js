const axios = require('axios');
const fs = require('fs');
const { Transaction } = require('./models')
const { COIN_TOKENS } = require('./utils/coin_tokens')

const TARGET_TOKEN_ADDRESS = COIN_TOKENS[process.env.TARGET_NAME].address
const TARGET_TOKEN_SYMBOL = COIN_TOKENS[process.env.TARGET_NAME].symbol

const   TX_FETCH_PERIOD = 20 * 1000 // 20 seconds

const apiKey = '6HBMQ4KR98UE15FRPR394CF7ZXARF4J132';
const address = '0xD045120193Df76261F5E10d5b0729a6e9137a426';
const address_2 = '0x25c256f6437de6e9ba2c0ded33b87d99bd9de8db';
const query1 = `https://api.etherscan.io/api?module=account&action=txlist&address=${address_2}&startblock=19363900&endblock=19364000&sort=asc&apikey=${apiKey}`

const raydium_pairs_api = "https://api.raydium.io/v2/main/pairs"
const raydium_amm_pools = "https://api.raydium.io/v2/ammV3/ammPools"
let RaydiumPoolPairs = []
let txInsCountPerFetch = 0
let txBackIndex = 0

function ether_scan() {
    axios.get(query1)
    .then(response => {
        const transactions = response.data.result;
        console.log(transactions);
    })
    .catch(error => {
        console.log(error);
    });
}

function save_pairs_to_file(pairs) {
    fs.writeFile("./public/raydium_pairs.json", JSON.stringify(pairs, false, 4), function(err) {
        if (err) {
            console.log(err);
        }
    });
}

function sol_scan_pairs_for_raydium() {
    axios.get(raydium_pairs_api)
    .then(response => {
        // var keyNames = Object.keys(response)
        // console.log(keyNames)

        let pairs = response.data.map((item) => ({
            name: item.name,
            ammId: item.ammId,
            lpMint: item.lpMint,
            baseMint: item.baseMint,
            quoteMint: item.quoteMint,
            market: item.market,
            liquidity: item.liquidity,
            volume24h: item.volume24h
        }))
        .filter((item) => item.volume24h > 1000000)

        console.log(`Raydium Pools Count: ${pairs.length}`)        
        save_pairs_to_file(pairs)
    })
    .catch(error => {
        console.log(error);
    });
}

function loadPairsFromFile() {
    RaydiumPoolPairs = JSON.parse(fs.readFileSync('./public/raydium_pairs.json', 'utf-8'))    
    console.log(`RaydiumPoolPairs length = ${RaydiumPoolPairs.length}`)
}

function scan_raydium_amm_pools() {
    axios.get(raydium_amm_pools)
    .then(response => {
        console.log(response.data.data)
    })
    .catch(error => {
        console.log(error);
    });
}

// example of token = 'So11111111111111111111111111111111111111112'
function get_price_history(token) {
    const options = {
        method: 'GET',
        headers: {'x-chain': 'solana', 'X-API-KEY': process.env.BIRDEYE_API_KEY}
      };
      
      fetch(`https://public-api.birdeye.so/defi/history_price?address=${token}&address_type=token&type=5m&time_from=1709620347&time_to=1709621392`, options)
        .then(response => response.json())
        .then(response => console.log(response))
        .catch(err => console.error(err));
}

function get_pair_transactions(pair_addr, limit) {
    txInsCountPerFetch = 0
    let query = `https://public-api.birdeye.so/defi/txs/pair?address=${pair_addr}&offset=0&limit=${limit}&sort_type=desc`
    axios.get(query, {
        headers: {
            'accept': 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    })
    .then(response => {
        let txs = response.data.data.items;
        savePairTxsToDB(txs)
    })
    .catch(error => {
        console.log(`get_pair_transactions failed -> ${error}`);
    });    
}

function get_token_transactions(offset, limit, go_back) {
    txInsCountPerFetch = 0
    let query = `https://public-api.birdeye.so/defi/txs/token?address=${TARGET_TOKEN_ADDRESS}&offset=${offset}&limit=${limit}&sort_type=desc`
    axios.get(query, {
        headers: {
            'accept': 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    })
    .then(response => {
        let txs = response.data.data.items;
        if(txs && txs.length > 1) {
            let start_time = txs[txs.length - 1].blockUnixTime
            let end_time = txs[0].blockUnixTime
            console.log(`got transactions: ${start_time} ~ ${end_time}`)
            if(Date.now() - start_time * 1000 > process.env.DB_RANGE_TIME) {
                console.log(' ****** Fetching backward transactions is reached to limit range! ******************************')
                return
            }
        }
        if(go_back) {
            txBackIndex += txs.length
            setTimeout(function() {
                get_token_transactions(txBackIndex, limit, true)
            }, 1)
        }
        saveTokenTxsToDB(txs)
    })
    .catch(error => {
        console.log(`get_token_transactions failed -> ${error}   retrying...`);
        setTimeout(function() {
            get_token_transactions(txBackIndex, limit, true)
        }, 3000)
    });    
}

function savePairTxsToDB(txs) {
    txs.forEach(async tx => {
        const existTx = await Transaction.findOne({
            blockUnixTime: tx.blockUnixTime,
            source: tx.source
        })
        
        if(existTx) {            
            return
        }

        if(tx.source.indexOf('raydium') != 0) return

        const fromPrice = tx.from.price ? tx.from.price : tx.from.nearestPrice
        const toPrice = tx.to.price ? tx.to.price : tx.to.nearestPrice
        let total = fromPrice ? fromPrice * tx.from.uiAmount : toPrice * tx.to.uiAmount
        let type = 'buy'
        if(tx.from.symbol == 'USDC') type = 'buy'
        else if(tx.from.symbol == 'SOL') {
            type = (tx.to.symbol == 'USDC') ? 'sell' : 'buy'
        }
        else type = 'sell'
        const fromSymbol = tx.from.symbol ? tx.from.symbol : 'unknown'
        const toSymbol = tx.to.symbol ? tx.to.symbol : 'unknown'
        let tradeSymbol = fromSymbol
        if(tradeSymbol == TARGET_TOKEN_SYMBOL) tradeSymbol = toSymbol

        if(type == 'buy') total *= (-1.0)

        const t = new Transaction({
            blockUnixTime: tx.blockUnixTime,
            source: tx.source,
            owner: tx.owner,
            type: type,
            total: total,
            tradeSymbol: tradeSymbol,
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

        txInsCountPerFetch++
        if(txInsCountPerFetch % 100 == 0) console.log(`Transaction added: ${txInsCountPerFetch}`)
    });
}

function saveTokenTxsToDB(txs) {
    txs.forEach(async tx => {
        const existTx = await Transaction.findOne({
            blockUnixTime: tx.blockUnixTime,
            source: tx.source
        })        
        
        if(existTx) {
            return
        }

        if(tx.txType != 'swap') return
        if(tx.source.indexOf('raydium') != 0) return

        const fromPrice = tx.from.price ? tx.from.price : tx.from.nearestPrice
        const toPrice = tx.to.price ? tx.to.price : tx.to.nearestPrice
        let total = fromPrice ? fromPrice * tx.from.uiAmount : toPrice * tx.to.uiAmount
        let type = tx.side        
        const fromSymbol = tx.from.symbol ? tx.from.symbol : 'unknown'
        const toSymbol = tx.to.symbol ? tx.to.symbol : 'unknown'
        let tradeSymbol = fromSymbol
        if(tradeSymbol == TARGET_TOKEN_SYMBOL) tradeSymbol = toSymbol

        if(type == 'buy') total *= (-1.0)

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
        .then()
        .catch((e) => {
            console.log('ERROR: ', e)
        })
        
    });
}

function fetchRaydiumTxsByPair() {
    //scan_raydium_amm_pools();    

    if(RaydiumPoolPairs.length == 0) {
        console.log(`RaydiumPoolPairs list is invalid.`)
        return
    }
    console.log('******** fetchRaydiumTransactions is called ************************************************')
    let priority_step = (32 - 2) / RaydiumPoolPairs.length;
    let limit = 32.0;
    RaydiumPoolPairs.forEach(pair => {
        get_pair_transactions(pair.ammId, Math.round(limit));
        limit -= priority_step
    })
}

function fetchLatestRaydiumTxsByToken() {    
    get_token_transactions(0, 50, false)
}

async function removeAWeekAgoTransactions() {
    const aWeekAgo = new Date(Date.now() - process.env.DB_RANGE_TIME)
    const nStartLimitTime = Math.floor(aWeekAgo.getTime() / 1000)
    
    // Transaction.find({ blockUnixTime: { $lt: nStartLimitTime } })
    // .then(docs => {
    //     console.log(' found documents: ', docs.length)
    // })
    // .catch(err => {
    //     console.error(err);
    // });

    const result = await Transaction.deleteMany({
        blockUnixTime: {$lt: nStartLimitTime}
    })
    let txEarliest = await Transaction.find().sort({blockUnixTime: 1}).limit(1)
    let txLatest = await Transaction.find().sort({blockUnixTime: -1}).limit(1)
    let timeRangeStart = 'unknown'
    let timeRangeEnd = 'unknown'
    if(txEarliest && txEarliest.length > 0) {
        let unixTimeStart = txEarliest[0].blockUnixTime * 1000
        timeRangeStart = new Date(unixTimeStart).toLocaleDateString("en-US")
        timeRangeStart += ' '
        timeRangeStart += new Date(unixTimeStart).toLocaleTimeString()
    }
    if(txLatest && txLatest.length > 0) {
        let unixTimeEnd = txLatest[0].blockUnixTime * 1000
        timeRangeEnd = new Date(unixTimeEnd).toLocaleDateString("en-US")
        timeRangeEnd += ' '
        timeRangeEnd += new Date(unixTimeEnd).toLocaleTimeString()
    }        
    
    //console.log('Deleted transactions: ', result.deletedCount)
}

function startDownloadByPair() {

    // ***** loading raydium token pool pairs ******************
    //sol_scan_pairs_for_raydium();
    loadPairsFromFile()

    // ***** create TX fetch timer and TX cleaning timer *******
    fetchRaydiumTxsByPair()
    setInterval(fetchRaydiumTxsByPair, TX_FETCH_PERIOD);
    setTimeout(() => {
        setInterval(removeAWeekAgoTransactions, TX_FETCH_PERIOD)
    }, TX_FETCH_PERIOD / 2)
}

function startDownloadByToken() {
    //get_token_transactions(0, 50, true)
    //setInterval(fetchLatestRaydiumTxsByToken, 2000)
    setTimeout(() => {
        setInterval(removeAWeekAgoTransactions, TX_FETCH_PERIOD)
    }, TX_FETCH_PERIOD / 2)
}

const sortWallets = () => {
    return new Promise(async (resolve, reject) => {        
        const pipeline = [
            { $group: { _id:'$owner', total: { $sum: '$total'}}},
            { $sort: { 'total': -1 } }
        ]
        let topWallets = await Transaction.aggregate(pipeline).limit(20).exec()
        let wallets = []
        let ranking = 1
        for(let wallet of topWallets) {
            let trades = await Transaction.aggregate([
                {
                    $match: { owner: wallet._id }
                },
                {
                    $group: { _id: '$tradeSymbol', total: { $sum: '$total'} }
                }                
            ]).exec()            
            let totalTrades = trades.length
            let profitableTrades = trades.filter(trade => trade.total > 0).length
            let tradeScore = `${Math.round(100 * profitableTrades / totalTrades)}%`
            let totalProfit = wallet.total / 1000
            let avgProfit = totalProfit / totalTrades
            let solScan = `https://solscan.io/account/${wallet._id}`
            let tradedTokens = trades.map(trade => trade._id).join(',')

            wallets.push({
                wallet: wallet._id, 
                ranking: ranking,
                solScan: solScan,
                avgProfit: avgProfit,
                totalProfit: totalProfit,
                profitableTrades: profitableTrades,
                totalTrades: totalTrades,
                tradeScore: tradeScore,
                tradedTokens: tradedTokens})
            ranking++
        }
        
        resolve(wallets)
    })
}

//startDownloadByPair()
//startDownloadByToken()

module.exports = {
    sortWallets
}
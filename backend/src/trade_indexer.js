const { Transaction, TradeIndex } = require('./models')
const { SubscriberTxCounter, connectBirdeyeWss } = require('./subscribe_txs_token')

const   DB_INDEXING_RANGE_HOURS = process.env.DB_INDEXING_RANGE_HOURS
const   DB_RANGE_TIME = process.env.DB_RANGE_TIME

function currentMomentVal() {
    //return Math.floor(new Date().getMinutes() / DB_INDEXING_RANGE_HOURS)
    return Math.floor(new Date().getHours() / DB_INDEXING_RANGE_HOURS)
}

let     bIndexProcessing = false
let     lastIndexingMomentVal = currentMomentVal()
let     lastIndexingTime = new Date()

async function deleteDuplicates() {
    
    const duplicates = await Transaction.aggregate([
    {
        $group: {
            _id: {
            blockUnixTime: "$blockUnixTime",
            source: "$source",
            owner: "$owner",
            type: "$type",
            fromSymbol: "$fromSymbol",
            toSymbol: "$toSymbol",
            total: "$total",
            },
            ids: { $push: "$_id" },
            count: { $sum: 1 }
        }
    },
    {
        $match: {
            count: { $gt: 1 } // Having more than one occurrence
        }
    },
    {
        $project: {
            _id: 0, // Exclude this if you don't want to show the duplicated value
            ids: 1,
            count: 1, // Include or exclude count as needed
        }
    }], { allowDiskUse: true }
    ).exec()

    let dupIds = []
    for(let i = 0; i < duplicates.length; i++) {
        let tmpIds = duplicates[i].ids
        tmpIds.pop(0)        
        tmpIds.forEach(element => {
            dupIds.push(element)
        });        
    }
    let duplTxCount = dupIds.length
    while(dupIds.length > 0) {
        let subIds = dupIds.splice(0, 10000)
        await Transaction.deleteMany({
            _id: { $in: subIds }
        })
    }
    console.log('deleteDuplicates: ' + duplTxCount)
}

function printNewTransactions() {
    const nowTime = new Date()
    console.log(`${nowTime.toLocaleDateString()} ${nowTime.toLocaleTimeString()} -> New Transactions: ${SubscriberTxCounter.count} added.`)
    if(SubscriberTxCounter.count == 0) {
        connectBirdeyeWss()
    }
    SubscriberTxCounter.clear()
}

function shouldIndexing() {

    if(bIndexProcessing) {
        return
    }
    if(currentMomentVal() == lastIndexingMomentVal) return false    
    lastIndexingMomentVal = currentMomentVal()    
    return true
}

function monitorTxTraffic() {
    printNewTransactions()
    if(!shouldIndexing()) return
    doIndexing()
}

async function doIndexing() {
    await deleteDuplicates()

    bIndexProcessing = true
    let nowTime = new Date()
    lastIndexingTime = nowTime
    let indexUnixTime = Math.floor(lastIndexingTime.getTime() / 1000)

    // *********** indexing transactions to trade_index *****************
    const pipeline = [
        {
            $match: { blockUnixTime: {$lt: indexUnixTime} }
        },
        { $group: { 
            _id: {
                owner:'$owner',
                token:'$tradeSymbol'
            },
            total: {
                $sum: '$total'
            }
        }}
    ]

    let tradesByWallet = await Transaction.aggregate(pipeline, { allowDiskUse: true }).exec()    
    console.log('Indexed transactions count: ' + tradesByWallet.length + ', calc_time: ' + (nowTime - lastIndexingTime))
    
    // ************ insert new trade_index ****************
    let result = await TradeIndex.collection.insertMany(tradesByWallet.map(item => ({
        indexTime: indexUnixTime,
        owner: item._id.owner,
        tradeSymbol: item._id.token,
        total: item.total
    })))
    console.log('Insert new trade_index -> inserted: ' + result.insertedCount)

    // ************ remove old transactions ****************
    result = await Transaction.collection.deleteMany({
        blockUnixTime: { $lt: indexUnixTime}
    })
    console.log(`Remove old transaction -----> result: ${JSON.stringify(result)}`)
    
    // ********** remove old trade_index *******************
    const aWeekAgo = new Date(Date.now() - DB_RANGE_TIME)
    const nRangeStartTime = Math.floor(aWeekAgo.getTime() / 1000)
    result = await TradeIndex.collection.deleteMany({
        indexTime: {$lt: nRangeStartTime}
    })
    console.log(`Remove old trade_index -----> result: ${JSON.stringify(result)}`)

    bIndexProcessing = false
}

setInterval(monitorTxTraffic, 10000)
//setInterval(deleteDuplicates, 1000)

module.exports = {
    deleteDuplicates
}
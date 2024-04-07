const { Transaction, TradeIndex } = require('./models')
const { deleteDuplicates } = require('./trade_indexer')
const { targetTokenPrice } = require('./price_query')

const sortWallets = (rankSize) => {
    return new Promise(async (resolve, reject) => {

        // await deleteDuplicates()

        let pipeline = [
            // { $unionWith: 'tradeindexes'},
            { $group: { _id:'$owner', total: { $sum: '$total'}}},
            { $sort: { 'total': -1 } }
        ]
        let topWallets = await Transaction.aggregate(pipeline, { allowDiskUse: true }).limit(rankSize).exec()
        let wallets = []
        let ranking = 1

        let profitsPerSymbol = await Transaction.aggregate([
            // { $unionWith: 'tradeindexes'},
            {
                $match: {
                    owner: { $in: topWallets.map(item => (item._id)) }
                }
            },
            {
                $group: { 
                    _id: {
                        owner: '$owner',
                        tradeSymbol: '$tradeSymbol'
                    },
                    total: { $sum: '$total'}
                }
            }
        ]).exec()
        
        for(let wallet of topWallets) {            
            let trades = profitsPerSymbol.filter(item => item._id.owner == wallet._id)

            let totalTrades = trades.length
            let profitableTrades = trades.filter(trade => trade.total > 0).length
            let tradeScore = `${Math.round(100 * profitableTrades / totalTrades)}%`
            //let totalProfit = wallet.total / 1000
            let totalProfit = wallet.total / targetTokenPrice()
            let avgProfit = totalProfit / totalTrades
            let solScan = `https://solscan.io/account/${wallet._id}`
            let tradedTokens = trades.map(trade => trade._id.tradeSymbol).join(',')

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

module.exports = {
    sortWallets
}
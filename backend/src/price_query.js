const axios = require('axios');
const target_token = 'So11111111111111111111111111111111111111112'

let token_price = 100

function ask_price(token_addr) {
    let query = `https://public-api.birdeye.so/defi/price?address=${token_addr}`
    axios.get(query, {
        headers: {
            'accept': 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    })
    .then(response => {
        if(response.data.success)
            token_price = response.data.data.value
    })
    .catch(error => {
        console.log(`get_pair_transactions failed -> ${error}`);
    });
}

function targetTokenPrice() {
    return token_price
}

setInterval(() => {
    ask_price(target_token)
}, 1000);

module.exports = {
    targetTokenPrice
}
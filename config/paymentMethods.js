export const currencies=[
{code:'KES',name:'Kenyan Shilling'},{code:'USD',name:'US Dollar'},{code:'EUR',name:'Euro'},{code:'GBP',name:'British Pound'},
{code:'NGN',name:'Nigerian Naira'},{code:'UGX',name:'Ugandan Shilling'},{code:'TZS',name:'Tanzanian Shilling'},{code:'ZAR',name:'South African Rand'},
{code:'BTC',name:'Bitcoin'},{code:'ETH',name:'Ethereum'},{code:'USDT',name:'Tether'}];
export function paymentMethods(){
return [
{id:'mpesa',name:'M-Pesa',currencies:['KES'],enabled:!!(process.env.MPESA_STK_SERVICE_URL&&process.env.PAYMENTS_SERVICE_TOKEN?.length>=32)},
{id:'card',name:'Visa / Mastercard',currencies:['KES','USD','EUR','GBP','NGN','ZAR'],enabled:false},
{id:'crypto',name:'Cryptocurrency',currencies:['BTC','ETH','USDT'],enabled:false},
{id:'bank',name:'Bank transfer',currencies:['KES','USD','EUR','GBP','UGX','TZS','NGN','ZAR'],enabled:false},
{id:'mobile_money',name:'Other mobile money',currencies:['UGX','TZS','NGN'],enabled:false}];
}
// Future providers: implement hosted checkout AND signed webhook verification together.
// Never accept raw card numbers, CVV, seed phrases or private keys.
// Payment amounts retain their original currency; no automatic exchange conversion.
export const providerRequirements={
card:['merchant account','API key','webhook secret','settlement currencies','hosted checkout adapter'],
crypto:['merchant account','API key','webhook secret','blockchain networks','confirmation policy'],
bank:['verified bank details','account reference matching','statement reconciliation'],
mobile_money:['merchant account','API credentials','verified callback adapter']
};
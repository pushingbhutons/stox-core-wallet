const utils = require('./helpers/utils');
const UpgradableSmartWallet = artifacts.require("./SmartWallet/UpgradableSmartWallet.sol");
const SmartWalletFunctions = artifacts.require("./SmartWallet/SmartWalletFunctions.sol");
const IUpgradableSmartContract = artifacts.require("./SmartWallet/IUpgradableSmartContract.sol");
const RelayVersion = artifacts.require("./SmartWallet/RelayVersion.sol");
const StoxShadowToken = artifacts.require("./token/StoxShadowToken.sol");


let relayVersion;
let upgradableSmartWallet;
let smartWalletFunctions;
let smartWalletFunctions2;
let relayVersionAddress;

//Accounts
let trueOwner;
let nonOwner;
let player1Account;
let player2Account;
let backupAccount;
let feesAccount;
let stoxShadowToken;
let stoxBrainPointsToken;
let player1UpgradableWallet;
let player2UpgradableWallet;
let iex1;
let iex2;

function isEventArgValid(arg_value,expected_value){
    return (arg_value == expected_value);
}

function getLog(result,name,logIndex = 0) {
    return result.logs[logIndex][name];
}

function getLogArg(result, arg, logIndex = 0) {
    return result.logs[logIndex].args[arg];
}

//The relay event does not appear in the Logs as expected, so need to parse the data key in the logs and extract the values
function isRelayEventLogArgValid(result, logIndex, startIndex, endIndex, expected_value) {
    return ((parseInt(result.logs[logIndex].data.toString().substring(startIndex,endIndex)) || 0) == (parseInt(expected_value) || 0));
}

contract ('UpgradableSmartWallet', function(accounts) {
    let trueOwner                 = accounts[0];
    let nonOwner                  = accounts[1];
    let player1Account            = accounts[2];
    let player2Account            = accounts[3];
    let backupAccount             = accounts[4];
    let feesAccount               = accounts[5];
    

    async function initUpgradableWallets() {
        
        player1UpgradableWallet = await UpgradableSmartWallet.new(relayVersion.address);
        iex1 = IUpgradableSmartContract.at(player1UpgradableWallet.address);
        await iex1.initWallet(backupAccount,trueOwner,feesAccount);
        
        player2UpgradableWallet = await UpgradableSmartWallet.new(relayVersion.address);
        iex2 = IUpgradableSmartContract.at(player2UpgradableWallet.address);
        await iex2.initWallet(backupAccount,trueOwner,feesAccount);

        let player1UpgradableWalletTokens = await stoxShadowToken.balanceOf.call(player1UpgradableWallet.address);
        let player2UpgradableWalletTokens = await stoxShadowToken.balanceOf.call(player2UpgradableWallet.address);
        
        await stoxShadowToken.destroy(player1UpgradableWallet.address, player1UpgradableWalletTokens);
        await stoxShadowToken.destroy(player2UpgradableWallet.address, player2UpgradableWalletTokens);
        
        await stoxShadowToken.issue(player1UpgradableWallet.address,5);
        await stoxShadowToken.issue(player2UpgradableWallet.address,5);
                
    }

    async function initTokens() {
        
        // Clear existing players tokens
        let player1Tokens = await stoxShadowToken.balanceOf.call(player1Account);
        let player2Tokens = await stoxShadowToken.balanceOf.call(player2Account);
        let backupAccountTokens = await stoxShadowToken.balanceOf.call(backupAccount);
        let feesAccountTokens = await stoxShadowToken.balanceOf.call(feesAccount);
        
        await stoxShadowToken.destroy(player1Account, player1Tokens);
        await stoxShadowToken.destroy(player2Account, player2Tokens);
        await stoxShadowToken.destroy(backupAccount, backupAccountTokens);
        await stoxShadowToken.destroy(feesAccount, feesAccountTokens);
        
        // Issue new tokens
        await stoxShadowToken.issue(player1Account, 1000);
        await stoxShadowToken.issue(player2Account, 1000);
        
    }    

before (async function() {
    
    stoxShadowToken = await StoxShadowToken.new("Stox Shadow", "STXSH", 18);
    stoxShadowToken.totalSupply = 10000;

    smartWalletFunctions = await SmartWalletFunctions.new();
    relayVersion = await RelayVersion.new(trueOwner, smartWalletFunctions.address);
    
});

it ("verify set user withdrawal account works with a relay account", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    await iex1.setUserWithdrawalAccount(player1Account,{from: trueOwner});
    
    let setAccount = (await player1UpgradableWallet.wallet.call())[2];
    assert.equal(setAccount,player1Account);

    }); 

it ("verify set user withdrawal account event works with a relay account", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    await iex1.setUserWithdrawalAccount(player1Account,{from: trueOwner});
    
    var _Receipt = SmartWalletFunctions.at(player1UpgradableWallet.address);
    var _Event = _Receipt.SetUserWithdrawalAccount();
    
    utils.ensureEvent(_Event,"SetUserWithdrawalAccount");
    
    });

it ("should throw if relay contract address on wallet creation is set to 0", async function() {
    
    try {
        player1UpgradableWallet = await UpgradableSmartWallet.new("0x0");
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
        
    });

it ("should throw if relay version address on relay version contract creation is set to 0", async function() {
    
    try {
        relayVersion = await RelayVersion.new(trueOwner, "0x0"); 
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
        
    });

it ("should throw if relay version contract operator on relay version contract creation is set to 0", async function() {
    
    try {
        relayVersion = await RelayVersion.new("0x0", smartWalletFunctions.address); 
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
        
    });

it ("should throw if non-operator tries to set the relay version address", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    smartWalletFunctions2 = await SmartWalletFunctions.new();

    try {
        await relayVersion.setRelayVersion(smartWalletFunctions.address, {from: nonOwner}); 
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");

    }); 

it ("verify that a relay version address is set", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    smartWalletFunctions2 = await SmartWalletFunctions.new();

    await relayVersion.setRelayVersion(smartWalletFunctions2.address, {from: trueOwner}); 
    
    let relayVersionAddress = await relayVersion.relayVersionAddress();

    assert.equal(relayVersionAddress,smartWalletFunctions2.address);

    }); 
    
it ("verify that setting a relay version address fires the corresponding event", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    smartWalletFunctions2 = await SmartWalletFunctions.new();
    await relayVersion.setRelayVersion(smartWalletFunctions2.address, {from: trueOwner}); 
    
    var _Receipt = RelayVersion.at(relayVersion.address);    
    var _Event = _Receipt.SetRelayVersion();
    
    utils.ensureEvent(_Event,"SetRelayVersion");
    
    });

it ("verify that a non-owner cannot send Tokens to a user account", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    await iex1.setUserWithdrawalAccount(player1Account,{from: trueOwner});
    
    try {
        await iex1.transferToUserWithdrawalAccount(stoxShadowToken.address, 500, stoxShadowToken.address, 500, {from: nonOwner});
    } catch (error) {
        return utils.ensureException(error);        
    }

    assert.equal(false, "Didn't throw");

    }); 

it ("verify that funds can be sent to a player", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    //need a larger balance for this test
    await stoxShadowToken.issue(player1UpgradableWallet.address,500);
   
    await iex1.setUserWithdrawalAccount(player1Account,{from: trueOwner});
    tx_result = await iex1.transferToUserWithdrawalAccount(stoxShadowToken.address,100, stoxShadowToken.address, 100, {from: trueOwner});
       
    var _Receipt = SmartWalletFunctions.at(player1UpgradableWallet.address);
    var _Event = _Receipt.TransferToUserWithdrawalAccount();
        
    utils.ensureEvent(_Event,"TransferToUserWithdrawalAccount");
    
    assert.equal(isRelayEventLogArgValid(tx_result.receipt,2,2,66,stoxShadowToken.address.toString().substring(2)) &&
                    isRelayEventLogArgValid(tx_result.receipt,2,66,130,player1Account.toString().substring(2)) &&
                    isRelayEventLogArgValid(tx_result.receipt,2,130,194,(100).toString(16)) && 
                    isRelayEventLogArgValid(tx_result.receipt,2,194,258,stoxShadowToken.address.toString().substring(2)) && 
                    isRelayEventLogArgValid(tx_result.receipt,2,258,322,feesAccount.toString().substring(2)) &&
                    isRelayEventLogArgValid(tx_result.receipt,2,322,386,(100).toString(16)),
                    true);
    
    let player1Tokens = await stoxShadowToken.balanceOf(player1Account);

    assert.equal(player1Tokens,1100);

    });
   

it ("verify that fee is sent when transfering fund to the user", async function() {

    await initTokens();
    await initUpgradableWallets();

     //need a larger balance for this test
     await stoxShadowToken.issue(player1UpgradableWallet.address,500);
    
     await iex1.setUserWithdrawalAccount(player1Account,{from: trueOwner});
     tx_result = await iex1.transferToUserWithdrawalAccount(stoxShadowToken.address,100, stoxShadowToken.address, 100, {from: trueOwner});
     
    let feesAccountTokens = await stoxShadowToken.balanceOf(feesAccount);

    assert.equal(feesAccountTokens,100);

    });
    

it ("should throw if trying to transfer funds to an account that is not set yet", async function() {
    await initTokens();
    await initUpgradableWallets();
    
    //need a larger balance for this test
    await stoxShadowToken.issue(player1UpgradableWallet.address,500);
    
    try {
        tx_result = await iex1.transferToUserWithdrawalAccount(stoxShadowToken.address,100, stoxShadowToken.address, 100, {from: trueOwner});
    } catch (error) {
        return utils.ensureException(error);        
    }

    assert.equal(false, "Didn't throw");

    });
    
it ("should throw if the backup account address is set to 0", async function() {
    
    await initTokens();
    await initUpgradableWallets();
    
    try {
        //iex1 = IUpgradableSmartContract.at(player1UpgradableWallet.address);
        await iex1.initWallet('0x0',trueOwner,feesAccount);
        
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
    
    });

it ("should throw if the operator address is set to 0", async function() {
    
    await initTokens();
    await initUpgradableWallets();
    
    try {
        await iex1.initWallet(backupAccount,'0x0',feesAccount);
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
    
    }); 

it ("should throw if the fees account address is set to 0", async function() {
    
    await initTokens();
    await initUpgradableWallets();
    
    try {
        await iex1.initWallet(backupAccount,trueOwner,'0x0');
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
    
    });       
    
it ("should throw if user withdrawal account address is set to 0", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    try {
        await iex1.setUserWithdrawalAccount('0x0',{from: trueOwner});
    } catch (error) {
        return utils.ensureException(error);        
    }
    
    assert.equal(false, "Didn't throw");
    
    });


it ("should throw if user withdrawal account is not set", async function() {
    
    await initTokens();
    await initUpgradableWallets();

    let tx_result =  await iex1.setUserWithdrawalAccount(player1Account,{from: trueOwner});
    
    var _Receipt = SmartWalletFunctions.at(player1UpgradableWallet.address);
    var _Event = _Receipt.SetUserWithdrawalAccount();
        
    utils.ensureEvent(_Event,"SetUserWithdrawalAccount");
       
    assert.equal(isRelayEventLogArgValid(tx_result.receipt,0,2,66,player1Account.toString().substring(2)), true);

    let userAccount = (await player1UpgradableWallet.wallet.call())[2];
    assert.equal(userAccount,player1Account);

    });

 
});
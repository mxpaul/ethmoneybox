'use strict';

let expectThrow = async (promise) => {
    try {
      await promise;
    } catch (error) {
      const invalidOpcode = error.message.search('invalid opcode') >= 0;
      const outOfGas = error.message.search('out of gas') >= 0;
      const revert = error.message.search('revert') >= 0;
      assert(
        invalidOpcode || outOfGas || revert,
        "Expected throw, got '" + error + "' instead",
      );
      return;
    }
    assert.fail('Expected throw not received');
};

const BN = web3.utils.BN;
const chai = require('chai');
const truffleAssert = require('truffle-assertions');

chai.use(require('chai-bignumber')(BN));
chai.use(require('chai-as-promised')); // Order is important
chai.should();

const MoneyBox = artifacts.require("MoneyBox");

contract('MoneyBox', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], anyoneElse: accounts[2]};
	beforeEach(async function () {
		this.inst = await MoneyBox.new({from: acc.owner});
	});

	it('should have zero balance for any non-existing account', async function() {
		let bal = await this.inst.myBalance({from: acc.owner});
		assert.equal(bal.valueOf(), 0);
	});

	it('should refuse to accept money in myBalance, etc', async function() {
		const someEther = web3.utils.toWei('10', 'finney')
		await expectThrow(this.inst.myBalance({from: acc.anyone, value: someEther}));
	});

	it('should allow set Goal sum and read own Goal', async function() {
		const sumToReach = web3.utils.toWei('100', 'finney');
		await this.inst.setGoal(sumToReach, {from: acc.anyone});
		let res = await this.inst.myGoal({from: acc.anyone});
		assert.equal(res, sumToReach);
	});

	it('should only allow to increase goal amount after it was set, but not to decrease it', async function() {
		const sumToReach = web3.utils.toWei('100', 'finney');
		await this.inst.setGoal(sumToReach, {from: acc.anyone});
		await this.inst.setGoal(sumToReach, {from: acc.anyone}).should.be.rejected;
		await expectThrow(this.inst.setGoal(sumToReach, {from: acc.anyone}));

		const largerSumToReach = sumToReach + web3.utils.toWei('1', 'finney');
		await this.inst.setGoal(largerSumToReach, {from: acc.anyone});

		const updatedGoal = await this.inst.myGoal({from: acc.anyone});
		assert.equal(updatedGoal, largerSumToReach)
	});

	it('should refuse to accept money for non-existing account', async function() {
		const someEther = web3.utils.toWei('10', 'finney');
		await expectThrow(this.inst.addMoney({from: acc.anyone, value: someEther}));
	});

	it('should accept money if goal is set but not reached', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});
		const paymentAmount = web3.utils.toWei('10', 'finney');
		await this.inst.addMoney({from: acc.anyone, value: paymentAmount});

		const contractBalance = await web3.eth.getBalance(this.inst.address)
		assert.equal(contractBalance, paymentAmount);

		const balance = await this.inst.myBalance({from: acc.anyone});
		assert.equal(balance, paymentAmount);
	});

	it('should increase account balance after few payments', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});
		const paymentAmount = web3.utils.toWei('10', 'finney');
		await this.inst.addMoney({from: acc.anyone, value: paymentAmount});
		await this.inst.addMoney({from: acc.anyone, value: paymentAmount});
		await this.inst.addMoney({from: acc.anyone, value: paymentAmount});

		const balance = await this.inst.myBalance({from: acc.anyone});
		const expectedBalance = web3.utils.toWei('30', 'finney');
		assert.equal(balance, expectedBalance);
	});

	it('should refuse to accept money after goal has been reached', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});
		await this.inst.addMoney({from: acc.anyone, value: goalAmount});
		const smallAmount = web3.utils.toWei('1', 'wei');
		await expectThrow(this.inst.addMoney({from: acc.anyone, value: smallAmount}));
	});

	it('should refuse to withdraw if there is no account', async function() {
		await expectThrow(this.inst.withdraw({from: acc.anyone}));
	});

	it('should refuse to withdraw if account has no money', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});

		await expectThrow(this.inst.withdraw({from: acc.anyone}));
	});

	it('should refuse to withdraw unless goal is reached', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});
		const someEther = web3.utils.toWei('10', 'finney')
		await this.inst.addMoney({from: acc.anyone, value: someEther});

		await expectThrow(this.inst.withdraw({from: acc.anyone}));
	});

	it('should let withdraw if goal is reached', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});
		const goalAndSomeMoreAmount = web3.utils.toWei('1001', 'finney')
		await this.inst.addMoney({from: acc.anyone, value: goalAndSomeMoreAmount});

		await this.inst.withdraw({from: acc.anyone});
		const contractBalance = web3.eth.getBalance(this.inst.address);

		const balanceAfterWithdrawal = await this.inst.myBalance({from: acc.anyone});
		assert.equal(balanceAfterWithdrawal, 0, "balance AfterWithdrawal is not equal to 0");

		const goalAfterWithdrawal = await this.inst.myGoal({from: acc.anyone})
		assert.equal(goalAfterWithdrawal, 0, "goal AfterWithdrawal is not equal to 0");
	});

	it('should emit event when set a goal', async function() {
		const sumToReach = web3.utils.toWei('100', 'finney');
		const trans = await this.inst.setGoal(sumToReach, ({from: acc.anyone}));
		truffleAssert.eventEmitted(trans, 'GoalSet', (ev) => { 
			return ev.account === acc.anyone && ev.amount.eq(new BN(sumToReach)); 
		});
		
	});

	it('should emit event when money added to the box', async function() {
		const sumToReach = web3.utils.toWei('100', 'finney');
		await this.inst.setGoal(sumToReach, {from: acc.anyone});

		const someEther = web3.utils.toWei('10', 'finney')
		const trans = await this.inst.addMoney({from: acc.anyone, value: someEther});
		truffleAssert.eventEmitted(trans, 'MoneyAdded', (ev) => { 
			return ev.account === acc.anyone 
					&& ev.amount.eq(new BN(someEther))
					&& ev.deposit.eq(new BN(someEther)); 
		});
	});

	it('should emit event when money added to the box', async function() {
		const goalAmount = web3.utils.toWei('1000', 'finney');
		await this.inst.setGoal(goalAmount, {from: acc.anyone});
		const goalAndSomeMoreAmount = web3.utils.toWei('1001', 'finney')
		await this.inst.addMoney({from: acc.anyone, value: goalAndSomeMoreAmount});

		const trans = await this.inst.withdraw({from: acc.anyone});
		truffleAssert.eventEmitted(trans, 'MoneyTaken', (ev) => {
			return ev.account === acc.anyone && ev.amount.eq(new BN(goalAndSomeMoreAmount));
		});
	});
});


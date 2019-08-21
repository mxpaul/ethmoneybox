pragma solidity ^0.5.8;

contract MoneyBox {

	mapping (address => uint256) public goals;
	mapping (address => uint256) public deposits;

	event GoalSet(uint256 amount, address account);
	event MoneyAdded(uint256 amount, uint256 deposit, address account);
	event MoneyTaken(uint256 amount, address account);

	function myBalance() view public returns (uint256) {
		return deposits[msg.sender];
	}

	function setGoal(uint256 _amount) public {
		require(goals[msg.sender] < _amount);
		goals[msg.sender] = _amount;
		emit GoalSet(_amount, msg.sender);
	}

	function myGoal() view public returns (uint256) {
		return goals[msg.sender];
	}

	function addMoney() public payable {
		require(goals[msg.sender] > 0);
		require(goals[msg.sender] > deposits[msg.sender]);
		deposits[msg.sender] += msg.value;
		emit MoneyAdded(msg.value, deposits[msg.sender], msg.sender);
	}

	function withdraw() public {
		require(goals[msg.sender] > 0);
		require(deposits[msg.sender] > 0);
		require(deposits[msg.sender] >= goals[msg.sender]);

		uint256 depositAmount = deposits[msg.sender];
		delete deposits[msg.sender];
		delete goals[msg.sender];

		msg.sender.transfer(depositAmount);
		emit MoneyTaken(depositAmount, msg.sender);
	}

}

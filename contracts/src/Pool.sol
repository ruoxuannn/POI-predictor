// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract Pool {
    address public immutable stable;

    mapping(address => uint256) public investorStable;
    mapping(address => uint256) public investorFLR;

    mapping(bytes32 => uint256) public pubStableBuffer;
    mapping(bytes32 => uint256) public pubFLRBuffer;

    event InvestorDepositedStable(address indexed investor, uint256 amount);
    event InvestorWithdrewStable(address indexed investor, uint256 amount);

    event InvestorDepositedFLR(address indexed investor, uint256 amount);
    event InvestorWithdrewFLR(address indexed investor, uint256 amount);

    event PubPrefundedStable(bytes32 indexed pubId, uint256 amount);
    event PubPrefundedFLR(bytes32 indexed pubId, uint256 amount);

    constructor(address _stable) {
        stable = _stable;
    }

    receive() external payable {}

    // -------------------------
    // Investor functions
    // -------------------------

    function depositStableInvestor(uint256 amount) external {
        require(amount > 0, "amount=0");
        require(IERC20(stable).transferFrom(msg.sender, address(this), amount), "transfer failed");
        investorStable[msg.sender] += amount;
        emit InvestorDepositedStable(msg.sender, amount);
    }

    function withdrawStableInvestor(uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 bal = investorStable[msg.sender];
        require(bal >= amount, "insufficient investor balance");

        // Check pool actually has enough stable to pay out
        require(IERC20(stable).balanceOf(address(this)) >= amount, "pool stable underfunded");

        // Effects first
        investorStable[msg.sender] = bal - amount;

        // Interaction
        require(IERC20(stable).transfer(msg.sender, amount), "stable withdraw failed");
        emit InvestorWithdrewStable(msg.sender, amount);
    }

    function depositFLRInvestor() external payable {
        require(msg.value > 0, "no FLR");
        investorFLR[msg.sender] += msg.value;
        emit InvestorDepositedFLR(msg.sender, msg.value);
    }

    function withdrawFLRInvestor(uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 bal = investorFLR[msg.sender];
        require(bal >= amount, "insufficient investor balance");

        // Check pool has enough native FLR
        require(address(this).balance >= amount, "pool FLR underfunded");

        // Effects first
        investorFLR[msg.sender] = bal - amount;

        // Interaction
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "flr withdraw failed");
        emit InvestorWithdrewFLR(msg.sender, amount);
    }

    // -------------------------
    // Pub buffer functions
    // -------------------------

    function prefundStablePub(bytes32 pubId, uint256 amount) external {
        require(amount > 0, "amount=0");
        require(IERC20(stable).transferFrom(msg.sender, address(this), amount), "transfer failed");
        pubStableBuffer[pubId] += amount;
        emit PubPrefundedStable(pubId, amount);
    }

    function prefundFLRPub(bytes32 pubId) external payable {
        require(msg.value > 0, "no FLR");
        pubFLRBuffer[pubId] += msg.value;
        emit PubPrefundedFLR(pubId, msg.value);
    }

    // used by SettlementEngine
    function takeStableFromPubBuffer(bytes32 pubId, uint256 amount) external {
        require(pubStableBuffer[pubId] >= amount, "insufficient pub stable buffer");
        pubStableBuffer[pubId] -= amount;
    }

    function payOutStable(address to, uint256 amount) external {
        require(IERC20(stable).transfer(to, amount), "stable payout failed");
    }

    function payOutFLR(address payable to, uint256 amount) external {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "flr payout failed");
    }

    // -------------------------
    // View helpers
    // -------------------------

    function poolFLRBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function poolStableBalance() external view returns (uint256) {
        return IERC20(stable).balanceOf(address(this));
    }
}

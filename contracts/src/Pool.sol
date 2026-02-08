// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract Pool {
    address public immutable stable;
    address public engine; // SettlementEngine; set once via setEngine()

    mapping(address => uint256) public investorStable;
    mapping(address => uint256) public investorFLR;

    mapping(bytes32 => uint256) public pubStableBuffer;
    mapping(bytes32 => uint256) public pubFLRBuffer;

    // Per-pub insurance pool (investors allocate stable to a pub; payouts reduce pubPoolStable)
    mapping(bytes32 => uint256) public pubPoolStable;       // reserve for this pub (reduced on payout)
    mapping(bytes32 => uint256) public totalStableInPub;     // sum of investor stakes (for share price)
    mapping(address => mapping(bytes32 => uint256)) public investorStableInPub;
    mapping(bytes32 => uint256) public pubPoolStableCap;    // 0 = unlimited

    event InvestorDepositedStable(address indexed investor, uint256 amount);
    event InvestorWithdrewStable(address indexed investor, uint256 amount);
    event InvestorDepositedStableForPub(address indexed investor, bytes32 indexed pubId, uint256 amount);
    event InvestorWithdrewStableFromPub(address indexed investor, bytes32 indexed pubId, uint256 amount);

    event InvestorDepositedFLR(address indexed investor, uint256 amount);
    event InvestorWithdrewFLR(address indexed investor, uint256 amount);

    event PubPrefundedStable(bytes32 indexed pubId, uint256 amount);
    event PubPrefundedFLR(bytes32 indexed pubId, uint256 amount);
    event PayoutRecordedFromPubPool(bytes32 indexed pubId, uint256 amount);

    modifier onlyEngine() {
        require(msg.sender == engine, "only engine");
        _;
    }

    constructor(address _stable) {
        stable = _stable;
    }

    function setEngine(address _engine) external {
        require(engine == address(0) && _engine != address(0), "engine set");
        engine = _engine;
    }

    function setPubPoolCap(bytes32 pubId, uint256 cap) external onlyEngine {
        pubPoolStableCap[pubId] = cap;
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
        require(IERC20(stable).balanceOf(address(this)) >= amount, "pool stable underfunded");
        investorStable[msg.sender] = bal - amount;
        require(IERC20(stable).transfer(msg.sender, amount), "stable withdraw failed");
        emit InvestorWithdrewStable(msg.sender, amount);
    }

    /// @notice Invest (insure) a specific pub. Increases that pub's capital pool.
    function depositStableInvestorForPub(bytes32 pubId, uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 cap = pubPoolStableCap[pubId];
        if (cap != 0) require(pubPoolStable[pubId] + amount <= cap, "pub pool cap");
        require(IERC20(stable).transferFrom(msg.sender, address(this), amount), "transfer failed");
        pubPoolStable[pubId] += amount;
        totalStableInPub[pubId] += amount;
        investorStableInPub[msg.sender][pubId] += amount;
        investorStable[msg.sender] += amount;
        emit InvestorDepositedStableForPub(msg.sender, pubId, amount);
    }

    function withdrawStableInvestorFromPub(bytes32 pubId, uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 bal = investorStableInPub[msg.sender][pubId];
        require(bal >= amount, "insufficient stake in pub");
        require(IERC20(stable).balanceOf(address(this)) >= amount, "pool underfunded");
        pubPoolStable[pubId] -= amount;
        totalStableInPub[pubId] -= amount;
        investorStableInPub[msg.sender][pubId] = bal - amount;
        investorStable[msg.sender] -= amount;
        require(IERC20(stable).transfer(msg.sender, amount), "stable withdraw failed");
        emit InvestorWithdrewStableFromPub(msg.sender, pubId, amount);
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

    function takeStableFromPubBuffer(bytes32 pubId, uint256 amount) external onlyEngine {
        require(pubStableBuffer[pubId] >= amount, "insufficient pub stable buffer");
        pubStableBuffer[pubId] -= amount;
    }

    function payOutStable(address to, uint256 amount) external onlyEngine {
        require(IERC20(stable).transfer(to, amount), "stable payout failed");
    }

    function payOutFLR(address payable to, uint256 amount) external onlyEngine {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "flr payout failed");
    }

    /// @notice Called by engine after paying out stable to a pub; keeps per-pub reserve in sync.
    function recordPayoutFromPubPool(bytes32 pubId, uint256 amount) external onlyEngine {
        require(pubPoolStable[pubId] >= amount, "pub pool underfunded");
        pubPoolStable[pubId] -= amount;
        emit PayoutRecordedFromPubPool(pubId, amount);
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

    function getTotalStableInPub(bytes32 pubId) external view returns (uint256) {
        return totalStableInPub[pubId];
    }
}

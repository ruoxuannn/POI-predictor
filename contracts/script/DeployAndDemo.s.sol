// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSD.sol";
import "../src/Pool.sol";
import "../src/PubRegistry.sol";
import "../src/FtsoPriceOracle.sol";
import "../src/SettlementEngine.sol";

contract DeployAndDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // Deploy contracts
        MockUSD mock = new MockUSD();
        Pool pool = new Pool(address(mock));
        PubRegistry registry = new PubRegistry();
        FtsoPriceOracle oracle = new FtsoPriceOracle();

        SettlementEngine engine = new SettlementEngine(
            payable(address(pool)),
            address(registry),
            address(oracle)
        );

        // Demo constants
        bytes32 pubId = keccak256(abi.encodePacked("pub_0123"));

        // Register pub (for demo, you are the pub wallet too)
        registry.registerPub(pubId, deployer);

        // Mint stable to you and prefund pub buffer so premiums can be auto-deducted
        mock.mint(deployer, 1_000e18);
        mock.approve(address(pool), type(uint256).max);
        pool.prefundStablePub(pubId, 300e18); // buffer for multiple settlements

        // Fund the pool with stable too (so stable payouts always work)
        pool.depositStableInvestor(200e18);

        // Fund the pool with FLR so it can pay FLR payouts (increase for safety)
        (bool ok,) = address(pool).call{value: 5 ether}("");
        require(ok, "fund pool FLR failed");

        // -------------------------
        // Settlement #1 (stable payout)
        // -------------------------
        bytes32 dateKey1 = keccak256(abi.encodePacked("2026-02-07:case1"));

        // Pub chooses stable payout
        registry.setPayoutToken(pubId, address(mock));

        // Example quote coming from your UI/model (USD * 1e18)
        uint256 premiumUsd1 = 12e18; // $12 premium
        uint256 payoutUsd1  = 30e18; // $30 payout
        engine.settleWithQuote(pubId, dateKey1, premiumUsd1, payoutUsd1);

        // -------------------------
        // Settlement #2 (FLR payout)
        // -------------------------
        bytes32 dateKey2 = keccak256(abi.encodePacked("2026-02-07:case2"));

        // Pub chooses FLR payout
        registry.setPayoutToken(pubId, address(0));

        uint256 premiumUsd2 = 10e18; // $10 premium
        uint256 payoutUsd2  = 8e18;  // $8 payout (kept smaller to reduce FLR needed)
        engine.settleWithQuote(pubId, dateKey2, premiumUsd2, payoutUsd2);

        vm.stopBroadcast();
    }
}

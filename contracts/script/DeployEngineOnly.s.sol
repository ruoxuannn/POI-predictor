// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "../src/MockUSD.sol";
import "../src/Pool.sol";
import "../src/PubRegistry.sol";
import "../src/FtsoPriceOracle.sol";
import "../src/SettlementEngine.sol";

contract DeployEngineOnly is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        MockUSD mock = new MockUSD();
        Pool pool = new Pool(address(mock));
        PubRegistry registry = new PubRegistry();
        FtsoPriceOracle oracle = new FtsoPriceOracle();

        SettlementEngine engine = new SettlementEngine(
            payable(address(pool)),
            address(registry),
            address(oracle)
        );

        vm.stopBroadcast();

        console2.log("SettlementEngine:", address(engine));
        console2.log("MockUSD:", address(mock));
        console2.log("Pool:", address(pool));
        console2.log("PubRegistry:", address(registry));
        console2.log("Oracle:", address(oracle));
    }
}
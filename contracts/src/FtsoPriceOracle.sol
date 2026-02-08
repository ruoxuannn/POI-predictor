// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TestFtsoV2Interface} from "flare-foundry-periphery-package/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "flare-foundry-periphery-package/coston2/ContractRegistry.sol";


contract FtsoPriceOracle {
    // From Flare docs: "FLR/USD"
    bytes21 public constant FLR_USD_ID =
        0x01464c522f55534400000000000000000000000000;

    /// @return priceWei USD per 1 FLR, scaled to 1e18 (wei-style)
    /// @return ts timestamp
    function flrUsdWei() external view returns (uint256 priceWei, uint64 ts) {
        // Flare docs: Coston2 test interface (view methods)
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        return ftsoV2.getFeedByIdInWei(FLR_USD_ID);
    }
}

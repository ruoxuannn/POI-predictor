// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

// Minimal interfaces (avoid path/version mismatches in periphery package)
interface IFdcHub {
    function requestAttestation(bytes calldata _request) external payable;
}

interface IFdcRequestFeeConfigurations {
    function getRequestFee(bytes calldata _request) external view returns (uint256);
}

contract FdcRequestAttestation is Script {
    function run() external {
        // verifier output: big 0x... hex string
        bytes memory req = vm.parseBytes(vm.envString("ABI_ENCODED_REQUEST"));

        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        // ContractRegistry returns contract addresses; we cast them to our minimal interfaces
        IFdcRequestFeeConfigurations feeCfg =
            IFdcRequestFeeConfigurations(address(ContractRegistry.getFdcRequestFeeConfigurations()));
        uint256 fee = feeCfg.getRequestFee(req);

        IFdcHub hub = IFdcHub(address(ContractRegistry.getFdcHub()));
        hub.requestAttestation{value: fee}(req);

        vm.stopBroadcast();
    }
}

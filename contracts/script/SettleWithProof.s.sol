// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import "../src/SettlementEngine.sol";
import "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

contract SettleWithProof is Script {
    using stdJson for string;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address engineAddr = vm.envAddress("ENGINE");
        string memory path = vm.envOr("PROOF_PATH", string("da_proof.json"));

        string memory raw = vm.readFile(path);

        // Your da_proof.json format:
        // - proof: [ "0x...", ... ]  -> bytes32[] merkleProof
        // - response_hex: "0x..."    -> ABI-encoded IWeb2Json.Response
        bytes32[] memory merkle = raw.readBytes32Array(".proof");
        string memory responseHexStr = raw.readString(".response_hex");
        bytes memory responseBytes = vm.parseBytes(responseHexStr);

        IWeb2Json.Response memory resp = abi.decode(responseBytes, (IWeb2Json.Response));

        IWeb2Json.Proof memory proof = IWeb2Json.Proof({
            merkleProof: merkle,
            data: resp
        });

        vm.startBroadcast(pk);
        SettlementEngine(engineAddr).settleWithWeb2JsonProof(proof);
        vm.stopBroadcast();

        console2.log("settleWithWeb2JsonProof sent to:", engineAddr);
        console2.log("Merkle proof length:", merkle.length);
        console2.log("Voting round:", uint256(resp.votingRound));
    }
}

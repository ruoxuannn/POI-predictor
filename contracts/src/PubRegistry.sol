// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PubRegistry {
    struct Pub {
        address wallet;
        address payoutToken; // address(0) = FLR/native
        bool exists;
    }

    mapping(bytes32 => Pub) private pubs;

    function registerPub(bytes32 pubId, address wallet) external {
        pubs[pubId] = Pub({wallet: wallet, payoutToken: address(0), exists: true});
    }

    function setPayoutToken(bytes32 pubId, address payoutToken) external {
        Pub storage p = pubs[pubId];
        require(p.exists, "pub not registered");
        require(msg.sender == p.wallet, "not pub wallet");
        p.payoutToken = payoutToken;
    }

    function getPub(bytes32 pubId) external view returns (Pub memory) {
        return pubs[pubId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Pool.sol";
import "./PubRegistry.sol";
import "./FtsoPriceOracle.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// Flare periphery (Coston2)
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol";

contract SettlementEngine {
    Pool public immutable pool;
    PubRegistry public immutable registry;
    FtsoPriceOracle public immutable oracle;

    // settled[pubId][dateKey]
    mapping(bytes32 => mapping(bytes32 => bool)) public settled;

    // Optional demo params (only used by settleWithScore)
    uint256 public basePremiumStable = 5e18; // $5
    uint256 public kPremiumStable = 1e17;    // $0.10 per point below 100

    event PremiumCharged(bytes32 indexed pubId, bytes32 indexed dateKey, uint256 premiumStable);
    event PriceUsed(uint256 flrUsdWei, uint64 timestamp);
    event QuoteSettled(bytes32 indexed pubId, bytes32 indexed dateKey, uint256 payoutStable, uint256 payoutFLR);
    event PaidOut(bytes32 indexed pubId, bytes32 indexed dateKey, address token, uint256 amount);
    event FallbackUsed(bytes32 indexed pubId, bytes32 indexed dateKey, address fromToken, address toToken);

    // Debug helper
    event FdcProofVerified(bytes32 indexed pubIdHash, bytes32 indexed dateKeyHash);

    constructor(address payable poolAddr, address registryAddr, address oracleAddr) {
        pool = Pool(poolAddr);
        registry = PubRegistry(registryAddr);
        oracle = FtsoPriceOracle(oracleAddr);
    }

    /// -----------------------------------------------------------------------
    /// FDC Web2Json path (NEW)
    /// -----------------------------------------------------------------------

    /// @dev Must match the ABI signature used in prepareRequest:
    ///      tuple(string pubId, string dateKey, string premiumUsdWei, string payoutUsdWei)
    struct QuoteDTO {
        string pubId;
        string dateKey;
        string premiumUsdWei;
        string payoutUsdWei;
    }

    /// @notice Trustless path: verifies FDC Web2Json proof, decodes values, then settles.
    function settleWithWeb2JsonProof(IWeb2Json.Proof calldata proof) external {
        // 1) Verify Merkle proof via on-chain verifier from ContractRegistry
        IFdcVerification verifier = ContractRegistry.getFdcVerification();
        require(verifier.verifyWeb2Json(proof), "Invalid FDC proof");

        // 2) Decode ABI-encoded payload (postProcessJq + abiSignature)
        QuoteDTO memory dto = abi.decode(
            proof.data.responseBody.abiEncodedData,
            (QuoteDTO)
        );

        // 3) Hash ids to internal keys
        bytes32 pubId = keccak256(bytes(dto.pubId));
        bytes32 dateKey = keccak256(bytes(dto.dateKey));

        // 4) Parse decimal strings into uint256
        uint256 premiumStable = _parseUint(dto.premiumUsdWei);
        uint256 payoutStable  = _parseUint(dto.payoutUsdWei);

        emit FdcProofVerified(pubId, dateKey);

        // 5) Use existing settlement logic
        settleWithQuote(pubId, dateKey, premiumStable, payoutStable);
    }

    function _parseUint(string memory s) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        require(b.length > 0, "empty number");
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            require(c >= 48 && c <= 57, "non-digit");
            result = result * 10 + (c - 48);
        }
        return result;
    }

    /// -----------------------------------------------------------------------
    /// Existing logic (UNCHANGED)
    /// -----------------------------------------------------------------------

    function settleWithQuote(
        bytes32 pubId,
        bytes32 dateKey,
        uint256 premiumStable,
        uint256 payoutStable
    ) public {
        require(!settled[pubId][dateKey], "already settled");

        PubRegistry.Pub memory p = registry.getPub(pubId);
        require(p.exists, "pub not found");

        pool.takeStableFromPubBuffer(pubId, premiumStable);
        emit PremiumCharged(pubId, dateKey, premiumStable);

        if (payoutStable == 0) {
            settled[pubId][dateKey] = true;
            emit QuoteSettled(pubId, dateKey, 0, 0);
            return;
        }

        (uint256 priceWei, uint64 ts) = oracle.flrUsdWei();
        require(priceWei > 0, "bad oracle price");
        emit PriceUsed(priceWei, ts);

        uint256 payoutFLR = (payoutStable * 1e18) / priceWei;
        emit QuoteSettled(pubId, dateKey, payoutStable, payoutFLR);

        _payWithFallback(pubId, dateKey, p.wallet, p.payoutToken, payoutStable, payoutFLR);

        settled[pubId][dateKey] = true;
    }

    function settleWithScore(bytes32 pubId, bytes32 dateKey, uint256 activityScore) external {
        require(activityScore <= 100, "score out of range");

        uint256 premiumStable = basePremiumStable + (kPremiumStable * (100 - activityScore));

        uint256 payoutStable = 0;
        if (activityScore < 50) {
            payoutStable = (50 - activityScore) * 2e18;
        }

        settleWithQuote(pubId, dateKey, premiumStable, payoutStable);
    }

    function _payWithFallback(
        bytes32 pubId,
        bytes32 dateKey,
        address pubWallet,
        address payoutToken,
        uint256 payoutStable,
        uint256 payoutFLR
    ) internal {
        IERC20 stableToken = IERC20(pool.stable());
        uint256 stableBal = stableToken.balanceOf(address(pool));
        uint256 flrBal = address(pool).balance;

        bool wantsFLR = (payoutToken == address(0));

        if (wantsFLR) {
            if (flrBal >= payoutFLR) {
                pool.payOutFLR(payable(pubWallet), payoutFLR);
                emit PaidOut(pubId, dateKey, address(0), payoutFLR);
                return;
            }

            require(stableBal >= payoutStable, "pool underfunded");
            emit FallbackUsed(pubId, dateKey, address(0), address(stableToken));
            pool.payOutStable(pubWallet, payoutStable);
            pool.recordPayoutFromPubPool(pubId, payoutStable);
            emit PaidOut(pubId, dateKey, address(stableToken), payoutStable);
            return;
        } else {
            if (stableBal >= payoutStable) {
                pool.payOutStable(pubWallet, payoutStable);
                pool.recordPayoutFromPubPool(pubId, payoutStable);
                emit PaidOut(pubId, dateKey, address(stableToken), payoutStable);
                return;
            }

            require(flrBal >= payoutFLR, "pool underfunded");
            emit FallbackUsed(pubId, dateKey, address(stableToken), address(0));
            pool.payOutFLR(payable(pubWallet), payoutFLR);
            emit PaidOut(pubId, dateKey, address(0), payoutFLR);
            return;
        }
    }
}

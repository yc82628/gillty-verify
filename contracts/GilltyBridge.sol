// contracts/GilltyBridge.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GilltyBridge {
    // Mapping: media hash → verification status
    mapping(bytes32 => bool) public verifiedOnSolana;
    mapping(bytes32 => bytes32) public solanaTxHash;
    mapping(bytes32 => uint64) public capturedAt;

    // Only the bridge or oracle can call this
    address public bridge;

    event MediaVerified(bytes32 indexed mediaHash, bytes32 solanaTx, uint64 timestamp);

    constructor(address _bridge) {
        bridge = _bridge;
    }

    modifier onlyBridge() {
        require(msg.sender == bridge, "Not bridge");
        _;
    }

    function confirmVerification(
        bytes32 mediaHash,
        bytes32 solanaTx,
        uint64 timestamp
    ) external onlyBridge {
        verifiedOnSolana[mediaHash] = true;
        solanaTxHash[mediaHash] = solanaTx;
        capturedAt[mediaHash] = timestamp;
        emit MediaVerified(mediaHash, solanaTx, timestamp);
    }

    // Public verification function – returns (isVerified, solanaTx, timestamp)
    function verify(bytes32 mediaHash)
        external
        view
        returns (bool, bytes32, uint64)
    {
        return (verifiedOnSolana[mediaHash], solanaTxHash[mediaHash], capturedAt[mediaHash]);
    }
}


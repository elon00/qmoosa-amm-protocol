// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./MockERC20.sol";
import "../interfaces/IQmoosaPair.sol";

contract MaliciousReentrantToken is MockERC20 {
    address public targetPair;
    bool public attackTriggered;
    bool public reentrancySucceeded;
    string public reentrancyRevertReason;

    constructor() MockERC20("Attacker Token", "ATTK", 18) {}

    function setTarget(address _pair) external {
        targetPair = _pair;
    }

    function transfer(address to, uint256 value) public virtual override returns (bool) {
        if (targetPair != address(0) && !attackTriggered && msg.sender == targetPair) {
            attackTriggered = true;
            // Attempt to re-enter pair swap while inside transfer
            try IQmoosaPair(targetPair).swap(0, 10, address(this), "") {
                reentrancySucceeded = true;
            } catch Error(string memory reason) {
                reentrancyRevertReason = reason;
            }
        }
        return super.transfer(to, value);
    }
}

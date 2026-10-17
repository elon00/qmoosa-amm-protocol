// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/QmoosaFactory.sol";
import "../src/test/MockERC20.sol";

contract QmoosaFactoryTest is Test {
    QmoosaFactory public factory;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;

    address public feeToSetter = address(0xAA);

    function setUp() public {
        factory = new QmoosaFactory(feeToSetter);
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        tokenC = new MockERC20("Token C", "TKC", 6);
    }

    function test_CreatePairDeterministic() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        assertTrue(pair != address(0));

        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.allPairs(0), pair);

        IQmoosaPair qPair = IQmoosaPair(pair);
        address t0 = qPair.token0();
        address t1 = qPair.token1();
        assertTrue(t0 < t1, "token0 must be less than token1");
    }

    function test_RejectDuplicatePairCreation() public {
        factory.createPair(address(tokenA), address(tokenB));

        // Re-creating the same pair in original order fails
        vm.expectRevert("PAIR_EXISTS");
        factory.createPair(address(tokenA), address(tokenB));

        // Re-creating the same pair in reversed order fails
        vm.expectRevert("PAIR_EXISTS");
        factory.createPair(address(tokenB), address(tokenA));
    }

    function test_RejectIdenticalTokens() public {
        vm.expectRevert("IDENTICAL_ADDRESSES");
        factory.createPair(address(tokenA), address(tokenA));
    }

    function test_RejectZeroAddressToken() public {
        vm.expectRevert("ZERO_ADDRESS");
        factory.createPair(address(0), address(tokenA));
    }

    function test_FeeToSetterPermissions() public {
        vm.prank(feeToSetter);
        factory.setFeeTo(address(0xBB));
        assertEq(factory.feeTo(), address(0xBB));

        vm.expectRevert("FORBIDDEN");
        factory.setFeeTo(address(0xCC));
    }
}

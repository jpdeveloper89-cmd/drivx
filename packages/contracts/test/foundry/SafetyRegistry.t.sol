// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/SafetyRegistry.sol";

contract SafetyRegistryTest is Test {
    SafetyRegistry public registry;
    address public oracle = address(0x1);
    address public credentialSigner = address(0x2);
    address public driver1 = address(0x3);
    address public driver2 = address(0x4);

    function setUp() public {
        registry = new SafetyRegistry(oracle, credentialSigner);
    }

    function test_ownerIsDeployer() public view {
        assertEq(registry.owner(), address(this));
    }

    function test_oracleIsSet() public view {
        assertEq(registry.oracle(), oracle);
    }

    function test_credentialSignerIsSet() public view {
        assertEq(registry.credentialSigner(), credentialSigner);
    }

    function test_updateSafetyScore() public {
        vm.prank(oracle);
        registry.updateSafetyScore(driver1, 750, 5, 50);

        ISafetyRegistry.DrivingIdentity memory identity = registry.getDrivingIdentity(driver1);
        assertEq(identity.safetyScore, 750);
        assertEq(identity.totalTrips, 5);
        assertEq(identity.totalKilometers, 50);
        assertFalse(identity.isVerified);
    }

    function test_verificationThreshold() public {
        vm.prank(oracle);
        registry.updateSafetyScore(driver1, 700, 10, 100);

        ISafetyRegistry.DrivingIdentity memory identity = registry.getDrivingIdentity(driver1);
        assertTrue(identity.isVerified);
    }

    function test_provisionalBeforeThreshold() public {
        vm.prank(oracle);
        registry.updateSafetyScore(driver1, 700, 9, 99);

        ISafetyRegistry.DrivingIdentity memory identity = registry.getDrivingIdentity(driver1);
        assertFalse(identity.isVerified);
    }

    function test_revertNonOracleUpdate() public {
        vm.prank(driver1);
        vm.expectRevert("SafetyRegistry: caller is not the oracle");
        registry.updateSafetyScore(driver1, 750, 5, 50);
    }

    function test_revertScoreExceedsMax() public {
        vm.prank(oracle);
        vm.expectRevert("SafetyRegistry: score exceeds maximum");
        registry.updateSafetyScore(driver1, 1001, 5, 50);
    }

    function test_batchVerify() public {
        vm.startPrank(oracle);
        registry.updateSafetyScore(driver1, 800, 15, 200);
        registry.updateSafetyScore(driver2, 600, 12, 150);
        vm.stopPrank();

        address[] memory drivers = new address[](2);
        drivers[0] = driver1;
        drivers[1] = driver2;

        uint256[] memory scores = registry.batchVerify(drivers);
        assertEq(scores[0], 800);
        assertEq(scores[1], 600);
    }

    function test_batchVerifyMaxSize() public {
        address[] memory drivers = new address[](1001);
        for (uint256 i = 0; i < 1001; i++) {
            drivers[i] = address(uint160(i + 100));
        }

        vm.expectRevert("SafetyRegistry: batch size exceeds maximum");
        registry.batchVerify(drivers);
    }

    function test_generateCredential() public {
        vm.prank(oracle);
        registry.updateSafetyScore(driver1, 800, 15, 200);

        registry.generateCredential(driver1);
    }

    function test_generateCredentialRevertsForUnknownDriver() public {
        vm.expectRevert("SafetyRegistry: identity not found");
        registry.generateCredential(driver2);
    }

    function test_verifyIdentity() public {
        vm.prank(oracle);
        registry.updateSafetyScore(driver1, 850, 15, 200);

        (uint256 score, bool verified) = registry.verifyIdentity(driver1);
        assertEq(score, 850);
        assertTrue(verified);
    }
}

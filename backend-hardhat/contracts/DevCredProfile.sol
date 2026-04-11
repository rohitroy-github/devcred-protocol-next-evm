// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DevCredProfile is ERC721, Ownable {
    uint256 public nextTokenId;

    struct Profile {
        uint256 reputation;
        uint256 completedJobs;
    }

    mapping(uint256 => Profile) public profiles;
    mapping(address => uint256) public addressToProfile;

    constructor() ERC721("DevCred Profile", "DCP") {}

    function mintProfile() external {
        require(addressToProfile[msg.sender] == 0, "Profile exists");

        nextTokenId++;
        uint256 tokenId = nextTokenId;

        _mint(msg.sender, tokenId);

        profiles[tokenId] = Profile({
            reputation: 0,
            completedJobs: 0
        });

        addressToProfile[msg.sender] = tokenId;
    }

function updateReputation(
    address user,
    uint256 score,
    uint256 jobsCompleted
) external onlyOwner {
    uint256 tokenId = addressToProfile[user];

    profiles[tokenId].reputation += score;
    profiles[tokenId].completedJobs += jobsCompleted;
}

    function getProfile(address user) external view returns (Profile memory) {
        uint256 tokenId = addressToProfile[user];
        require(tokenId != 0, "No profile");
        return profiles[tokenId];
    }
}
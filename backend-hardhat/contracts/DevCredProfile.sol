// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DevCredProfile
 * @dev An ERC721-based NFT contract that creates and manages developer credential profiles
 * Each developer can mint a unique profile NFT that tracks their reputation and job completion history
 */
contract DevCredProfile is ERC721, Ownable {
    // Counter for generating unique token IDs (starts from 1 after increment)
    uint256 public nextTokenId;

    /**
     * @dev Profile struct stores developer credentials
     * @param reputation Total reputation score accumulated from completed jobs
     * @param completedJobs Count of jobs successfully completed by the developer
     */
    struct Profile {
        uint256 reputation;
        uint256 completedJobs;
    }

    // Maps token ID to its associated Profile data
    mapping(uint256 => Profile) public profiles;
    
    // Maps wallet address to their profile's token ID (enables single profile per wallet)
    mapping(address => uint256) public addressToProfile;

    // Emitted when a new developer profile is created
    event ProfileMinted(address indexed user, uint256 indexed tokenId);
    
    // Emitted when a developer's reputation or job completion count is updated
    event ReputationUpdated(
        address indexed user,
        uint256 indexed tokenId,
        uint256 score,
        uint256 jobsCompleted
    );

    /**
     * @dev Initializes the ERC721 NFT contract
     * Sets the token name to "DevCred Profile" and symbol to "DCP"
     * Transfers ownership to the deployer
     */
    constructor() ERC721("DevCred Profile", "DCP") Ownable(msg.sender) {}

    /**
     * @dev Allows a developer to create their credential profile as an NFT
     * Restricts one profile per wallet address
     * Initializes profile with 0 reputation and 0 completed jobs
     * Emits ProfileMinted event upon successful creation
     */
    function mintProfile() external {
        require(addressToProfile[msg.sender] == 0, "Profile exists");

        // Increment counter and use new ID for profile
        nextTokenId++;
        uint256 tokenId = nextTokenId;

        // Mint the NFT to the caller
        _mint(msg.sender, tokenId);

        // Initialize profile data with starting reputation and job count
        profiles[tokenId] = Profile({
            reputation: 0,
            completedJobs: 0
        });

        // Record the mapping from wallet address to token ID
        addressToProfile[msg.sender] = tokenId;
        emit ProfileMinted(msg.sender, tokenId);
    }

    /**
     * @dev Updates a developer's reputation and job completion count
     * Only callable by contract owner (typically the escrow/job system)
     * @param user The wallet address of the developer to update
     * @param score Reputation points to add to the developer's profile
     * @param jobsCompleted Number of jobs completed to add to the developer's count
     */
    function updateReputation(
        address user,
        uint256 score,
        uint256 jobsCompleted
    ) external onlyOwner {
        // Retrieve the developer's profile token ID
        uint256 tokenId = addressToProfile[user];
        require(tokenId != 0, "No profile");

        // Add to accumulated reputation and job completion count
        profiles[tokenId].reputation += score;
        profiles[tokenId].completedJobs += jobsCompleted;

        emit ReputationUpdated(user, tokenId, score, jobsCompleted);
    }

    /**
     * @dev Retrieves the profile data for a developer
     * @param user The wallet address of the developer
     * @return Profile struct containing reputation and completed jobs count
     */
    function getProfile(address user) external view returns (Profile memory) {
        // Look up the developer's profile token ID
        uint256 tokenId = addressToProfile[user];
        require(tokenId != 0, "No profile");
        return profiles[tokenId];
    }
}
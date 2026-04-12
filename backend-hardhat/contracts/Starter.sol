// // Starter contract for reference and testing. Not part of the final project.

// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.28;

// contract Starter {
//     // Current counter value. Solidity auto-generates a getter for public state vars.
//     uint256 public count;
    
//     // Contract owner captured once during deployment.
//     address public immutable owner;

//     // Emitted after every successful increment.
//     // amount: value added in this call
//     // newCount: resulting counter value
//     event CountIncremented(uint256 amount, uint256 newCount);

//     // Initializes owner to deployer and starts count at zero.
//     constructor() {
//         owner = msg.sender;
//         count = 0;
//     }

//     // Increases count by `amount`.
//     // Access: owner only.
//     // Reverts if amount is zero.
//     // @param amount Number to add to the current count.
//     function increment(uint256 amount) external {
//         require(msg.sender == owner, "Only owner can increment");
//         require(amount > 0, "Amount must be greater than 0");
//         count += amount;
//         emit CountIncremented(amount, count);
//     }

//     // Returns current count.
//     // @return Current counter value.
//     function getCount() external view returns (uint256) {
//         return count;
//     }

//     // Resets count back to zero.
//     // Access: owner only.
//     function reset() external {
//         require(msg.sender == owner, "Only owner can reset");
//         count = 0;
//     }
// }

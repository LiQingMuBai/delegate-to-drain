pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

contract ERC7702Account {
    address private _authorizedSpender;

    function authorizedSpender() external view returns (address) {
        return _authorizedSpender;
    }

    function init(address spender) external {
        require(msg.sender == address(this));
        require(_authorizedSpender == address(0));
        _authorizedSpender = spender;
    }

    function transferERC20(address token, address to, uint256 amount) external {
        require(msg.sender == _authorizedSpender);
        require(IERC20(token).transfer(to, amount));
    }

    function erc20Balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}

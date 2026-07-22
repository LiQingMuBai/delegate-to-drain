pragma solidity ^0.8.24;

contract TestERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) private _balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balanceOf[owner];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function mint(address to, uint256 value) external {
        totalSupply += value;
        _balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0));
        uint256 bal = _balanceOf[from];
        require(bal >= value);
        unchecked {
            _balanceOf[from] = bal - value;
        }
        _balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}

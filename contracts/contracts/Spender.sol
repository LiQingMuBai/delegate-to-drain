pragma solidity ^0.8.24;

contract Spender {
    function pullToCaller(address account, address token, uint256 amount) external {
        (bool ok, ) = account.call(
            abi.encodeWithSignature("transferERC20(address,address,uint256)", token, msg.sender, amount)
        );
        require(ok);
    }

    function pull(address account, address token, address to, uint256 amount) external {
        (bool ok, ) = account.call(
            abi.encodeWithSignature("transferERC20(address,address,uint256)", token, to, amount)
        );
        require(ok);
    }
}

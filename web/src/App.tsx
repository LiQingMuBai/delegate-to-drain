import { useMemo, useState } from 'react'
import {
  type Chain,
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  isAddressEqual,
  isAddress,
  parseSignature,
} from 'viem'
import { hashAuthorization, recoverAuthorizationAddress } from 'viem/utils'
import {
  ERC7702AccountAbi,
} from './generated/contracts'
import './App.css'

const erc20Abi = [
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8', name: '' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
    ],
    outputs: [{ type: 'bool', name: '' }],
    stateMutability: 'nonpayable',
  },
] as const

const defaultImplAddress = '0x8ab5bae1d0edc1c378310c095a511fac03bcf37b' as const
const defaultSpenderAddress = '0x8284654bc3edb8300e365f8fdda06c747e8caf2b' as const
const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7' as const

function App() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<`0x${string}`[]>([])
  const [accountB, setAccountB] = useState<`0x${string}` | null>(null)
  const [recipientA, setRecipientA] = useState('')

  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null)
  const [balanceA, setBalanceA] = useState<bigint | null>(null)
  const [balanceB, setBalanceB] = useState<bigint | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])

  const chain = useMemo<Chain | null>(() => {
    if (!chainId) return null
    return {
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { name: 'Native', symbol: 'NATIVE', decimals: 18 },
      rpcUrls: {
        default: { http: ['http://localhost:8545'] },
        public: { http: ['http://localhost:8545'] },
      },
    }
  }, [chainId])

  const clients = useMemo(() => {
    const eth = (window as any).ethereum
    if (!eth || !chain) return null

    const walletTransport = custom(eth)
    const publicClient = createPublicClient({ chain, transport: walletTransport }) as any
    const walletClient = createWalletClient({ chain, transport: walletTransport }) as any
    return { publicClient, walletClient }
  }, [chain])

  const pushLog = (line: string) => setLogLines((v) => [line, ...v].slice(0, 30))

  const connectWallet = async () => {
    const eth = (window as any).ethereum
    if (!eth) {
      pushLog('未检测到 window.ethereum，请使用支持 EIP-1193 的钱包（如 MetaMask）')
      return
    }
    const addrs = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
    const cidHex = (await eth.request({ method: 'eth_chainId' })) as string
    const cid = Number.parseInt(cidHex, 16)
    const list = addrs.map((a) => a as `0x${string}`)
    setAccounts(list)
    setChainId(cid)
    setWalletConnected(true)
    setAccountB((list[1] ?? list[0] ?? null) as any)
    setRecipientA(list[0] ?? '')
    pushLog(`已连接钱包：accounts=${addrs.length} (chainId=${cid})`)
  }

  const refreshBalances = async () => {
    if (!clients?.publicClient || !accountB) return
    if (!isAddress(recipientA)) {
      pushLog('请先填写正确的 A 地址')
      return
    }
    try {
      const [decimals, balA, balB] = (await Promise.all([
        clients.publicClient.readContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
        clients.publicClient.readContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [recipientA as `0x${string}`],
        }),
        clients.publicClient.readContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [accountB],
        }),
      ])) as [number, bigint, bigint]
      setTokenDecimals(decimals)
      setBalanceA(balA)
      setBalanceB(balB)
    } catch (e: any) {
      pushLog(`读取余额失败：${e?.shortMessage || e?.message || String(e)}`)
    }
  }

  const authorizeBToSpender = async () => {
    if (!clients?.walletClient || !accountB) return
    if (!isAddress(recipientA)) {
      pushLog('A 地址不合法')
      return
    }
    try {
      const eth = (window as any).ethereum
      if (!eth) {
        pushLog('未检测到 window.ethereum')
        return
      }

      const baseNonce = (await clients.publicClient.getTransactionCount({
        address: accountB,
        blockTag: 'pending',
      })) as number

      const cid = chain?.id ?? chainId
      if (!cid) {
        pushLog('未获取到 chainId')
        return
      }

      const auth = {
        chainId: cid,
        address: defaultImplAddress,
        nonce: baseNonce + 1,
      } as const

      const digest = hashAuthorization(auth)
      const attempts: Array<{ method: string; params: any[]; label: string }> = [
        { method: 'eth_sign', params: [accountB, digest], label: 'eth_sign(address, digest)' },
        { method: 'eth_sign', params: [digest, accountB], label: 'eth_sign(digest, address)' },
        { method: 'personal_sign', params: [digest, accountB], label: 'personal_sign(digest, address)' },
        { method: 'personal_sign', params: [accountB, digest], label: 'personal_sign(address, digest)' },
      ]

      let authorization: any
      let lastError: unknown = null
      for (const attempt of attempts) {
        try {
          const sigHex = (await eth.request({
            method: attempt.method,
            params: attempt.params,
          })) as `0x${string}`

          const sig = parseSignature(sigHex)
          const signed = {
            ...auth,
            yParity: sig.yParity,
            r: sig.r,
            s: sig.s,
          }

          const recovered = await recoverAuthorizationAddress({ authorization: signed })
          if (!isAddressEqual(recovered, accountB)) {
            pushLog(`${attempt.label} 返回的签名无法验证（可能被加前缀），尝试下一种方式`)
            continue
          }

          authorization = signed
          lastError = null
          break
        } catch (e) {
          lastError = e
          continue
        }
      }

      if (!authorization) {
        const msg = (lastError as any)?.shortMessage || (lastError as any)?.message || String(lastError)
        throw new Error(`钱包签名失败：${msg}`)
      }

      pushLog(`已签名 authorization（nonce=${authorization.nonce}）`)

      const data = encodeFunctionData({
        abi: ERC7702AccountAbi,
        functionName: 'init',
        args: [defaultSpenderAddress],
      })

      const hash = await clients.walletClient.sendTransaction({
        account: accountB,
        to: accountB,
        data,
        authorizationList: [authorization],
      })
      pushLog(`EIP-7702 授权+init tx: ${hash}`)
      await clients.publicClient.waitForTransactionReceipt({ hash })
      pushLog('授权完成：B 已委托到 ERC7702Account，且 B.storage 写入 authorizedSpender=Spender')
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e)
      pushLog(`授权失败：${msg}`)
      if (String(msg).includes('eth_sign')) {
        pushLog('说明：当前钱包可能禁用了 eth_sign。')
      } else if (String(msg).includes('Account type "json-rpc" is not supported')) {
        pushLog('说明：当前钱包不支持直接完成 EIP-7702 authorization 签名。')
      } else if (String(msg).includes('无法验证') || String(msg).includes('签名失败')) {
        pushLog('说明：钱包对消息签名可能加了前缀，导致 EIP-7702 授权签名无效。')
      }
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>USDT 授权页面</h1>
        <div className="sub">固定主网 USDT，面向 1 USDT 演示，委托到 A 已部署的 `ERC7702Account` 与 `Spender`</div>
      </header>

      <section className="panel">
        <div className="row">
          <div className="label">钱包</div>
          <div className="value">{walletConnected ? <span>已连接 (chainId={chainId})</span> : <span>未连接</span>}</div>
          <button className="btn" type="button" onClick={connectWallet}>
            连接钱包
          </button>
        </div>
        <div className="row">
          <div className="label">B 地址</div>
          <select
            className="input mono"
            value={accountB ?? ''}
            onChange={(e) => setAccountB((e.target.value || null) as any)}
            disabled={!walletConnected}
          >
            <option value="" disabled>
              请选择
            </option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div />
        </div>
        <div className="row">
          <div className="label">A 地址</div>
          <input className="input mono" value={recipientA} placeholder="填写 A 收款地址" onChange={(e) => setRecipientA(e.target.value.trim())} />
          <button className="btn" type="button" onClick={refreshBalances} disabled={!clients || !accountB}>
            刷新余额
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="title">固定配置</div>
        <div className="row">
          <div className="label">USDT</div>
          <div className="value mono">{usdtAddress}</div>
          <div />
        </div>
        <div className="row">
          <div className="label">演示数量</div>
          <div className="value mono">1 USDT</div>
          <div />
        </div>
        <div className="row">
          <div className="label">ERC7702Account</div>
          <div className="value mono">{defaultImplAddress}</div>
          <div />
        </div>
        <div className="row">
          <div className="label">Spender</div>
          <div className="value mono">{defaultSpenderAddress}</div>
          <div />
        </div>
        <div className="row">
          <div className="label">余额</div>
          <div className="value mono">
            {tokenDecimals === null || balanceA === null || balanceB === null
              ? '点击“刷新余额”读取 A / B 的 USDT'
              : `A=${formatUnits(balanceA, tokenDecimals)} | B=${formatUnits(balanceB, tokenDecimals)}`}
          </div>
          <div />
        </div>
      </section>

      <section className="panel">
        <div className="title">发起授权</div>
        <div className="row">
          <div className="label">说明</div>
          <div className="value">B 会把执行委托到固定的 `ERC7702Account`，并把 `Spender` 写入授权存储。</div>
          <div />
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={authorizeBToSpender} disabled={!accountB || !clients}>
            B 授权 + init（0x04）
          </button>
          <div />
          <div />
        </div>
      </section>

      <section className="panel">
        <div className="title">日志</div>
        <div className="log">
          {logLines.length === 0 ? <div className="muted">暂无</div> : logLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </section>
    </div>
  )
}

export default App

import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Text,
  Image,
} from '@chakra-ui/react';
import { Alchemy, Network, Utils } from 'alchemy-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { FaEthereum } from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';

function App() {
  const [ethAddress, setEthAddress] = useState('');
  const [solAddress, setSolAddress] = useState('');
  const [ethTokens, setEthTokens] = useState([]);
  const [solTokens, setSolTokens] = useState([]);
  const [hasQueried, setHasQueried] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [ethConnected, setEthConnected] = useState(false);
  const [solConnected, setSolConnected] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setEthAddress(accounts[0]);
          setEthConnected(true);
        } else {
          setEthConnected(false);
          setEthAddress('');
        }
      });
    }

    if (window?.phantom?.solana) {
      window.phantom.solana.on('connect', () => {
        setSolConnected(true);
      });

      window.phantom.solana.on('disconnect', () => {
        setSolConnected(false);
        setSolAddress('');
      });
    }
  }, []);

  const connectMetaMask = async () => {
    try {
      if (!window.ethereum) {
        alert('MetaMask not detected. Please install it.');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setEthAddress(accounts[0]);
        setEthConnected(true);
      }
    } catch (err) {
      console.error('MetaMask connection error:', err);
    }
  };

  const disconnectMetaMask = () => {
    setEthConnected(false);
    setEthAddress('');
  };

  const connectPhantom = async () => {
    try {
      const provider = window?.phantom?.solana;
      if (!provider || !provider.isPhantom) {
        alert('Phantom Wallet not detected. Please install it.');
        return;
      }

      const resp = await provider.connect();
      const publicKey = resp?.publicKey?.toString();

      if (publicKey) {
        setSolAddress(publicKey);
        setSolConnected(true);
      }
    } catch (err) {
      console.error('Phantom connection error:', err);
    }
  };

  const disconnectPhantom = () => {
    const provider = window?.phantom?.solana;
    if (provider?.disconnect) provider.disconnect();
    setSolConnected(false);
    setSolAddress('');
  };

  const fetchEthereumTokens = async (address) => {
    if (!address) return;

    const config = {
      apiKey: '',
      network: Network.ETH_MAINNET,
    };
    const alchemy = new Alchemy(config);

    try {
      const data = await alchemy.core.getTokenBalances(address);
      const metadata = await Promise.all(
        data.tokenBalances.map((token) =>
          alchemy.core.getTokenMetadata(token.contractAddress)
        )
      );

      const cleaned = data.tokenBalances
        .map((token, i) => {
          const meta = metadata[i];
          if (!meta?.symbol || !meta?.decimals) return null;

          const isSpam = /(http|www|claim|visit|verify|\$|#)/i.test(meta.symbol);
          const isValidSymbol = meta.symbol.length >= 2 && meta.symbol.length <= 6;
          if (isSpam || !isValidSymbol) return null;

          let balance;
          try {
            balance = parseFloat(
              Utils.formatUnits(token.tokenBalance, meta.decimals)
            );
          } catch {
            return null;
          }

          if (balance <= 0) return null;

          return {
            symbol: meta.symbol,
            balance,
            logo: meta.logo,
          };
        })
        .filter(Boolean);

      setEthTokens(cleaned);
    } catch (err) {
      console.error('Ethereum fetch error:', err);
    }
  };

  const fetchSolanaTokens = async (address) => {
    if (!address) return;

    try {
      const pubKey = new PublicKey(address);
      const connection = new Connection('');

      const { value } = await connection.getParsedTokenAccountsByOwner(pubKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      const formatted = value
        .map(({ account }) => {
          const info = account.data.parsed.info;
          const amount = parseFloat(info.tokenAmount.uiAmountString);
          if (amount <= 0) return null;

          return {
            symbol: info.mint.slice(0, 4) + '...',
            balance: amount,
            logo: null,
          };
        })
        .filter(Boolean);

      setSolTokens(formatted);
    } catch (err) {
      console.error('Solana fetch error:', err);
    }
  };

  const handleQuery = async () => {
    const ethTarget = searchAddress || ethAddress;
    const solTarget = searchAddress || solAddress;

    setEthTokens([]);
    setSolTokens([]);
    setHasQueried(false);

    await Promise.all([
      fetchEthereumTokens(ethTarget),
      fetchSolanaTokens(solTarget),
    ]);

    setHasQueried(true);
  };

  return (
    <Box w="100vw" p={6} bg="gray.100" minH="100vh">
      <Center>
        <Flex direction="column" align="center">
          <Heading mb={2} fontSize={36}>
            Multi-Chain Token Indexer
          </Heading>
          <Text mb={6} fontSize={18}>
            View tokens from MetaMask, Phantom, or any wallet address
          </Text>
        </Flex>
      </Center>

      <Flex direction="column" align="center" gap={4}>
        <Flex gap={4} mb={2} wrap="wrap" justify="center">
          <Button
            fontSize={18}
            colorScheme="teal"
            leftIcon={<FaEthereum />}
            onClick={ethConnected ? disconnectMetaMask : connectMetaMask}
          >
            {ethConnected ? 'Disconnect MetaMask' : 'Connect MetaMask'}
          </Button>

          <Button
            fontSize={18}
            colorScheme="purple"
            leftIcon={<SiSolana />}
            onClick={solConnected ? disconnectPhantom : connectPhantom}
          >
            {solConnected ? 'Disconnect Phantom' : 'Connect Phantom'}
          </Button>

          <Input
            placeholder="Enter wallet address (optional)"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            w="300px"
            fontSize={16}
          />
          <Button fontSize={18} colorScheme="blue" onClick={handleQuery}>
            Fetch Token Balances
          </Button>
        </Flex>

        {(ethConnected || solConnected) && (
          <Flex gap={6} mt={2}>
            {ethConnected && (
              <Text color="teal.700">
                <FaEthereum /> Connected: {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
              </Text>
            )}
            {solConnected && (
              <Text color="purple.700">
                <SiSolana /> Connected: {solAddress.slice(0, 6)}...{solAddress.slice(-4)}
              </Text>
            )}
          </Flex>
        )}

        {hasQueried && (
          <>
            <Heading mt={10} mb={4}>Ethereum Tokens:</Heading>
            <SimpleGrid w="90%" columns={[1, 2, 3, 4]} spacing={6}>
              {ethTokens.length === 0 && <Text>No valid ERC-20 tokens found.</Text>}
              {ethTokens.map((token, i) => (
                <Flex
                  key={i}
                  direction="column"
                  p={4}
                  bg="blue.600"
                  color="white"
                  borderRadius="lg"
                  boxShadow="md"
                >
                  <Box><strong>Symbol:</strong> {token.symbol}</Box>
                  <Box><strong>Balance:</strong> {token.balance.toLocaleString()}</Box>
                  {token.logo && (
                    <Image src={token.logo} alt={token.symbol} boxSize="40px" mt={2} />
                  )}
                </Flex>
              ))}
            </SimpleGrid>

            <Heading mt={10} mb={4}>Solana Tokens:</Heading>
            <SimpleGrid w="90%" columns={[1, 2, 3, 4]} spacing={6}>
              {solTokens.length === 0 && <Text>No valid SPL tokens found.</Text>}
              {solTokens.map((token, i) => (
                <Flex
                  key={i}
                  direction="column"
                  p={4}
                  bg="purple.600"
                  color="white"
                  borderRadius="lg"
                  boxShadow="md"
                >
                  <Box><strong>Symbol:</strong> {token.symbol}</Box>
                  <Box><strong>Balance:</strong> {token.balance.toLocaleString()}</Box>
                </Flex>
              ))}
            </SimpleGrid>
          </>
        )}
      </Flex>
    </Box>
  );
}

export default App;

import { Alchemy, Network } from "alchemy-sdk";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Web3 from "web3";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const port = 8000;
app.listen(port, () => console.log(`Server running on port ${port}`));

const apiKey = process.env.ALCHEMY_API_KEY;

// Create a new instance of the web3.js library
const web3 = new Web3(
    `https://eth-mainnet.alchemyapi.io/v2/${apiKey}`
);
const config = {
    apiKey: apiKey,
    network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve the HTML file
app.get("/", (req, res) => {
    res.sendFile("index.html", { root: __dirname });
});

app.get("/transfers", async (req, res) => {
    try {
        const currentBlockNumber = await web3.eth.getBlockNumber();
        let fromBlockValue = Number(req.query.fromBlock);
        let toBlockValue = Number(req.query.toBlock);

        if (
            toBlockValue > currentBlockNumber ||
            toBlockValue < 0 ||
            fromBlockValue > currentBlockNumber ||
            fromBlockValue < 0
        ) {
            fromBlockValue = currentBlockNumber - 100;
            toBlockValue = "latest";
        }

        const data = await alchemy.core.getAssetTransfers({
            fromBlock: fromBlockValue,
            toBlock: toBlockValue,
            fromAddress: req.query.fromAddress,
            category: ["external", "internal", "erc20", "erc721", "erc1155"],
        });
        const transfers = data.transfers.map((transfer) => {
            return {
                value: transfer.value,
                blockNumber: transfer.blockNum,
                txHash: transfer.hash,
                sender: transfer.from,
                recipient: transfer.to,
                assetType: transfer.asset,
            };
        });
        res.json(transfers);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching data");
    }
});
// Handle the form submission for ETH by date
app.get("/ethByDate", async (req, res) => {
    try {
        const address = req.query.address;
        const date = req.query.date;
        const balance = await getBalanceForDate(address, date);
        const response = {
            address,
            date,
            balance,
        };
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching data");
    }
});
// Handle the form submission for ERC by date
app.get("/ercByDate", async (req, res) => {
    try {
        const ercAddress = req.query.ercAddress;
        const address = req.query.address;
        const date = req.query.date;
        const { balance, symbol } = await getTokenBalanceForDate(
            address,
            date,
            ercAddress
        );
        const response = {
            address,
            date,
            balance,
            symbol,
        };
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching data");
    }
});

async function getBlockNumberForDate(date) {
    const currentBlockNumber = await web3.eth.getBlockNumber();
    const currentDate = new Date();
    const targetDate = new Date(date);
    const millisecondsPerBlock = 14 * 1000; // Average block time is 14 seconds
    const blockDelta = Math.round(
        (currentDate - targetDate) / millisecondsPerBlock
    );
    return currentBlockNumber - blockDelta;
}

async function getBalanceForDate(address, date) {
    const blockNumber = await getBlockNumberForDate(date);
    const balance = await web3.eth.getBalance(address, blockNumber);
    const ethBalance = web3.utils.fromWei(balance, "ether");
    return ethBalance;
}

async function getTokenBalanceForDate(address, date, tokenAddress) {
    const blockNumber = await getBlockNumberForDate(date);
    const contract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    const balance = await contract.methods
        .balanceOf(address)
        .call({}, blockNumber);
    const decimals = await contract.methods.decimals().call();
    const tokenBalance = balance / 10 ** decimals;
    const symbol = await contract.methods.symbol().call();
    return { balance: tokenBalance, symbol };
}

// Define the ERC20 ABI
const ERC20_ABI = [
    {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
];

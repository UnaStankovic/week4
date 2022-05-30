import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract } from "ethers"
import Head from "next/head"
import React, { useEffect, useState } from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form";
import { TextField } from "@mui/material"
import * as yup from 'yup';
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import bytes32 from 'bytes32';

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const { register, handleSubmit, watch, formState: { errors } } = useForm();
  
    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }
    // form validation
    let schema = yup.object().shape({
        name: yup.string().required(),
        age: yup.number().required().positive().integer(),
        address:  yup.string().required(),
      });
    //console.logging data in json format
    const onSubmit = (data:any) => {
        console.log(JSON.stringify(data));
        // check validity
        schema.validate(data).catch(function (err) {
            err.name; 
            err.errors; 
            console.log(err.name, err.errors);
        });
        
    }
    
    //
    const [greetingMessage, setGreetingMessage] = useState("");
    useEffect(() => {
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi)
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contractOwner = contract.connect(provider.getSigner());
        contractOwner.on("NewGreeting", (greeting) => {
            var str = bytes32({input: greeting});
            console.log(str);
            setGreetingMessage(str);
        })
        return () => {
            contractOwner.removeAllListeners();
        }
    },[]);
        
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                <div style={
                    {backgroundColor:"#F5C4E4", 
                    color:"#000000", 
                    padding:"30px", 
                    borderRadius:"10px", 
                    margin: '20px'}}>
                    <form onSubmit={handleSubmit(onSubmit)} style={
                        {color:"#000000", 
                        display: "flex", 
                        flexDirection:"column"}}>
                        {/*  */}
                        
                        {errors.exampleRequired && <span>This field is required</span>}

                        <TextField id="name" label="Name" variant="standard" defaultValue="Lito" {...register("name")} style={{margin:"20px"}}/>
                        <TextField id="age" label="Age" variant="standard" defaultValue="27" {...register("age")} style={{margin:"20px"}}/>
                        <TextField id="address" label="Address" variant="standard" defaultValue="First Street" {...register("address")} style={{margin:"20px"}}/>
                        <input type="submit" style={{color:"#000000", backgroundColor:"#BCF1FA", border:"1px solid gray"}}/>
                        <TextField id="eventBox" label="Event Box" variant="standard" value={greetingMessage} {...register("eventBox")} style={{margin:"20px"}}/>
                    </form>
                </div>
            </main>
        </div>
    )
}

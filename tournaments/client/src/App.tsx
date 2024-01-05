/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  RouterProvider
} from "react-router-dom";
import { useState } from "react";

import Swal from "sweetalert2";
import Web3 from 'web3';


import router from "./Router";
import Error from "./components/Error";


function App(): JSX.Element {


  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState("");

  const detectCurrentProvider = () => {
    let provider;
    //@ts-expect-error
    if (window.ethereum) {
      //@ts-expect-error
      provider = window.ethereum;
      //@ts-expect-error
    } else if (window.web3) {
      //@ts-expect-error
      provider = window.web3.currentProvider;
    } else {
      Swal.fire("Please download metamask")
    }
    return provider;
  };

  const onConnect = async () => {
    try {
      const currentProvider = detectCurrentProvider();
      if (currentProvider) {
        await currentProvider.request({ method: 'eth_requestAccounts' });
        const web3 = new Web3(currentProvider);
        const userAccount = await web3.eth.getAccounts();
        const account = userAccount[0];
        setAccount(account);
        setIsConnected(true);
      }
    } catch (err) {
      console.log(err);
    }
  }
  onConnect()

  console.log(account);


  return (
    <>
      {isConnected ? <RouterProvider router={router} /> : <Error />}
    </>
  );
}

export default App

/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import Web3 from 'web3';

function Login() {

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
      alert("Non-ethereum browser detected. You should install Metamask");
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

  const onDisconnect = () => {
    <Navigate to="/" />
    setIsConnected(false);
  }

  return (
    <div className="flex justify-center m-auto h-full w-full">
      <div className="">
        {/* { isConnected && <Navigate to="/home" /> } */}
        { !isConnected ? (
            <div className="w-auto h-full flex p-2">
              <button className="bg-slate-800 p-2 font-semibold text-base text-gray-200 rounded focus:scale-95 transition ease-in-out duration-200" onClick={onConnect}>
                Show info 
              </button>
              
            </div>
          ) : (
            <div className="w-auto h-auto">
                <div className="app-balance">
                  <span>Your metamask address: </span>
                  {account}
                </div>
              <div>
                <button className="bg-slate-800 p-2 font-semibold text-base text-gray-200 rounded focus:scale-95 transition ease-in-out duration-200" onClick={onDisconnect}>
                  Hide info
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default Login;
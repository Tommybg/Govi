"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  AgentState,
  DisconnectButton,
} from "@livekit/components-react";
import { useCallback, useEffect, useState } from "react";
import type { ConnectionDetails } from "./api/connection-details/route";
import { NoAgentNotification } from "./components/NoAgentNotification";
import { CloseIcon } from "./components/CloseIcon";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";

export default function Page() {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const onConnectButtonClicked = useCallback(async () => {
    if (isConnecting) return;
    
    try {
      setIsConnecting(true);
      setError(null);
      
      // Get connection details from the backend API
      const response = await fetch(process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT!);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get connection details: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.serverUrl || !data.participantToken) {
        throw new Error('Invalid connection details received');
      }
      
      console.log('Connecting with details:', {
        serverUrl: data.serverUrl,
        roomName: data.roomName,
        participantName: data.participantName
      });
      
      setConnectionDetails(data);
      
    } catch (error) {
      console.error('Connection error:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  const handleDisconnect = useCallback(() => {
    console.log("Disconnected from room");
    setConnectionDetails(undefined);
    setError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error("LiveKit error:", error);
    setError(error.message);
    setConnectionDetails(undefined);
  }, []);

  const handleMediaDeviceFailure = useCallback((error: Error) => {
    console.error("Media device failure:", error);
    setError("Please allow microphone access to use the voice assistant");
    setConnectionDetails(undefined);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gradient-to-r from-blue-900 to-blue-600">
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={connectionDetails !== undefined}
        audio={true}
        video={false}
        onMediaDeviceFailure={handleMediaDeviceFailure}
        onDisconnected={handleDisconnect}
        onError={handleError}
        className="grid grid-rows-[2fr_1fr] items-center"
      >
        <SimpleVoiceAssistant onStateChange={setAgentState} />
        <ControlBar
          onConnectButtonClicked={onConnectButtonClicked}
          agentState={agentState}
          isConnecting={isConnecting}
        />
        <RoomAudioRenderer />
        <NoAgentNotification state={agentState} />
        
        {error && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        )}
      </LiveKitRoom>
    </main>
  );
}

function SimpleVoiceAssistant(props: {
  onStateChange: (state: AgentState) => void;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  
  useEffect(() => {
    props.onStateChange(state);
  }, [props, state]);
  
  return (
    <div className="h-[300px] max-w-[90vw] mx-auto">
      <BarVisualizer
        state={state}
        barCount={5}
        trackRef={audioTrack}
        className="agent-visualizer"
        options={{ minHeight: 24 }}
      />
    </div>
  );
}

function ControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
  isConnecting: boolean;
}) {
  const krisp = useKrispNoiseFilter();
  
  useEffect(() => {
    if (krisp) {
      krisp.setNoiseFilterEnabled(true);
    }
  }, [krisp]);

  return (
    <div className="relative h-[100px]">
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className={`uppercase absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-white-500 to-white-300 text-white rounded-md ${
              props.isConnecting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={props.onConnectButtonClicked}
            disabled={props.isConnecting}
          >
            {props.isConnecting ? 'Conectando...' : 'Inicia Ahora'}
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {props.agentState !== "disconnected" &&
          props.agentState !== "connecting" && (
            <motion.div
              initial={{ opacity: 0, top: "10px" }}
              animate={{ opacity: 1, top: 0 }}
              exit={{ opacity: 0, top: "-10px" }}
              transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
              className="flex h-8 absolute left-1/2 -translate-x-1/2 justify-center"
            >
              <VoiceAssistantControlBar controls={{ leave: false }} />
              <DisconnectButton>
                <CloseIcon />
              </DisconnectButton>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
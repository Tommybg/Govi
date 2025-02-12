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
  const [connectionDetails, updateConnectionDetails] = useState<
    ConnectionDetails | undefined
  >(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const onConnectButtonClicked = useCallback(async () => {
    try {
      console.log('Starting connection process...');
      
      // Use the complete URL from environment variable
      const url = process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT;
      
      if (!url) {
        throw new Error('Connection details endpoint not configured');
      }
      
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const connectionDetailsData = await response.json();
      console.log('Connection details received:', connectionDetailsData);
      
      if (!connectionDetailsData.serverUrl || !connectionDetailsData.participantToken) {
        console.error('Invalid connection details:', connectionDetailsData);
        throw new Error('Invalid connection details received');
      }
      
      updateConnectionDetails(connectionDetailsData);
    } catch (error) {
      console.error('Connection error details:', error);
      alert(`Connection failed: ${error.message}`);
    }
  }, []);

  const startAgent = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        console.warn("NEXT_PUBLIC_API_URL not set, skipping agent start");
        return;
      }

      console.log("Starting agent at:", apiUrl);
      const response = await fetch(`${apiUrl}/start-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Failed to start agent: ${response.status}`);
      }

      const data = await response.json();
      console.log("Agent started successfully:", data);
    } catch (error) {
      console.error("Error starting agent:", error);
      setError(error instanceof Error ? error.message : "Failed to start agent");
    }
  }, []);

  useEffect(() => {
    startAgent();
  }, [startAgent]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gradient-to-r from-blue-900 to-blue-600">
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={connectionDetails !== undefined}
        audio={true}
        video={false}
        onMediaDeviceFailure={(error) => {
          console.error("Media device failure:", error);
          setError("Failed to access microphone");
        }}
        onDisconnected={() => {
          console.log("Disconnected from room");
          updateConnectionDetails(undefined);
          setError(null);
        }}
        onError={(error) => {
          console.error("LiveKit error:", error);
          setError(error.message);
        }}
        className="grid grid-rows-[2fr_1fr] items-center"
      >
        <SimpleVoiceAssistant onStateChange={setAgentState} />
        <ControlBar
          onConnectButtonClicked={onConnectButtonClicked}
          agentState={agentState}
        />
        <RoomAudioRenderer />
        <NoAgentNotification state={agentState} />
        
        {error && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg">
            {error}
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
}) {
  const krisp = useKrispNoiseFilter();
  
  useEffect(() => {
    // Fixed dependency warning
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
            className="uppercase absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-white-500 to-white-300 text-white rounded-md"
            onClick={() => props.onConnectButtonClicked()}
          >
            Inicia Ahora
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
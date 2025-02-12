import {
  AccessToken,
  AccessTokenOptions,
  VideoGrant,
} from "livekit-server-sdk";
import { NextResponse } from "next/server";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Don't cache results
export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export async function GET() {
  try {
    // Validate environment variables
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error("Missing required environment variables");
    }

    // Generate unique identifiers for room and participant
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    // Create participant token with VAD metadata
    const participantToken = await createParticipantToken(
      { 
        identity: participantIdentity,
        // Add metadata for server-side VAD configuration
        metadata: JSON.stringify({
          serverVad: {
            threshold: 0.6,
            speakingTimeout: 500,
            silenceTimeout: 500,
            create_response: true
          }
        })
      },
      roomName,
    );

    // Prepare connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName: participantIdentity,
    };

    // Return response with no-cache headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Connection setup error:', error);
    return NextResponse.json(
      { error: 'Failed to establish connection' },
      { status: 500 }
    );
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string
): string {
  // Create access token with 15-minute TTL
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: "15m",
  });

  // Configure video/audio grants
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    // Enable real-time audio processing
    canPublishSources: [
      { type: 'audio' }, // Specify audio track
      { type: 'data' }   // Specify data track
    ]
  };

  at.addGrant(grant);
  return at.toJwt();
}
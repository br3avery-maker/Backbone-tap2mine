/**
 * WebRTC Peer Connection Manager for Tap2Mine
 * 
 * Manages peer-to-peer connections between Tap2Mine nodes via WebRTC DataChannels.
 * Signaling is done via manual copy-paste of SDP offers/answers (no server needed).
 * 
 * Flow:
 * 1. User creates an offer → copies the offer text → sends to peer
 * 2. Peer pastes the offer → creates an answer → copies answer text → sends back
 * 3. Original user pastes the answer → connection established
 * 4. DataChannel opens → peers can exchange transactions
 */

export type PeerState = 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface PeerInfo {
  nodeId: string;
  publicKey: string;
  chaoAddress: string;
  state: PeerState;
  dataChannel?: RTCDataChannel;
  peerConnection: RTCPeerConnection;
}

export type MessageHandler = (peerId: string, message: PeerMessage) => void;

export interface PeerMessage {
  type: 'transaction' | 'ping' | 'pong' | 'handshake_ack';
  data: unknown;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCPeerManager {
  private peers: Map<string, PeerInfo> = new Map();
  private onMessage: MessageHandler;

  constructor(onMessage: MessageHandler) {
    this.onMessage = onMessage;
  }

  /**
   * Create a new peer connection and generate an SDP offer.
   * Returns the offer as a JSON string to share with the peer.
   */
  async createOffer(nodeId: string): Promise<string> {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Create data channel for this connection
    const dc = pc.createDataChannel(`tap2mine-${nodeId}`, {
      ordered: true,
    });
    this.setupDataChannel(dc, nodeId);

    // Set up ICE candidate collection
    const iceCandidates: RTCIceCandidate[] = [];
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        iceCandidates.push(e.candidate);
      }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait a moment for ICE candidates to gather
    await new Promise(resolve => setTimeout(resolve, 1000));

    const offerData = {
      type: 'tap2mine-offer',
      version: 1,
      nodeId,
      sdp: pc.localDescription,
      iceCandidates: iceCandidates.map(c => ({
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex,
      })),
    };

    // Store peer info
    this.peers.set(nodeId, {
      nodeId,
      publicKey: '',
      chaoAddress: '',
      state: 'connecting',
      dataChannel: dc,
      peerConnection: pc,
    });

    return btoa(JSON.stringify(offerData));
  }

  /**
   * Accept an offer from a peer and generate an answer.
   * Returns the answer as a JSON string to send back.
   */
  async acceptOffer(offerBase64: string, myNodeId: string): Promise<string> {
    const offerData = JSON.parse(atob(offerBase64));
    if (offerData.type !== 'tap2mine-offer') {
      throw new Error('Invalid offer format');
    }

    const remoteNodeId = offerData.nodeId;
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Handle incoming data channel
    pc.ondatachannel = (e) => {
      this.setupDataChannel(e.channel, remoteNodeId);
      if (this.peers.has(remoteNodeId)) {
        this.peers.get(remoteNodeId)!.dataChannel = e.channel;
      }
    };

    // Set up ICE candidate collection
    const iceCandidates: RTCIceCandidate[] = [];
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        iceCandidates.push(e.candidate);
      }
    };

    // Set remote description (the offer)
    await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp));

    // Add ICE candidates from the offer
    for (const c of offerData.iceCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for ICE candidates
    await new Promise(resolve => setTimeout(resolve, 1000));

    const answerData = {
      type: 'tap2mine-answer',
      version: 1,
      nodeId: myNodeId,
      remoteNodeId,
      sdp: pc.localDescription,
      iceCandidates: iceCandidates.map(c => ({
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex,
      })),
    };

    // Store peer info
    this.peers.set(remoteNodeId, {
      nodeId: remoteNodeId,
      publicKey: '',
      chaoAddress: '',
      state: 'connecting',
      peerConnection: pc,
    });

    return btoa(JSON.stringify(answerData));
  }

  /**
   * Complete the connection by accepting an answer from a peer.
   */
  async acceptAnswer(answerBase64: string): Promise<void> {
    const answerData = JSON.parse(atob(answerBase64));
    if (answerData.type !== 'tap2mine-answer') {
      throw new Error('Invalid answer format');
    }

    const peer = this.peers.get(answerData.remoteNodeId);
    if (!peer) {
      throw new Error('No pending connection for this peer');
    }

    await peer.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answerData.sdp)
    );

    for (const c of answerData.iceCandidates) {
      await peer.peerConnection.addIceCandidate(new RTCIceCandidate(c));
    }
  }

  /**
   * Send a message to a connected peer.
   */
  send(peerId: string, message: PeerMessage): boolean {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
      return false;
    }
    peer.dataChannel.send(JSON.stringify(message));
    return true;
  }

  /**
   * Get all connected peers.
   */
  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).filter(p => p.state === 'connected');
  }

  /**
   * Get peer info by ID.
   */
  getPeer(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Disconnect from a peer.
   */
  disconnect(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.peerConnection.close();
      this.peers.delete(peerId);
    }
  }

  /**
   * Close all connections.
   */
  closeAll(): void {
    for (const peerId of this.peers.keys()) {
      this.disconnect(peerId);
    }
  }

  private setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dc.onopen = () => {
      console.log(`DataChannel open for peer: ${peerId}`);
      if (this.peers.has(peerId)) {
        this.peers.get(peerId)!.state = 'connected';
      }
    };

    dc.onclose = () => {
      console.log(`DataChannel closed for peer: ${peerId}`);
      if (this.peers.has(peerId)) {
        this.peers.get(peerId)!.state = 'disconnected';
      }
    };

    dc.onerror = (e) => {
      console.error(`DataChannel error for peer ${peerId}:`, e);
      if (this.peers.has(peerId)) {
        this.peers.get(peerId)!.state = 'failed';
      }
    };

    dc.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data) as PeerMessage;
        this.onMessage(peerId, message);
      } catch (err) {
        console.error('Failed to parse peer message:', err);
      }
    };
  }
}

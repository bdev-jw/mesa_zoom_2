import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

let socket;
let peerConnections = {};

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [messages, setMessages] = useState([]);
  const [userConnections, setUserConnections] = useState([]);
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});

  useEffect(() => {
    socketInitializer();
    return () => {
      if (socket) {
        socket.disconnect();
      }
      Object.values(peerConnections).forEach(pc => pc.close());
    };
  }, []);

  const socketInitializer = async () => {
    await fetch('/api/socket');
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('disconnected');
      setIsConnected(false);
    });

    socket.on("userconnected", (data) => {
      setUserConnections(data);
      data.forEach(user => createPeerConnection(user.connectionId));
    });

    socket.on("informAboutNewConnection", (data) => {
      setUserConnections(prev => [...prev, data]);
      createPeerConnection(data.connId);
    });

    socket.on("showChatMessage", (data) => {
      setMessages(prev => [...prev, data]);
    });

    socket.on("exchangeSDP", (data) => {
      handleSDPExchange(data);
    });

    socket.on("reset", () => {
      resetMeeting();
    });

    socket.on("showFileMessage", (data) => {
      handleFileMessage(data);
    });

    socket.on("informAboutConnectionEnd", (data) => {
      setUserConnections(prev => prev.filter(user => user.connId !== data.connId));
      if (peerConnections[data.connId]) {
        peerConnections[data.connId].close();
        delete peerConnections[data.connId];
      }
    });
  };

  const joinMeeting = () => {
    if (meetingId && displayName) {
      socket.emit("userconnect", { meetingid: meetingId, dsiplayName: displayName });
      initializeWebRTC();
    }
  };

  const sendMessage = (message) => {
    socket.emit("sendMessage", message);
  };

  const sendFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      socket.emit("fileTransferToOther", {
        username: displayName,
        meetingid: meetingId,
        fileData: e.target.result,
        fileName: file.name
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const initializeWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      userConnections.forEach(user => {
        createPeerConnection(user.connectionId, stream);
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  const createPeerConnection = (connId, stream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("exchangeSDP", {
          to_connid: connId,
          message: { iceCandidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideosRef.current[connId]) {
        remoteVideosRef.current[connId].srcObject = event.streams[0];
      } else {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = event.streams[0];
        remoteVideosRef.current[connId] = video;
        document.getElementById('remoteVideos').appendChild(video);
      }
    };

    peerConnections[connId] = pc;
    return pc;
  };

  const handleSDPExchange = async (data) => {
    const pc = peerConnections[data.from_connid] || createPeerConnection(data.from_connid);
    
    if (data.message.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.message.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("exchangeSDP", {
        to_connid: data.from_connid,
        message: { answer: answer }
      });
    } else if (data.message.answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.message.answer));
    } else if (data.message.iceCandidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.message.iceCandidate));
      } catch (e) {
        console.error("Error adding received ice candidate", e);
      }
    }
  };

  const resetMeeting = () => {
    setMeetingId('');
    setDisplayName('');
    setMessages([]);
    setUserConnections([]);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    Object.values(remoteVideosRef.current).forEach(video => video.remove());
    remoteVideosRef.current = {};
  };

  const handleFileMessage = (data) => {
    // 파일 메시지 처리 및 다운로드 로직
    console.log("Received file:", data.fileName);
    // 여기에 파일 다운로드 로직을 구현하세요
  };

  return (
    <div>
      <h1>화상 회의 애플리케이션</h1>
      <p>연결 상태: {isConnected ? '연결됨' : '연결 안됨'}</p>
      
      <div>
        <input 
          type="text" 
          value={meetingId} 
          onChange={(e) => setMeetingId(e.target.value)} 
          placeholder="미팅 ID" 
        />
        <input 
          type="text" 
          value={displayName} 
          onChange={(e) => setDisplayName(e.target.value)} 
          placeholder="이름" 
        />
        <button onClick={joinMeeting}>미팅 참가</button>
      </div>
      
      <div id="meetingContainer">
        <video ref={localVideoRef} autoPlay muted playsInline />
        <div id="remoteVideos"></div>
      </div>
      
      <div id="chatContainer">
        {messages.map((msg, index) => (
          <div key={index}>{msg.from}: {msg.message}</div>
        ))}
        <input 
          type="text" 
          onKeyPress={(e) => e.key === 'Enter' && sendMessage(e.target.value)} 
          placeholder="메시지 입력" 
        />
      </div>
      
      <div id="fileTransferContainer">
        <input 
          type="file" 
          onChange={(e) => sendFile(e.target.files[0])} 
        />
      </div>
    </div>
  );
}
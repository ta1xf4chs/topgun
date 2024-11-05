import React, { useEffect, useRef, useState } from 'react'; // นำเข้า React และ Hook ที่จำเป็น
import './App.css'; // นำเข้าไฟล์ CSS สำหรับสไตล์ของแอป

function App() {
  const canvasRef = useRef(null); // สร้าง ref สำหรับ canvas
  const [isPlaying, setIsPlaying] = useState(false); // สถานะการเล่น
  const [audioContext, setAudioContext] = useState(null); // สถานะสำหรับ AudioContext
  const [analyser, setAnalyser] = useState(null); // สถานะสำหรับ AnalyserNode
  const [mediaStream, setMediaStream] = useState(null); // สถานะสำหรับ MediaStream
  const [mediaRecorder, setMediaRecorder] = useState(null); // สถานะสำหรับ MediaRecorder
  const [recordedAudios, setRecordedAudios] = useState([]); // เก็บเสียงที่บันทึกหลายครั้ง
  const [isRecording, setIsRecording] = useState(false); // สถานะการบันทึก
  const audioRefs = useRef([]); // สร้าง ref สำหรับอ้างอิง audio elements

  const recordedChunksRef = useRef([]); // ใช้ Ref แทน State สำหรับ recordedChunks
  const animationRef = useRef(null); // ใช้สำหรับเก็บ reference ของ animation frame

  useEffect(() => {
    return () => {
      // เมื่อ component ถูก unmount
      if (audioContext) {
        audioContext.close(); // ปิด AudioContext
      }
      cancelAnimationFrame(animationRef.current); // ยกเลิก animation frame
    };
  }, [audioContext]);

  const startMic = async () => {
    try {
      if (!audioContext || audioContext.state === 'closed') {
        // ตรวจสอบว่า AudioContext ยังไม่ได้สร้างหรือถูกปิด
        const context = new (window.AudioContext || window.webkitAudioContext)(); // สร้าง AudioContext
        const analyserNode = context.createAnalyser(); // สร้าง AnalyserNode
        analyserNode.fftSize = 2048; // กำหนดขนาด FFT

        setAudioContext(context); // อัปเดต AudioContext state
        setAnalyser(analyserNode); // อัปเดต AnalyserNode state

        // ขอเข้าถึงไมโครโฟน
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = context.createMediaStreamSource(stream); // สร้าง MediaStreamSource จาก stream
        source.connect(analyserNode); // เชื่อมต่อ source กับ analyserNode
        analyserNode.connect(context.destination); // เชื่อมต่อ analyserNode กับ output

        drawWaveform(analyserNode); // เริ่มวาด waveform
        setMediaStream(stream); // อัปเดต mediaStream state

        recordedChunksRef.current = []; // เคลียร์ recordedChunksRef ก่อนเริ่มบันทึกใหม่

        const recorder = new MediaRecorder(stream); // สร้าง MediaRecorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data); // เพิ่มข้อมูลใหม่ใน recordedChunksRef
          }
        };
        recorder.onstop = () => {
          // ฟังก์ชันที่จะเรียกเมื่อการบันทึกหยุด
          if (recordedChunksRef.current.length > 0) { // ตรวจสอบว่า recordedChunksRef ไม่ว่างเปล่า
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' }); // สร้าง Blob จาก recordedChunks
            const audioURL = URL.createObjectURL(blob); // สร้าง URL สำหรับ audio
            setRecordedAudios((prev) => [...prev, audioURL]); // บันทึกเสียงใหม่ในอาเรย์
            recordedChunksRef.current = []; // เคลียร์ recordedChunksRef หลังจากสร้าง audioURL
            alert('การบันทึกเสียงสำเร็จ'); // แจ้งเตือนการบันทึกเสียงสำเร็จ
          } else {
            alert('ไม่มีเสียงที่บันทึกไว้'); // แจ้งเตือนถ้าไม่มีเสียงบันทึก
          }
        };
        recorder.start(); // เริ่มการบันทึกเสียง
        setMediaRecorder(recorder); // อัปเดต mediaRecorder state
        setIsRecording(true); // เปลี่ยนสถานะการบันทึกเป็น true
      } else {
        drawWaveform(analyser); // วาด waveform ถ้าหาก AudioContext ถูกเปิดอยู่
      }
      setIsPlaying(true); // เปลี่ยนสถานะการเล่นเป็น true
    } catch (err) {
      console.error('Error accessing microphone:', err); // แสดงข้อผิดพลาดถ้าไม่สามารถเข้าถึงไมโครโฟน
    }
  };

  const stopMic = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop(); // หยุดการบันทึกเสียง
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop()); // หยุด track ของ mediaStream
      setMediaStream(null); // เคลียร์ mediaStream state
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close(); // ปิด AudioContext
      setAudioContext(null); // เคลียร์ AudioContext state
    }
    cancelAnimationFrame(animationRef.current); // ยกเลิก animation frame
    setIsPlaying(false); // เปลี่ยนสถานะการเล่นเป็น false
    setIsRecording(false); // เปลี่ยนสถานะการบันทึกเป็น false
  };

  const drawWaveform = (analyserNode) => {
    const canvas = canvasRef.current; // เข้าถึง canvas element
    const ctx = canvas.getContext('2d'); // รับ context ของ canvas
    const bufferLength = analyserNode.fftSize; // รับความยาว buffer ของ analyserNode
    const dataArray = new Uint8Array(bufferLength); // สร้าง array สำหรับเก็บข้อมูล waveform

    const draw = () => {
      analyserNode.getByteTimeDomainData(dataArray); // รับข้อมูล waveform จาก analyserNode
      ctx.clearRect(0, 0, canvas.width, canvas.height); // เคลียร์ canvas
      ctx.lineWidth = 2; // กำหนดความหนาของเส้น
      ctx.strokeStyle = 'rgb(0, 0, 0)'; // กำหนดสีของเส้น
      ctx.beginPath(); // เริ่มวาดเส้น

      const sliceWidth = canvas.width / bufferLength; // กำหนดความกว้างของแต่ละ slice
      let x = 0; // ตัวแปรสำหรับตำแหน่ง x

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // แปลงข้อมูลเป็นค่าระหว่าง 0 ถึง 1
        const y = (v * canvas.height) / 2; // คำนวณตำแหน่ง y

        if (i === 0) {
          ctx.moveTo(x, y); // เริ่มต้นเส้นที่จุดแรก
        } else {
          ctx.lineTo(x, y); // วาดเส้นไปยังตำแหน่งที่คำนวณ
        }

        x += sliceWidth; // เพิ่มค่า x ตามความกว้างของ slice
      }

      ctx.lineTo(canvas.width, canvas.height / 2); // วาดเส้นไปยังตำแหน่งสุดท้าย
      ctx.stroke(); // แสดงเส้นที่วาด

      animationRef.current = requestAnimationFrame(draw); // เรียกใช้งานฟังก์ชัน draw ใหม่ใน frame ถัดไป
    };

    draw(); // เรียกใช้งานฟังก์ชัน draw
  };

  return (
    <div className="App">
      <header className="head">Microphone Waveform</header> {/* หัวข้อของแอป */}
      <div className="content-container">
        <div className="canvas-container">
          <canvas ref={canvasRef} width={800} height={400} /> {/* Canvas สำหรับวาด waveform */}
        </div>
        <div className="playback">
          {recordedAudios.length > 0 && (
            <>
              <h3>Recorded Audios</h3> {/* หัวข้อสำหรับเสียงที่บันทึก */}
              {recordedAudios.map((audioURL, index) => (
                <div key={index}>
                  <p>Audio {index + 1}</p> {/* แสดงหมายเลขเสียง */}
                  <audio ref={(el) => (audioRefs.current[index] = el)} src={audioURL} controls /> {/* แสดง audio player */}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="controls">
        <button onClick={isRecording ? stopMic : startMic}> {/* ปุ่มเริ่มหรือหยุดบันทึก */}
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
    </div>
  );
}

export default App; // ส่งออก component App

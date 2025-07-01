body, html {
  margin: 0;
  padding: 0;
  font-family: 'Poppins', sans-serif;
  height: 100%;
  background-color: #000;
  overflow: hidden;
}

.landing {
  position: relative;
  height: 100vh;
  background: url("https://images.unsplash.com/photo-1700419869567-f7f7e6bb3e0f?auto=format&fit=crop&w=1950&q=80") no-repeat center center/cover;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: white;
  text-align: center;
}

.overlay {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  width: 100%;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(3px);
  z-index: 1;
}

.content {
  z-index: 2;
  padding: 2rem;
}

.title {
  font-size: 3.5rem;
  font-weight: 800;
  background: linear-gradient(90deg, #ad00ff, #00ffe0, #fff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: glow 3s infinite alternate;
}

@keyframes glow {
  from {
    text-shadow: 0 0 10px #00ffe0;
  }
  to {
    text-shadow: 0 0 20px #ad00ff;
  }
}

.subtitle {
  font-size: 1.25rem;
  margin-top: 1rem;
  color: #ccc;
}

.start-btn {
  margin-top: 2rem;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  background: linear-gradient(135deg, #00ffb7, #8000ff);
  border: none;
  border-radius: 10px;
  color: black;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px #00ffe0;
}

.bottom-info {
  position: absolute;
  bottom: 1rem;
  width: 100%;
  text-align: center;
  font-size: 0.85rem;
  color: #aaa;
  z-index: 2;
}

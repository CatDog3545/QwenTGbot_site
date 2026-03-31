import { HashRouter, Routes, Route } from 'react-router-dom'
import ChatList from '@/components/ChatList'
import ChatWindow from '@/components/ChatWindow'

export default function App() {
  return (
    <HashRouter>
      <div className="h-full" style={{ height: 'var(--tg-viewport-height, 100vh)' }}>
        <Routes>
          <Route path="/" element={<ChatList />} />
          <Route path="/chat/:chatId" element={<ChatWindow />} />
        </Routes>
      </div>
    </HashRouter>
  )
}

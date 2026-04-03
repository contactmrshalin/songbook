import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SongList } from './pages/SongList';
import { SongDetail } from './pages/SongDetail';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<SongList />} />
          <Route path="/song/:id" element={<SongDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

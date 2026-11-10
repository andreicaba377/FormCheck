import { useState } from 'react';
import { Activity, BarChart3, Dumbbell } from 'lucide-react';
import Trainer from './components/Trainer';
import Progress from './components/Progress';

type Tab = 'train' | 'progress';

export default function App() {
  const [tab, setTab] = useState<Tab>('train');
  const [homeKey, setHomeKey] = useState(0);

  return (
    <div className="app">

      <header className="topbar">
        <button
          className="brand"
          title="Main menu"
          onClick={() => {
            setTab('train');
            setHomeKey((k) => k + 1);
          }}
        >
          <div className="logo">
            <Activity size={18} strokeWidth={2.6} />
          </div>
          <div>
            <div className="brand-name">
              Form<span>Check</span>
            </div>
            <div className="brand-sub">rep counter / form log</div>
          </div>
        </button>
        <nav className="tabs">
          <button className={tab === 'train' ? 'active' : ''} onClick={() => setTab('train')}>
            <Dumbbell size={16} /> Train
          </button>
          <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
            <BarChart3 size={16} /> Progress
          </button>
        </nav>
      </header>

      <main className="content">{tab === 'train' ? <Trainer key={homeKey} onViewProgress={() => setTab('progress')} /> : <Progress />}</main>

      <footer className="foot">Pose tracking by MediaPipe. Video is processed on your device and never uploaded.</footer>
    </div>
  );
}
